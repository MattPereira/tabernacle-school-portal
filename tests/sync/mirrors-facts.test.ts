import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { factsGradeLevel, factsPerson, factsStaff, factsStudent } from "@/lib/db/schema";
import { sync } from "@/lib/sync";

import { createTestDb, type TestDb } from "../support/db";
import { fakeFacts, gradeLevel, homeroom, person, staffMember, student } from "../support/facts";
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
        person(1206161, "Benjamin", "Olson", { contactEmail: "parent@gmail.com" }),
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
      people: [person(10, "Jane", "Doe", { contactEmail: "jdoe@tbs.org" }), person(11, "Ada", "Byron")],
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

  it("stores the person picture filename FACTS owns", async () => {
    const facts = fakeFacts({
      staff: [staffMember(10), staffMember(11)],
      people: [
        person(10, "Jane", "Doe", { contactEmail: "jdoe@tbs.org", pathToPicture: "1203006.jpg" }),
        person(11, "Ada", "Byron"),
      ],
    });

    await sync({ db, facts });

    expect(await db.select().from(factsPerson)).toEqual([
      expect.objectContaining({ personId: 10, pathToPicture: "1203006.jpg" }),
      expect.objectContaining({ personId: 11, pathToPicture: null }),
    ]);
  });

  it("overwrites a picture filename that FACTS has cleared", async () => {
    await sync({
      db,
      facts: fakeFacts({ staff: [staffMember(10)], people: [person(10, "Jane", "Doe", { pathToPicture: "old.jpg" })] }),
    });

    await sync({
      db,
      facts: fakeFacts({ staff: [staffMember(10)], people: [person(10, "Jane", "Doe")] }),
    });

    const [snapshotPerson] = await db.select().from(factsPerson).where(eq(factsPerson.personId, 10));
    expect(snapshotPerson).toMatchObject({ pathToPicture: null });
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

  it("stores the enrolment date and the birthdate FACTS owns", async () => {
    const facts = fakeFacts({
      students: [student(1206161, "7", { enrolledSince: "2016-05-26" })],
      people: [person(1206161, "Benjamin", "Olson", { birthdate: "2011-04-02" })],
    });

    await sync({ db, facts });

    expect(await db.select().from(factsStudent)).toEqual([
      expect.objectContaining({ enrolledSince: "2016-05-26" }),
    ]);
    expect(await db.select().from(factsPerson)).toEqual([
      expect.objectContaining({ birthdate: "2011-04-02" }),
    ]);
  });

  it("attaches each student's homeroom to their student row", async () => {
    // Homeroom is 1:1 with the student, so it lands as columns rather than a
    // table of its own (#54).
    const facts = fakeFacts({
      students: [student(1206161, "7"), student(1206162, "7")],
      homerooms: [homeroom(1206161, { homeroom: "07 Rivera", room: "12", staffId: 1203006 })],
      staff: [staffMember(1203006, { firstName: "Ana", lastName: "Rivera" })],
      people: [person(1206161, "Benjamin", "Olson"), person(1203006, "Ana", "Rivera")],
    });

    await sync({ db, facts });

    expect(await db.select().from(factsStudent)).toEqual([
      expect.objectContaining({
        studentId: 1206161,
        homeroom: "07 Rivera",
        room: "12",
        homeroomStaffId: 1203006,
      }),
      // 62 of 536 enrolled students have no homeroom row at all (#54).
      expect.objectContaining({ studentId: 1206162, homeroom: null, room: null, homeroomStaffId: null }),
    ]);
  });

  it("reads the homeroom teacher's person row even when they are not active staff", async () => {
    // One homeroom is held by a teacher FACTS no longer marks active. They are
    // absent from the staff fetch, so their name only arrives if the homeroom
    // staff ids join the people batch.
    const facts = fakeFacts({
      students: [student(1206161, "7")],
      homerooms: [homeroom(1206161, { homeroom: "07 Rivera", staffId: 999 })],
      staff: [],
      people: [person(1206161, "Benjamin", "Olson"), person(999, "Ana", "Rivera")],
    });

    const result = await sync({ db, facts });

    expect(result).toMatchObject({ counts: { people: 2, staff: 0 } });
    expect(await db.select().from(factsPerson)).toEqual([
      expect.objectContaining({ personId: 1206161 }),
      expect.objectContaining({ personId: 999, firstName: "Ana" }),
    ]);
  });

  it("ignores a homeroom for a student who is not in the enrolled population", async () => {
    // The homeroom endpoint can't be filtered, so a row for someone the roster
    // fetch didn't return must not invent a student.
    const facts = fakeFacts({
      students: [student(1206161, "7")],
      homerooms: [homeroom(1206161), homeroom(404, { homeroom: "08 Ghost" })],
      people: [],
    });

    await sync({ db, facts });

    expect(await db.select().from(factsStudent)).toEqual([
      expect.objectContaining({ studentId: 1206161 }),
    ]);
  });

  it("clears a homeroom FACTS has taken away — FACTS always wins", async () => {
    await sync({
      db,
      facts: fakeFacts({
        students: [student(1206161, "7")],
        homerooms: [homeroom(1206161, { homeroom: "07 Rivera", room: "12", staffId: 1203006 })],
        people: [],
      }),
    });

    await sync({ db, facts: fakeFacts({ students: [student(1206161, "7")], homerooms: [], people: [] }) });

    expect(await db.select().from(factsStudent)).toEqual([
      expect.objectContaining({ homeroom: null, room: null, homeroomStaffId: null }),
    ]);
  });

  it("stores the school's grade levels in the school's own order", async () => {
    const facts = fakeFacts({
      gradeLevels: [gradeLevel("K", 4), gradeLevel("PS", 1), gradeLevel("01", 5)],
      people: [],
    });

    await sync({ db, facts });

    expect(await db.select().from(factsGradeLevel)).toEqual([
      expect.objectContaining({ gradeLevel: "K", sortOrder: 4, inactive: false }),
      expect.objectContaining({ gradeLevel: "PS", sortOrder: 1 }),
      expect.objectContaining({ gradeLevel: "01", sortOrder: 5 }),
    ]);
  });

  it("overwrites a grade level's sort order on the next run", async () => {
    await sync({ db, facts: fakeFacts({ gradeLevels: [gradeLevel("K", 4)], people: [] }) });

    await sync({ db, facts: fakeFacts({ gradeLevels: [gradeLevel("K", 3)], people: [] }) });

    expect(await db.select().from(factsGradeLevel)).toEqual([
      expect.objectContaining({ gradeLevel: "K", sortOrder: 3 }),
    ]);
  });

  it("overwrites snapshot fields on the next run — FACTS always wins", async () => {
    await sync({ db, facts: fakeFacts({ students: [student(42, "5")], people: [person(42, "Al", "Brown", { contactEmail: "old@x.com" })] }) });

    await sync({
      db,
      facts: fakeFacts({
        students: [student(42, "6")],
        people: [person(42, "Alastair", "Brown-Smith", { contactEmail: "new@x.com" })],
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
