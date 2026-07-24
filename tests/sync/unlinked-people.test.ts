import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { identityLink } from "@/lib/db/schema";
import { looksLikeName, sync, type SyncResult } from "@/lib/sync";

import { createTestDb, type TestDb } from "../support/db";
import { fakeFacts, person, staffMember, student } from "../support/facts";
import { resetSync } from "./support";

const unlinkedOf = (result: SyncResult) =>
  result.outcome === "applied" ? result.unlinkedPeople : [];

describe("sync computes the unlinked-people list", () => {
  let harness: TestDb;
  let db: TestDb["db"];

  beforeAll(async () => {
    harness = await createTestDb();
    db = harness.db;
  });

  afterAll(async () => {
    await harness.close();
  });

  beforeEach(() => resetSync(db));

  const facts = fakeFacts({
    students: [student(1), student(2)],
    staff: [staffMember(3)],
    people: [
      person(1, "Benjamin", "Olson"),
      person(2, "Bob", "Beta"),
      person(3, "Jane", "Doe"),
    ],
  });

  it("lists every mirrored person with no link row", async () => {
    await db.insert(identityLink).values({
      googleEmail: "bob@tbs.org",
      factsPersonId: 2,
      role: "student",
    });

    const result = await sync({ db, facts });

    expect(result).toMatchObject({ counts: { unlinked: 2 } });
    expect(unlinkedOf(result).map((p) => p.personId).sort()).toEqual([1, 3]);
  });

  it("is empty once everyone is linked", async () => {
    await db.insert(identityLink).values([
      { googleEmail: "a@tbs.org", factsPersonId: 1, role: "student" },
      { googleEmail: "b@tbs.org", factsPersonId: 2, role: "student" },
      { googleEmail: "c@tbs.org", factsPersonId: 3, role: "staff" },
    ]);

    const result = await sync({ db, facts });

    expect(unlinkedOf(result)).toEqual([]);
    expect(result).toMatchObject({ counts: { unlinked: 0 } });
  });

  it("suggests a portal account whose address looks like the person's name", async () => {
    // A portal account with no FACTS person is exactly the pool worth
    // suggesting from — the admin confirms the pairing in one click.
    await db.insert(identityLink).values([
      { googleEmail: "27beno@tbs.org", factsPersonId: null, role: "student" },
      { googleEmail: "jdoe@tbs.org", factsPersonId: null, role: "staff" },
      { googleEmail: "office@tbs.org", factsPersonId: null, role: "staff" },
    ]);

    const result = await sync({ db, facts });
    const byId = new Map(unlinkedOf(result).map((p) => [p.personId, p]));

    // The row id travels with the address: the admin's one click points that
    // existing account at this FACTS person.
    expect(byId.get(1)?.suggestions).toEqual([
      { linkId: expect.any(Number), googleEmail: "27beno@tbs.org" },
    ]);
    expect(byId.get(3)?.suggestions.map((s) => s.googleEmail)).toEqual(["jdoe@tbs.org"]);
    // Nothing plausible for Bob Beta; a non-person account suggests nobody.
    expect(byId.get(2)?.suggestions).toEqual([]);
  });

  it("never suggests an address that is already linked", async () => {
    await db.insert(identityLink).values({
      googleEmail: "27beno@tbs.org",
      factsPersonId: 999,
      role: "student",
    });

    const result = await sync({ db, facts });

    expect(unlinkedOf(result).flatMap((p) => p.suggestions)).toEqual([]);
  });

  it("excludes people FACTS has dropped", async () => {
    // A flagged person is still mirrored, but nobody needs to be linked to
    // them — the list is the admin's work queue, not a census.
    await sync({
      db,
      facts: fakeFacts({
        students: [student(1), student(2)],
        staff: [staffMember(3), staffMember(4)],
        people: [
          person(1, "Benjamin", "Olson"),
          person(2, "Bob", "Beta"),
          person(3, "Jane", "Doe"),
          person(4, "Kit", "Ng"),
        ],
      }),
    });

    const result = await sync({
      db,
      facts: fakeFacts({
        students: [student(1), student(2)],
        staff: [staffMember(4)],
        people: [person(1, "Benjamin", "Olson"), person(2, "Bob", "Beta"), person(4, "Kit", "Ng")],
      }),
    });

    expect(unlinkedOf(result).map((p) => p.personId).sort()).toEqual([1, 2, 4]);
  });
});

describe("looksLikeName", () => {
  const olson = { firstName: "Benjamin", lastName: "Olson" };

  it.each([
    ["27beno@tbs.org", "prefix of first + initial of last, digits ignored"],
    ["benjaminolson@tbs.org", "both names in full"],
    ["bolson@tbs.org", "initial of first + last"],
    ["olsonb@tbs.org", "last + initial of first"],
    ["ben.olson@tbs.org", "punctuation ignored"],
  ])("matches %s (%s)", (email) => {
    expect(looksLikeName(email, olson)).toBe(true);
  });

  it.each([
    ["office@tbs.org", "a non-person account"],
    ["jdoe@tbs.org", "a different person entirely"],
    ["olsonbenjaminx@tbs.org", "trailing junk beyond either name"],
    ["27@tbs.org", "no letters at all"],
  ])("rejects %s (%s)", (email) => {
    expect(looksLikeName(email, olson)).toBe(false);
  });

  it("rejects a person FACTS has no name for", () => {
    expect(looksLikeName("anything@tbs.org", { firstName: null, lastName: null })).toBe(false);
  });
});
