import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { listStudents } from "@/lib/students";
import { sync } from "@/lib/sync";

import { createTestDb, type TestDb } from "../support/db";
import { fakeFacts, homeroom, person, student } from "../support/facts";
import { resetSync } from "../sync/support";

describe("listStudents", () => {
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

  it("returns the enrolled population read from the snapshot", async () => {
    await sync({
      db,
      facts: fakeFacts({
        students: [student(1206161, "07")],
        homerooms: [homeroom(1206161, { homeroom: "07 Rivera", room: "12", staffId: 500 })],
        people: [person(1206161, "Benjamin", "Olson", { pathToPicture: "1206161.jpg" })],
      }),
    });

    expect(await listStudents({ db })).toEqual([
      {
        studentId: 1206161,
        name: "Benjamin Olson",
        initials: "BO",
        gradeLevel: "07",
        homeroom: "07 Rivera",
        photoUrl: "https://tcs-ca.client.factsmgt.com/ftp/tcs-ca/pictures/1206161.jpg",
      },
    ]);
  });

  it("omits students FACTS no longer lists as enrolled", async () => {
    const stayed = student(1, "07");
    const left = student(2, "07");
    await sync({ db, facts: fakeFacts({ students: [stayed, left], people: [person(1, "Ann", "Alpha"), person(2, "Bob", "Beta")] }) });

    await sync({ db, facts: fakeFacts({ students: [stayed], people: [person(1, "Ann", "Alpha")] }) });

    expect(await listStudents({ db })).toMatchObject([{ studentId: 1 }]);
  });

  it("lists an enrolled student whose person row is missing", async () => {
    // FACTS has students with no matching /People row. Hiding the child would
    // hide the data problem; the person-owned name and photo are just absent.
    await sync({
      db,
      facts: fakeFacts({
        students: [student(777, "03")],
        homerooms: [homeroom(777, { homeroom: "03 Chen" })],
        people: [],
      }),
    });

    expect(await listStudents({ db })).toEqual([
      { studentId: 777, name: "", initials: "", gradeLevel: "03", homeroom: "03 Chen", photoUrl: null },
    ]);
  });

  it("shows no homeroom for the students FACTS has not assigned one", async () => {
    // Roughly 62 of 536, concentrated in preschool and kindergarten (#54).
    await sync({ db, facts: fakeFacts({ students: [student(1, "PS")], people: [person(1, "Ann", "Alpha")] }) });

    expect(await listStudents({ db })).toMatchObject([{ homeroom: null }]);
  });

  it("carries first and last initials for the students with no photo to show", async () => {
    await sync({
      db,
      facts: fakeFacts({
        students: [student(10), student(11), student(12)],
        people: [person(10, "ada", "lovelace"), person(11, "", "Zeta"), person(12, "", "")],
      }),
    });

    // In surname order, so the child whose name parts are blank leads: nothing
    // to build initials from is a blank circle, not a placeholder person.
    expect(await listStudents({ db })).toMatchObject([
      { initials: "" },
      { initials: "AL" },
      { initials: "Z" },
    ]);
  });

  it("has no photo when the picture filename is not a plain filename", async () => {
    await sync({
      db,
      facts: fakeFacts({
        students: [student(10)],
        people: [person(10, "Ann", "Alpha", { pathToPicture: "../../../etc/passwd" })],
      }),
    });

    expect(await listStudents({ db })).toMatchObject([{ photoUrl: null }]);
  });

  it("orders by last name, then first name, then student id — ignoring case", async () => {
    await sync({
      db,
      facts: fakeFacts({
        students: [student(30), student(20), student(10), student(40)],
        people: [
          person(30, "Zoe", "alpha"),
          person(20, "Ann", "Beta"),
          person(10, "ann", "beta"),
          person(40, "Bob", "ALPHA"),
        ],
      }),
    });

    expect((await listStudents({ db })).map((entry) => entry.studentId)).toEqual([40, 30, 10, 20]);
  });

  it("puts the students with no person row last, deterministically", async () => {
    // No surname to sort on, so they land at the end rather than scattering:
    // the entry is still there, and the order is still the same every read.
    await sync({
      db,
      facts: fakeFacts({
        students: [student(30), student(10), student(20)],
        people: [person(10, "Ann", "Alpha")],
      }),
    });

    expect((await listStudents({ db })).map((entry) => entry.studentId)).toEqual([10, 20, 30]);
  });

  it("reports an empty enrolled population as an empty list", async () => {
    expect(await listStudents({ db })).toEqual([]);
  });
});
