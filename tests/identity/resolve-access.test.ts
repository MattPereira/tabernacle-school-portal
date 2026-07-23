import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { identityLink } from "@/lib/db/schema";
import { resolveAccess } from "@/lib/identity";

import { createTestDb, type TestDb } from "../support/db";

describe("resolveAccess", () => {
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
  });

  it("resolves a linked login to its portal-owned role and admin flag", async () => {
    await db.insert(identityLink).values({
      googleEmail: "27beno@tbs.org",
      factsPersonId: 1206161,
      role: "student",
      admin: false,
    });

    const access = await resolveAccess("27beno@tbs.org", { db });

    expect(access).toEqual({
      linked: true,
      role: "student",
      admin: false,
      factsPersonId: 1206161,
    });
  });

  it("reports a tbs.org login with no link row as unlinked", async () => {
    // office@, class accounts and devices authenticate fine — the link table is
    // the allowlist, so they land on the holding page rather than an error.
    const access = await resolveAccess("office@tbs.org", { db });

    expect(access).toEqual({ linked: false });
  });

  it("resolves a link row that has no FACTS person", async () => {
    // ~7 active staff (incl. a 3rd-grade teacher) exist in Workspace but not in
    // FACTS and never will. A row is a portal account, optionally linked.
    await db.insert(identityLink).values({
      googleEmail: "teacher@tbs.org",
      factsPersonId: null,
      role: "staff",
    });

    const access = await resolveAccess("teacher@tbs.org", { db });

    expect(access).toEqual({
      linked: true,
      role: "staff",
      admin: false,
      factsPersonId: null,
    });
  });

  it("surfaces the admin flag independently of role", async () => {
    await db.insert(identityLink).values({
      googleEmail: "principal@tbs.org",
      factsPersonId: 1203006,
      role: "staff",
      admin: true,
    });

    const access = await resolveAccess("principal@tbs.org", { db });

    expect(access).toEqual({
      linked: true,
      role: "staff",
      admin: true,
      factsPersonId: 1203006,
    });
  });

  it("matches a login whatever casing the OAuth provider hands back", async () => {
    // The allowlist is seeded lowercase from the Workspace export; the gate must
    // not turn someone away over casing it doesn't control.
    await db.insert(identityLink).values({
      googleEmail: "27beno@tbs.org",
      factsPersonId: 1206161,
      role: "student",
    });

    const access = await resolveAccess("  27BenO@TBS.org  ", { db });

    expect(access).toEqual({
      linked: true,
      role: "student",
      admin: false,
      factsPersonId: 1206161,
    });
  });

  it("refuses a second link row for the same login identity", async () => {
    // One login can never resolve to two people — uniqueness is on google_email.
    await db.insert(identityLink).values({
      googleEmail: "staffer@tbs.org",
      factsPersonId: 1203006,
      role: "staff",
    });

    await expect(
      db.insert(identityLink).values({
        googleEmail: "staffer@tbs.org",
        factsPersonId: 1203009,
        role: "student",
      }),
    ).rejects.toThrow();

    expect(await resolveAccess("staffer@tbs.org", { db })).toMatchObject({
      role: "staff",
      factsPersonId: 1203006,
    });
  });

  it("lets two logins resolve to the same FACTS person", async () => {
    // facts_person_id is deliberately non-unique: a staffer's spare account is
    // a second portal account for one person, which is fine.
    await db.insert(identityLink).values([
      { googleEmail: "jane@tbs.org", factsPersonId: 1203006, role: "staff" },
      { googleEmail: "j.doe@tbs.org", factsPersonId: 1203006, role: "staff" },
    ]);

    expect(await resolveAccess("jane@tbs.org", { db })).toMatchObject({ factsPersonId: 1203006 });
    expect(await resolveAccess("j.doe@tbs.org", { db })).toMatchObject({ factsPersonId: 1203006 });
  });
});
