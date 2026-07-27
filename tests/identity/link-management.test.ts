import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { identityLink, factsPerson } from "@/lib/db/schema";
import {
  type Access,
  createLink,
  listLinks,
  parseFactsPersonId,
  parseRole,
  parseRowId,
  resolveAccess,
  updateLink,
} from "@/lib/identity";

import { createTestDb, type TestDb } from "../support/db";

// The two actors every case is written against. Admin is portal-owned and
// orthogonal to role, so "staff" alone must never be enough (ADR-0001).
const admin: Access = { linked: true, role: "staff", admin: true, factsPersonId: 1203006 };
const teacher: Access = { linked: true, role: "staff", admin: false, factsPersonId: 1203009 };
const anonymous: Access = { linked: false };

describe("admin link management", () => {
  let harness: TestDb;
  let db: TestDb["db"];

  beforeAll(async () => {
    harness = await createTestDb();
    db = harness.db;
  });

  afterAll(async () => {
    await harness.close();
  });

  beforeEach(async () => {
    await db.delete(identityLink);
    await db.delete(factsPerson);
  });

  describe("createLink", () => {
    it("grants access to a new portal account", async () => {
      const result = await createLink(
        { googleEmail: "27beno@tbs.org", factsPersonId: 1206161, role: "student", admin: false },
        { db, actor: admin },
      );

      expect(result).toMatchObject({ ok: true });
      expect(await resolveAccess("27beno@tbs.org", { db })).toEqual({
        linked: true,
        role: "student",
        admin: false,
        factsPersonId: 1206161,
      });
    });

    it("creates a portal account with no FACTS person", async () => {
      // The ~7 active staff FACTS will never track. Admin-created only — sync
      // can never mint one (ADR-0001, Amendment).
      const result = await createLink(
        { googleEmail: "teacher@tbs.org", factsPersonId: null, role: "staff", admin: false },
        { db, actor: admin },
      );

      expect(result).toMatchObject({ ok: true });
      expect(await resolveAccess("teacher@tbs.org", { db })).toMatchObject({
        factsPersonId: null,
        role: "staff",
      });
    });

    it("grants the admin flag independently of role", async () => {
      await createLink(
        { googleEmail: "principal@tbs.org", factsPersonId: null, role: "staff", admin: true },
        { db, actor: admin },
      );

      expect(await resolveAccess("principal@tbs.org", { db })).toMatchObject({ admin: true });
    });

    it("stores the login identity lowercased, whatever the admin typed", async () => {
      // resolveAccess normalizes on the way in; the write side has to agree, or
      // a hand-typed row would never match the login it was created for.
      await createLink(
        { googleEmail: "  27BenO@TBS.org  ", factsPersonId: null, role: "student", admin: false },
        { db, actor: admin },
      );

      expect(await resolveAccess("27beno@tbs.org", { db })).toMatchObject({ linked: true });
    });

    it("refuses a second row for a login that already has one", async () => {
      await createLink(
        { googleEmail: "staffer@tbs.org", factsPersonId: 1203006, role: "staff", admin: false },
        { db, actor: admin },
      );

      const result = await createLink(
        { googleEmail: "STAFFER@tbs.org", factsPersonId: 1203009, role: "student", admin: false },
        { db, actor: admin },
      );

      expect(result).toEqual({ ok: false, reason: "duplicate-email" });
      // The original row is untouched — a rejected create is not an edit.
      expect(await resolveAccess("staffer@tbs.org", { db })).toMatchObject({
        role: "staff",
        factsPersonId: 1203006,
      });
    });

    it("refuses an address outside the school domain", async () => {
      // Login is Workspace-only, so such a row could never resolve to anyone —
      // it would be a silent dead end in the allowlist.
      const result = await createLink(
        { googleEmail: "someone@gmail.com", factsPersonId: null, role: "staff", admin: false },
        { db, actor: admin },
      );

      expect(result).toEqual({ ok: false, reason: "not-school-domain" });
      expect(await db.select().from(identityLink)).toEqual([]);
    });

    it.each([
      ["a linked non-admin", teacher],
      ["an unlinked visitor", anonymous],
    ])("refuses %s", async (_label, actor) => {
      const result = await createLink(
        { googleEmail: "newkid@tbs.org", factsPersonId: null, role: "student", admin: false },
        { db, actor },
      );

      expect(result).toEqual({ ok: false, reason: "forbidden" });
      expect(await db.select().from(identityLink)).toEqual([]);
    });

    it("links to a FACTS person the FACTS snapshot has never seen", async () => {
      // The FACTS snapshot may be stale; refusing to link against it
      // would let a lagging sync block the office from granting access.
      const result = await createLink(
        { googleEmail: "newhire@tbs.org", factsPersonId: 999999, role: "staff", admin: false },
        { db, actor: admin },
      );

      expect(result).toMatchObject({ ok: true });
    });
  });

  describe("updateLink", () => {
    const seed = async () => {
      const result = await createLink(
        { googleEmail: "person@tbs.org", factsPersonId: 1206161, role: "student", admin: false },
        { db, actor: admin },
      );
      if (!result.ok) throw new Error(`seed failed: ${result.reason}`);
      return result.link.id;
    };

    it("changes the role a login resolves to", async () => {
      const id = await seed();

      const result = await updateLink(id, { role: "staff" }, { db, actor: admin });

      expect(result).toMatchObject({ ok: true });
      expect(await resolveAccess("person@tbs.org", { db })).toMatchObject({ role: "staff" });
    });

    it("grants and revokes the admin flag", async () => {
      const id = await seed();

      await updateLink(id, { admin: true }, { db, actor: admin });
      expect(await resolveAccess("person@tbs.org", { db })).toMatchObject({ admin: true });

      await updateLink(id, { admin: false }, { db, actor: admin });
      expect(await resolveAccess("person@tbs.org", { db })).toMatchObject({ admin: false });
    });

    it("re-points and clears the FACTS person", async () => {
      const id = await seed();

      await updateLink(id, { factsPersonId: 1203006 }, { db, actor: admin });
      expect(await resolveAccess("person@tbs.org", { db })).toMatchObject({
        factsPersonId: 1203006,
      });

      await updateLink(id, { factsPersonId: null }, { db, actor: admin });
      expect(await resolveAccess("person@tbs.org", { db })).toMatchObject({ factsPersonId: null });
    });

    it("leaves untouched fields alone", async () => {
      const id = await seed();

      await updateLink(id, { admin: true }, { db, actor: admin });

      expect(await resolveAccess("person@tbs.org", { db })).toEqual({
        linked: true,
        role: "student",
        admin: true,
        factsPersonId: 1206161,
      });
    });

    it("reports a row that isn't there", async () => {
      expect(await updateLink(404, { admin: true }, { db, actor: admin })).toEqual({
        ok: false,
        reason: "not-found",
      });
    });

    it.each([
      ["a linked non-admin", teacher],
      ["an unlinked visitor", anonymous],
    ])("refuses %s", async (_label, actor) => {
      const id = await seed();

      const result = await updateLink(id, { admin: true }, { db, actor });

      expect(result).toEqual({ ok: false, reason: "forbidden" });
      expect(await resolveAccess("person@tbs.org", { db })).toMatchObject({ admin: false });
    });
  });

  describe("parseRole", () => {
    it("accepts the vocabulary and nothing else", () => {
      expect(parseRole("student")).toBe("student");
      expect(parseRole("staff")).toBe("staff");
      // Whatever a form post or a hand-crafted request might carry.
      expect(parseRole("admin")).toBeNull();
      expect(parseRole("")).toBeNull();
      expect(parseRole(null)).toBeNull();
    });
  });

  describe("parseRowId", () => {
    it("reads an id the form actually sent", () => {
      expect(parseRowId("7")).toBe(7);
      expect(parseRowId(" 1206161 ")).toBe(1206161);
    });

    // The whole reason this exists: `Number(null)` is 0 and `Number.isInteger`
    // waves it through, so a field the browser never sent would address row 0
    // and the action would report success on a row nobody chose.
    it("refuses a field the form never sent", () => {
      expect(parseRowId(null)).toBeNull();
      expect(parseRowId(undefined)).toBeNull();
      expect(parseRowId("")).toBeNull();
      expect(parseRowId("   ")).toBeNull();
    });

    it("refuses anything that isn't a plain positive whole number", () => {
      expect(parseRowId("0")).toBeNull();
      expect(parseRowId("-3")).toBeNull();
      expect(parseRowId("1.5")).toBeNull();
      expect(parseRowId("abc")).toBeNull();
      // Number() would take these; ids are never written this way.
      expect(parseRowId("1e3")).toBeNull();
      expect(parseRowId("0x10")).toBeNull();
    });
  });

  describe("parseFactsPersonId", () => {
    // Blank is the deliberate "no FACTS person" — a null link is legitimate —
    // and must not share a fate with a typo.
    it("keeps blank separate from garbage", () => {
      expect(parseFactsPersonId("")).toEqual({ ok: true, value: null });
      expect(parseFactsPersonId(null)).toEqual({ ok: true, value: null });
      expect(parseFactsPersonId("1206161")).toEqual({ ok: true, value: 1206161 });
      expect(parseFactsPersonId("abc")).toEqual({ ok: false });
      expect(parseFactsPersonId("1e3")).toEqual({ ok: false });
    });
  });

  describe("listLinks", () => {
    it("is empty before anyone is linked", async () => {
      expect(await listLinks({ db })).toEqual([]);
    });

    it("names each account from the FACTS snapshot, in login order", async () => {
      await db.insert(factsPerson).values({
        personId: 1206161,
        firstName: "Benjamin",
        lastName: "Olson",
        lastSeenAt: new Date(),
      });
      await db.insert(identityLink).values([
        { googleEmail: "27beno@tbs.org", factsPersonId: 1206161, role: "student" },
        { googleEmail: "teacher@tbs.org", factsPersonId: null, role: "staff", admin: true },
      ]);

      expect(await listLinks({ db })).toMatchObject([
        { googleEmail: "27beno@tbs.org", factsName: "Benjamin Olson", role: "student" },
        // No FACTS person: the screen shows the login and nothing more.
        { googleEmail: "teacher@tbs.org", factsName: null, admin: true },
      ]);
    });

    it("shows a link whose FACTS person the snapshot hasn't got", async () => {
      await db.insert(identityLink).values({
        googleEmail: "newhire@tbs.org",
        factsPersonId: 999999,
        role: "staff",
      });

      expect(await listLinks({ db })).toMatchObject([
        { googleEmail: "newhire@tbs.org", factsPersonId: 999999, factsName: null },
      ]);
    });
  });
});
