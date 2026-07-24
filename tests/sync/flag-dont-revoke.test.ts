import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { identityLink, mirrorPerson, mirrorStaff, mirrorStudent } from "@/lib/db/schema";
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
    people: [person(1, "Ann", "Alpha"), person(2, "Bob", "Beta"), person(3, "Cy", "Gamma")],
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
    expect(await db.select().from(mirrorStudent)).toHaveLength(2);
    const [departed] = await db.select().from(mirrorStudent).where(eq(mirrorStudent.studentId, 2));
    expect(departed.inactive).toBe(true);
    const [stillHere] = await db.select().from(mirrorStudent).where(eq(mirrorStudent.studentId, 1));
    expect(stillHere.inactive).toBe(false);
  });

  it("leaves login working for someone FACTS dropped", async () => {
    // The whole point of flag-don't-revoke: FACTS is not the kill switch, and
    // a sync must never be able to lock a person out (CONTEXT.md, Sync).
    await db.insert(identityLink).values({
      googleEmail: "bob@tbs.org",
      factsPersonId: 2,
      role: "student",
    });
    await sync({ db, facts: twoStudents });

    await sync({
      db,
      facts: fakeFacts({
        students: [student(1)],
        staff: [staffMember(3)],
        people: [person(1, "Ann", "Alpha"), person(3, "Cy", "Gamma")],
      }),
    });

    expect(await resolveAccess("bob@tbs.org", { db })).toMatchObject({
      linked: true,
      role: "student",
      factsPersonId: 2,
    });
  });

  it("never deletes or edits identity_link rows", async () => {
    await db.insert(identityLink).values([
      { googleEmail: "bob@tbs.org", factsPersonId: 2, role: "student", admin: true },
      { googleEmail: "ghost@tbs.org", factsPersonId: 999999, role: "staff" },
    ]);
    const before = await db.select().from(identityLink);

    await sync({ db, facts: twoStudents });
    await sync({ db, facts: fakeFacts({ students: [student(1)], people: [person(1, "Ann", "Alpha")] }) });

    expect(await db.select().from(identityLink)).toEqual(before);
  });

  it("never mints a link row for an unlinked FACTS person", async () => {
    await sync({ db, facts: twoStudents });

    expect(await db.select().from(identityLink)).toHaveLength(0);
  });

  it("un-flags a person who returns to FACTS", async () => {
    await sync({ db, facts: twoStudents });
    await sync({ db, facts: fakeFacts({ students: [student(1)], staff: [staffMember(3)], people: [person(1, "Ann", "Alpha"), person(3, "Cy", "Gamma")] }) });
    await sync({ db, facts: twoStudents });

    const [returned] = await db.select().from(mirrorStudent).where(eq(mirrorStudent.studentId, 2));
    expect(returned.inactive).toBe(false);
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

    const [departed] = await db.select().from(mirrorStaff).where(eq(mirrorStaff.staffId, 3));
    expect(departed.inactive).toBe(true);
    const [gammaPerson] = await db.select().from(mirrorPerson).where(eq(mirrorPerson.personId, 3));
    expect(gammaPerson.inactive).toBe(true);
    const [stayed] = await db.select().from(mirrorStaff).where(eq(mirrorStaff.staffId, 4));
    expect(stayed.inactive).toBe(false);
  });
});
