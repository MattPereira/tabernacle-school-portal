import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { factsGradeLevel, factsPerson, factsStaff, factsStudent, syncRun } from "@/lib/db/schema";
import { sync } from "@/lib/sync";

import { createTestDb, type TestDb } from "../support/db";
import { fakeFacts, gradeLevel, person, staffMember, student } from "../support/facts";
import { resetSync } from "./support";

describe("sync applies all-or-nothing", () => {
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

  it("leaves the FACTS snapshot untouched when a write fails mid-sync", async () => {
    await sync({
      db,
      facts: fakeFacts({
        students: [student(1, "3")],
        staff: [staffMember(2, { firstName: "Bob", lastName: "Beta", department: "Office" })],
        people: [person(1, "Ann", "Alpha"), person(2, "Bob", "Beta")],
      }),
    });

    const before = {
      people: await db.select().from(factsPerson),
      students: await db.select().from(factsStudent),
      staff: await db.select().from(factsStaff),
    };

    // People write cleanly, then the student batch trips Postgres: a duplicate
    // key in one ON CONFLICT statement can't affect the same row twice. The
    // point is that the *earlier* people write must roll back with it.
    const result = await sync({
      db,
      facts: fakeFacts({
        students: [student(1, "4"), student(1, "4")],
        staff: [staffMember(2, { firstName: "CHANGED", lastName: "CHANGED", department: "CHANGED" })],
        people: [person(1, "CHANGED", "CHANGED"), person(2, "CHANGED", "CHANGED")],
      }),
    });

    expect(result.outcome).toBe("failed");
    expect(await db.select().from(factsPerson)).toEqual(before.people);
    expect(await db.select().from(factsStudent)).toEqual(before.students);
    expect(await db.select().from(factsStaff)).toEqual(before.staff);
  });

  it("keeps the previous staff profiles when the staff write is what fails", async () => {
    // Staff is applied after people and students, so a trip there is the case
    // where earlier writes have already landed inside the transaction.
    await sync({
      db,
      facts: fakeFacts({
        students: [student(1, "3")],
        staff: [staffMember(2, { firstName: "Bob", lastName: "Beta", department: "Office" })],
        people: [person(1, "Ann", "Alpha"), person(2, "Bob", "Beta")],
      }),
    });

    const before = {
      people: await db.select().from(factsPerson),
      students: await db.select().from(factsStudent),
      staff: await db.select().from(factsStaff),
    };

    const changed = staffMember(2, { firstName: "CHANGED", lastName: "CHANGED", department: "CHANGED" });
    const result = await sync({
      db,
      facts: fakeFacts({
        students: [student(1, "4")],
        staff: [changed, changed],
        people: [person(1, "CHANGED", "CHANGED"), person(2, "CHANGED", "CHANGED")],
      }),
    });

    expect(result.outcome).toBe("failed");
    expect(await db.select().from(factsPerson)).toEqual(before.people);
    expect(await db.select().from(factsStudent)).toEqual(before.students);
    expect(await db.select().from(factsStaff)).toEqual(before.staff);
  });

  it("rolls the whole snapshot back when the grade-level write is what fails", async () => {
    // The newest table joins the same transaction as the rest: it is written
    // last, so a trip here has to undo everything before it.
    await sync({
      db,
      facts: fakeFacts({
        students: [student(1, "3")],
        staff: [staffMember(2, { firstName: "Bob", lastName: "Beta" })],
        people: [person(1, "Ann", "Alpha"), person(2, "Bob", "Beta")],
        gradeLevels: [gradeLevel("03", 7)],
      }),
    });

    const before = {
      people: await db.select().from(factsPerson),
      students: await db.select().from(factsStudent),
      staff: await db.select().from(factsStaff),
      gradeLevels: await db.select().from(factsGradeLevel),
    };

    const result = await sync({
      db,
      facts: fakeFacts({
        students: [student(1, "4")],
        staff: [staffMember(2, { firstName: "CHANGED", lastName: "CHANGED" })],
        people: [person(1, "CHANGED", "CHANGED"), person(2, "CHANGED", "CHANGED")],
        gradeLevels: [gradeLevel("03", 8), gradeLevel("03", 8)],
      }),
    });

    expect(result.outcome).toBe("failed");
    expect(await db.select().from(factsPerson)).toEqual(before.people);
    expect(await db.select().from(factsStudent)).toEqual(before.students);
    expect(await db.select().from(factsStaff)).toEqual(before.staff);
    expect(await db.select().from(factsGradeLevel)).toEqual(before.gradeLevels);
  });

  it("records a sync_run for a failed run, outside the rolled-back transaction", async () => {
    const result = await sync({ db, facts: fakeFacts({ failOn: "students" }) });

    expect(result).toMatchObject({ outcome: "failed", detail: "FACTS students read failed" });

    const [run] = await db.select().from(syncRun);
    expect(run).toMatchObject({ outcome: "failed", detail: "FACTS students read failed" });
  });

  it("writes nothing when FACTS fails before any data arrives", async () => {
    await sync({ db, facts: fakeFacts({ failOn: "people", students: [student(1)] }) });

    expect(await db.select().from(factsStudent)).toHaveLength(0);
    expect(await db.select().from(factsPerson)).toHaveLength(0);
  });
});
