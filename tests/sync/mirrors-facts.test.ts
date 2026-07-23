import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { mirrorPerson, mirrorStaff, mirrorStudent } from "@/lib/db/schema";
import { sync } from "@/lib/sync";

import { createTestDb, type TestDb } from "../support/db";
import { fakeFacts, person, staffMember, student } from "../support/facts";
import { resetSync } from "./support";

describe("sync mirrors FACTS", () => {
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

  it("pulls students, staff and their people into the mirror", async () => {
    const facts = fakeFacts({
      students: [student(1206161, "7")],
      staff: [staffMember(1203006)],
      people: [
        person(1206161, "Benjamin", "Olson", "parent@gmail.com"),
        person(1203006, "Jane", "Doe"),
      ],
    });

    const result = await sync({ db, facts });

    expect(result.outcome).toBe("applied");
    expect(result).toMatchObject({ counts: { people: 2, students: 1, staff: 1 } });

    expect(await db.select().from(mirrorPerson)).toEqual([
      expect.objectContaining({
        personId: 1206161,
        firstName: "Benjamin",
        lastName: "Olson",
        contactEmail: "parent@gmail.com",
        inactive: false,
      }),
      expect.objectContaining({ personId: 1203006, firstName: "Jane", lastName: "Doe" }),
    ]);
    expect(await db.select().from(mirrorStudent)).toEqual([
      expect.objectContaining({ studentId: 1206161, gradeLevel: "7", status: "Enrolled" }),
    ]);
    expect(await db.select().from(mirrorStaff)).toEqual([
      expect.objectContaining({ staffId: 1203006, inactive: false }),
    ]);
  });

  it("reads people once for a person who is both student and staff", async () => {
    // The two populations share the personId space, so the join must dedupe
    // rather than mirror the same person twice.
    const facts = fakeFacts({
      students: [student(500)],
      staff: [staffMember(500)],
      people: [person(500, "Sam", "Reyes")],
    });

    const result = await sync({ db, facts });

    expect(result).toMatchObject({ counts: { people: 1, students: 1, staff: 1 } });
    expect(await db.select().from(mirrorPerson)).toHaveLength(1);
  });

  it("mirrors a student whose /People row is missing", async () => {
    // FACTS has students with no matching person record. That's their data
    // wart to fix; it must not cost us the rest of the sync.
    const facts = fakeFacts({ students: [student(777)], people: [] });

    const result = await sync({ db, facts });

    expect(result.outcome).toBe("applied");
    expect(await db.select().from(mirrorStudent)).toHaveLength(1);
    expect(await db.select().from(mirrorPerson)).toHaveLength(0);
  });

  it("overwrites mirrored fields on the next run — FACTS always wins", async () => {
    await sync({ db, facts: fakeFacts({ students: [student(42, "5")], people: [person(42, "Al", "Brown", "old@x.com")] }) });

    await sync({
      db,
      facts: fakeFacts({
        students: [student(42, "6")],
        people: [person(42, "Alastair", "Brown-Smith", "new@x.com")],
      }),
    });

    const [mirrored] = await db.select().from(mirrorPerson).where(eq(mirrorPerson.personId, 42));
    expect(mirrored).toMatchObject({
      firstName: "Alastair",
      lastName: "Brown-Smith",
      contactEmail: "new@x.com",
    });
    const [enrolled] = await db.select().from(mirrorStudent);
    expect(enrolled).toMatchObject({ gradeLevel: "6" });
  });
});
