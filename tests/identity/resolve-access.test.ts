import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { factsPerson, factsStaff, factsStudent } from "@/lib/db/schema";
import { resolveAccess } from "@/lib/identity";

import { createTestDb, type TestDb } from "../support/db";

describe("resolveAccess", () => {
  let harness: TestDb;
  let db: TestDb["db"];
  const seenAt = new Date("2026-07-27T00:00:00Z");

  beforeAll(async () => {
    harness = await createTestDb();
    db = harness.db;
  });

  afterAll(async () => {
    await harness.close();
  });

  beforeEach(async () => {
    await db.delete(factsStaff);
    await db.delete(factsStudent);
    await db.delete(factsPerson);
  });

  async function person(id: number, contactEmail: string, inactive = false) {
    await db.insert(factsPerson).values({ personId: id, contactEmail, inactive, lastSeenAt: seenAt });
  }

  it("grants exactly one staff contact-email match", async () => {
    await person(1, "staff@tbs.org");
    await db.insert(factsStaff).values({ staffId: 1, lastSeenAt: seenAt });

    await expect(resolveAccess("staff@tbs.org", { db })).resolves.toEqual({ kind: "staff" });
  });

  it("normalizes trim and casing only", async () => {
    await person(1, "staff+portal@tbs.org");
    await db.insert(factsStaff).values({ staffId: 1, lastSeenAt: seenAt });

    await expect(resolveAccess("  STAFF+PORTAL@TBS.ORG  ", { db })).resolves.toEqual({ kind: "staff" });
    await expect(resolveAccess("staff@tbs.org", { db })).resolves.toEqual({ kind: "unmatched" });
    await expect(resolveAccess("staffportal@tbs.org", { db })).resolves.toEqual({ kind: "unmatched" });
  });

  it("rejects identities outside the school domain", async () => {
    await person(1, "staff@gmail.com");
    await db.insert(factsStaff).values({ staffId: 1, lastSeenAt: seenAt });

    await expect(resolveAccess("staff@gmail.com", { db })).resolves.toEqual({ kind: "unmatched" });
  });

  it("returns student-only for exactly one student match", async () => {
    await person(1, "student@tbs.org");
    await db.insert(factsStudent).values({ studentId: 1, lastSeenAt: seenAt });

    await expect(resolveAccess("student@tbs.org", { db })).resolves.toEqual({ kind: "student" });
  });

  it("fails closed for no match and same-role ambiguity", async () => {
    await expect(resolveAccess("missing@tbs.org", { db })).resolves.toEqual({ kind: "unmatched" });

    await person(1, "shared@tbs.org");
    await person(2, "shared@tbs.org");
    await db.insert(factsStaff).values([
      { staffId: 1, lastSeenAt: seenAt },
      { staffId: 2, lastSeenAt: seenAt },
    ]);

    await expect(resolveAccess("shared@tbs.org", { db })).resolves.toEqual({ kind: "unmatched" });
  });

  it("permanently prefers a unique staff match over student matches", async () => {
    await person(1, "family@tbs.org");
    await person(2, "family@tbs.org");
    await person(3, "family@tbs.org");
    await db.insert(factsStaff).values({ staffId: 1, lastSeenAt: seenAt });
    await db.insert(factsStudent).values([
      { studentId: 2, lastSeenAt: seenAt },
      { studentId: 3, lastSeenAt: seenAt },
    ]);

    await expect(resolveAccess("family@tbs.org", { db })).resolves.toEqual({ kind: "staff" });
  });

  it("matches inactive snapshot rows in every table", async () => {
    await person(1, "staff@tbs.org", true);
    await db.insert(factsStaff).values({ staffId: 1, inactive: true, lastSeenAt: seenAt });
    await expect(resolveAccess("staff@tbs.org", { db })).resolves.toEqual({ kind: "staff" });

    await person(2, "student@tbs.org", true);
    await db.insert(factsStudent).values({ studentId: 2, inactive: true, lastSeenAt: seenAt });
    await expect(resolveAccess("student@tbs.org", { db })).resolves.toEqual({ kind: "student" });
  });
});
