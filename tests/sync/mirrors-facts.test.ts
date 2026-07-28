import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { factsPerson, factsStaff, factsStudent } from "@/lib/db/schema";
import { sync } from "@/lib/sync";

import { createTestDb, type TestDb } from "../support/db";
import { fakeFacts, person, staffMember, student } from "../support/facts";
import { resetSync } from "./support";

describe("sync populates the FACTS snapshot", () => {
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

  it("pulls students, staff and their people into the FACTS snapshot", async () => {
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

    expect(await db.select().from(factsPerson)).toEqual([
      expect.objectContaining({
        personId: 1206161,
        firstName: "Benjamin",
        lastName: "Olson",
        contactEmail: "parent@gmail.com",
        inactive: false,
      }),
      expect.objectContaining({ personId: 1203006, firstName: "Jane", lastName: "Doe" }),
    ]);
    expect(await db.select().from(factsStudent)).toEqual([
      expect.objectContaining({ studentId: 1206161, gradeLevel: "7", status: "Enrolled" }),
    ]);
    expect(await db.select().from(factsStaff)).toEqual([
      expect.objectContaining({ staffId: 1203006, inactive: false }),
    ]);
  });

  it("stores the staff profile fields FACTS owns", async () => {
    const facts = fakeFacts({
      staff: [
        staffMember(10, { firstName: "Jane", middleName: "Q", lastName: "Doe", department: "Middle School" }),
        staffMember(11, { firstName: "Ada", lastName: "Byron" }),
      ],
      people: [person(10, "Jane", "Doe", "jdoe@tbs.org"), person(11, "Ada", "Byron")],
    });

    await sync({ db, facts });

    expect(await db.select().from(factsStaff)).toEqual([
      expect.objectContaining({
        staffId: 10,
        firstName: "Jane",
        middleName: "Q",
        lastName: "Doe",
        department: "Middle School",
      }),
      expect.objectContaining({
        staffId: 11,
        firstName: "Ada",
        middleName: null,
        lastName: "Byron",
        department: null,
      }),
    ]);
  });

  it("overwrites staff profile fields on the next run — FACTS always wins", async () => {
    const first = staffMember(10, { firstName: "Jane", middleName: "Q", lastName: "Doe", department: "Middle School" });
    await sync({ db, facts: fakeFacts({ staff: [first], people: [person(10, "Jane", "Doe")] }) });

    await sync({
      db,
      facts: fakeFacts({
        staff: [staffMember(10, { firstName: "Jane", lastName: "Doe-Smith" })],
        people: [person(10, "Jane", "Doe-Smith")],
      }),
    });

    const [staffRow] = await db.select().from(factsStaff).where(eq(factsStaff.staffId, 10));
    expect(staffRow).toMatchObject({
      firstName: "Jane",
      middleName: null,
      lastName: "Doe-Smith",
      department: null,
    });
  });

  it("reads people once for a person who is both student and staff", async () => {
    // The two populations share the personId space, so the join must dedupe
    // rather than include the same person twice in the FACTS snapshot.
    const facts = fakeFacts({
      students: [student(500)],
      staff: [staffMember(500)],
      people: [person(500, "Sam", "Reyes")],
    });

    const result = await sync({ db, facts });

    expect(result).toMatchObject({ counts: { people: 1, students: 1, staff: 1 } });
    expect(await db.select().from(factsPerson)).toHaveLength(1);
  });

  it("stores a student in the FACTS snapshot whose /People row is missing", async () => {
    // FACTS has students with no matching person record. That's their data
    // wart to fix; it must not cost us the rest of the sync.
    const facts = fakeFacts({ students: [student(777)], people: [] });

    const result = await sync({ db, facts });

    expect(result.outcome).toBe("applied");
    expect(await db.select().from(factsStudent)).toHaveLength(1);
    expect(await db.select().from(factsPerson)).toHaveLength(0);
  });

  it("overwrites snapshot fields on the next run — FACTS always wins", async () => {
    await sync({ db, facts: fakeFacts({ students: [student(42, "5")], people: [person(42, "Al", "Brown", "old@x.com")] }) });

    await sync({
      db,
      facts: fakeFacts({
        students: [student(42, "6")],
        people: [person(42, "Alastair", "Brown-Smith", "new@x.com")],
      }),
    });

    const [snapshotPerson] = await db.select().from(factsPerson).where(eq(factsPerson.personId, 42));
    expect(snapshotPerson).toMatchObject({
      firstName: "Alastair",
      lastName: "Brown-Smith",
      contactEmail: "new@x.com",
    });
    const [snapshotStudent] = await db.select().from(factsStudent);
    expect(snapshotStudent).toMatchObject({ gradeLevel: "6" });
  });
});
