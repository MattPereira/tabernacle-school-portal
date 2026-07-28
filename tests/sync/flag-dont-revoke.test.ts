import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { factsPerson, factsStaff, factsStudent } from "@/lib/db/schema";
import { resolveAccess } from "@/lib/identity";
import { sync } from "@/lib/sync";

import { createTestDb, type TestDb } from "../support/db";
import { fakeFacts, person, staffMember, student } from "../support/facts";
import { resetSync } from "./support";

describe("sync flags, never revokes", () => {
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

  const twoStudents = fakeFacts({
    students: [student(1), student(2)],
    staff: [staffMember(3)],
    people: [person(1, "Ann", "Alpha"), person(2, "Bob", "Beta", { contactEmail: "bob@tbs.org" }), person(3, "Cy", "Gamma")],
  });

  it("flags a departed person instead of deleting them", async () => {
    await sync({ db, facts: twoStudents });

    const result = await sync({
      db,
      facts: fakeFacts({
        students: [student(1)],
        staff: [staffMember(3)],
        people: [person(1, "Ann", "Alpha"), person(3, "Cy", "Gamma")],
      }),
    });

    expect(result).toMatchObject({ counts: { flagged: 2 } }); // the person and the student row
    expect(await db.select().from(factsStudent)).toHaveLength(2);
    const [departed] = await db.select().from(factsStudent).where(eq(factsStudent.studentId, 2));
    expect(departed.inactive).toBe(true);
    const [stillHere] = await db.select().from(factsStudent).where(eq(factsStudent.studentId, 1));
    expect(stillHere.inactive).toBe(false);
  });

  it("leaves access working for someone FACTS dropped", async () => {
    // The whole point of flag-don't-revoke: FACTS is not the kill switch, and
    // a sync must never be able to lock a person out (CONTEXT.md, Sync).
    await sync({ db, facts: twoStudents });

    await sync({
      db,
      facts: fakeFacts({
        students: [student(1)],
        staff: [staffMember(3)],
        people: [person(1, "Ann", "Alpha"), person(3, "Cy", "Gamma")],
      }),
    });

    await expect(resolveAccess("bob@tbs.org", { db })).resolves.toEqual({ kind: "student" });
  });

  it("un-flags a person who returns to FACTS", async () => {
    await sync({ db, facts: twoStudents });
    await sync({ db, facts: fakeFacts({ students: [student(1)], staff: [staffMember(3)], people: [person(1, "Ann", "Alpha"), person(3, "Cy", "Gamma")] }) });
    await sync({ db, facts: twoStudents });

    const [returned] = await db.select().from(factsStudent).where(eq(factsStudent.studentId, 2));
    expect(returned.inactive).toBe(false);
  });

  it("un-flags staff who return to FACTS, with their current profile", async () => {
    const returning = staffMember(3, { firstName: "Cy", lastName: "Gamma", department: "Office" });
    const staffed = fakeFacts({ staff: [returning], people: [person(3, "Cy", "Gamma")] });
    await sync({ db, facts: staffed });
    await sync({ db, facts: fakeFacts({ staff: [], people: [] }) });

    await sync({ db, facts: staffed });

    const [returned] = await db.select().from(factsStaff).where(eq(factsStaff.staffId, 3));
    expect(returned).toMatchObject({ inactive: false, lastName: "Gamma", department: "Office" });
  });

  it("counts only newly flagged rows, not the already-flagged backlog", async () => {
    await sync({ db, facts: twoStudents });
    const dropOne = fakeFacts({
      students: [student(1)],
      staff: [staffMember(3)],
      people: [person(1, "Ann", "Alpha"), person(3, "Cy", "Gamma")],
    });

    expect(await sync({ db, facts: dropOne })).toMatchObject({ counts: { flagged: 2 } });
    // Same shape again: nothing new left, so nothing new to report.
    expect(await sync({ db, facts: dropOne })).toMatchObject({ counts: { flagged: 0 } });
  });

  it("flags departed staff too", async () => {
    // Two on staff, so the run also shows the one who stayed is left alone.
    await sync({
      db,
      facts: fakeFacts({
        students: [student(1), student(2)],
        staff: [staffMember(3), staffMember(4)],
        people: [
          person(1, "Ann", "Alpha"),
          person(2, "Bob", "Beta"),
          person(3, "Cy", "Gamma"),
          person(4, "Di", "Delta"),
        ],
      }),
    });

    await sync({
      db,
      facts: fakeFacts({
        students: [student(1), student(2)],
        staff: [staffMember(4)],
        people: [person(1, "Ann", "Alpha"), person(2, "Bob", "Beta"), person(4, "Di", "Delta")],
      }),
    });

    const [departed] = await db.select().from(factsStaff).where(eq(factsStaff.staffId, 3));
    expect(departed.inactive).toBe(true);
    const [gammaPerson] = await db.select().from(factsPerson).where(eq(factsPerson.personId, 3));
    expect(gammaPerson.inactive).toBe(true);
    const [stayed] = await db.select().from(factsStaff).where(eq(factsStaff.staffId, 4));
    expect(stayed.inactive).toBe(false);
  });
});
