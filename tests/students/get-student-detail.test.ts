import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { getStudentDetail } from "@/lib/students";
import { sync } from "@/lib/sync";

import { createTestDb, type TestDb } from "../support/db";
import { fakeFacts, homeroom, person, student } from "../support/facts";
import { resetSync } from "../sync/support";

describe("getStudentDetail", () => {
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

  it("returns an enrolled student's display-ready detail and an inactive teacher's name", async () => {
    await sync({
      db,
      facts: fakeFacts({
        students: [student(10, "04", { enrolledSince: "2023-08-23" })],
        homerooms: [homeroom(10, { homeroom: "04 Torres", room: "12", staffId: 20 })],
        people: [
          person(10, "Amelia", "Torres", {
            contactEmail: "family@example.com",
            pathToPicture: "10.jpg",
            birthdate: "2015-05-14",
          }),
          person(20, "Jordan", "Lee"),
        ],
      }),
    });

    expect(await getStudentDetail({ db, now: () => new Date("2026-05-15T12:00:00Z") }, 10)).toEqual({
      studentId: 10,
      name: "Amelia Torres",
      initials: "AT",
      gradeLevel: "04",
      status: "Enrolled",
      contactEmail: "family@example.com",
      photoUrl: "https://tcs-ca.client.factsmgt.com/ftp/tcs-ca/pictures/10.jpg",
      enrolledSince: "2023-08-23",
      birthdate: "2015-05-14",
      age: 11,
      homeroom: { label: "04 Torres", room: "12", teacherId: 20, teacherName: "Jordan Lee" },
    });
  });

  it("keeps an enrolled child with no person row, and leaves their person-owned facts absent", async () => {
    await sync({ db, facts: fakeFacts({ students: [student(10, "03")] }) });

    expect(await getStudentDetail({ db, now: () => new Date("2026-01-01T12:00:00Z") }, 10)).toEqual({
      studentId: 10,
      name: "",
      initials: "",
      gradeLevel: "03",
      status: "Enrolled",
      contactEmail: null,
      photoUrl: null,
      enrolledSince: null,
      birthdate: null,
      age: null,
      homeroom: null,
    });
  });

  it("returns no detail for an unknown or no-longer-enrolled student", async () => {
    await sync({ db, facts: fakeFacts({ students: [student(10)] }) });
    await sync({ db, facts: fakeFacts({ students: [] }) });

    await expect(getStudentDetail({ db, now: () => new Date() }, 10)).resolves.toBeNull();
    await expect(getStudentDetail({ db, now: () => new Date() }, 999)).resolves.toBeNull();
  });

  it("derives age against the injected calendar day", async () => {
    await sync({
      db,
      facts: fakeFacts({ students: [student(10)], people: [person(10, "Amelia", "Torres", { birthdate: "2015-05-14" })] }),
    });

    await expect(getStudentDetail({ db, now: () => new Date("2026-05-13T12:00:00Z") }, 10)).resolves.toMatchObject({ age: 10 });
    await expect(getStudentDetail({ db, now: () => new Date("2026-05-14T12:00:00Z") }, 10)).resolves.toMatchObject({ age: 11 });
  });
});
