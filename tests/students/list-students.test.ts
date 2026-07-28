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
        contactEmail: null,
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
      {
        studentId: 777,
        name: "",
        initials: "",
        gradeLevel: "03",
        homeroom: "03 Chen",
        photoUrl: null,
        contactEmail: null,
      },
    ]);
  });

  it("carries the contact email FACTS holds, and nothing where it holds none", async () => {
    // The school issues its @tbs.org addresses from 2nd grade up, so most of
    // the lower school has none — an absent address, not a missing one.
    await sync({
      db,
      facts: fakeFacts({
        students: [student(10, "05"), student(11, "PS")],
        people: [
          person(10, "Ada", "Alpha", { contactEmail: "aalpha@tbs.org" }),
          person(11, "Bo", "Beta"),
        ],
      }),
    });

    expect(await listStudents({ db })).toMatchObject([
      { contactEmail: "aalpha@tbs.org" },
      { contactEmail: null },
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

  it("keeps a homeroom's students together, ahead of the name order", async () => {
    // What the grade-level heading can't say: which class a child is actually
    // in. Sorting on the homeroom first makes a grade level read as its two or
    // three homerooms rather than one long alphabet (#54).
    await sync({
      db,
      facts: fakeFacts({
        students: [student(10, "01"), student(20, "01"), student(30, "01"), student(40, "01")],
        homerooms: [
          homeroom(10, { homeroom: "01 HR-B" }),
          homeroom(20, { homeroom: "01 HR-A" }),
          homeroom(30, { homeroom: "01 HR-B" }),
          homeroom(40, { homeroom: "01 HR-A" }),
        ],
        people: [
          person(10, "Ann", "Alpha"),
          person(20, "Bob", "Beta"),
          person(30, "Cal", "Chi"),
          person(40, "Dee", "Delta"),
        ],
      }),
    });

    // Alphabetically this would be 10, 20, 30, 40; by homeroom it is HR-A's
    // two in surname order, then HR-B's.
    expect((await listStudents({ db })).map((entry) => entry.studentId)).toEqual([20, 40, 10, 30]);
  });

  it("puts the students with no homeroom after those with one", async () => {
    // Roughly 62 of 536, so the tail is real: it lands at the end of the grade
    // level rather than scattering through it.
    await sync({
      db,
      facts: fakeFacts({
        students: [student(10, "PS"), student(20, "PS")],
        homerooms: [homeroom(20, { homeroom: "*0PS - HR-A" })],
        people: [person(10, "Ann", "Alpha"), person(20, "Bob", "Beta")],
      }),
    });

    expect((await listStudents({ db })).map((entry) => entry.studentId)).toEqual([20, 10]);
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
