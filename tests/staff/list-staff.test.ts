import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { groupByDepartment, listStaff } from "@/lib/staff";
import { sync } from "@/lib/sync";

import { createTestDb, type TestDb } from "../support/db";
import { fakeFacts, homeroom, person, staffMember, student } from "../support/facts";
import { resetSync } from "../sync/support";

describe("listStaff", () => {
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

  it("returns the active staff population read from the snapshot", async () => {
    await sync({
      db,
      facts: fakeFacts({
        staff: [staffMember(10, { firstName: "Jane", middleName: "Q", lastName: "Doe", department: "Middle School" })],
        people: [person(10, "Jane", "Doe", { contactEmail: "jdoe@tbs.org", pathToPicture: "1203006.jpg" })],
      }),
    });

    expect(await listStaff({ db })).toEqual([
      {
        staffId: 10,
        name: "Jane Q Doe",
        initials: "JD",
        department: "Middle School",
        homeroom: null,
        contactEmail: "jdoe@tbs.org",
        photoUrl: "https://tcs-ca.client.factsmgt.com/ftp/tcs-ca/pictures/1203006.jpg",
      },
    ]);
  });

  it("derives homerooms from currently enrolled students without changing the staff roster", async () => {
    const teacher = staffMember(10, { firstName: "Jane", lastName: "Doe", department: "Faculty" });
    const noHomeroom = staffMember(11, { firstName: "Bob", lastName: "Beta", department: "Faculty" });
    const inactiveTeacher = staffMember(12, { firstName: "Cara", lastName: "Alpha", department: "Administration" });

    await sync({
      db,
      facts: fakeFacts({
        staff: [teacher, noHomeroom, inactiveTeacher],
        students: [student(100), student(101), student(102)],
        homerooms: [
          homeroom(100, { homeroom: "K Doe", staffId: 10 }),
          homeroom(101, { homeroom: "02 Beta", staffId: 11 }),
          homeroom(102, { homeroom: "03 Alpha", staffId: 12 }),
        ],
      }),
    });
    await sync({
      db,
      facts: fakeFacts({
        staff: [teacher, noHomeroom],
        students: [student(100), student(102)],
        homerooms: [
          homeroom(100, { homeroom: "K Doe", staffId: 10 }),
          homeroom(102, { homeroom: "03 Alpha", staffId: 12 }),
        ],
      }),
    });

    const staff = await listStaff({ db });
    expect(staff).toMatchObject([
      { staffId: 11, homeroom: null },
      { staffId: 10, homeroom: "K Doe" },
    ]);
    expect(groupByDepartment(staff)).toMatchObject([
      { department: "Faculty", staff: [{ staffId: 11 }, { staffId: 10 }] },
    ]);
  });

  it("carries first and last initials for the rows with no photo to show", async () => {
    await sync({
      db,
      facts: fakeFacts({
        staff: [
          staffMember(10, { firstName: "ada", middleName: "Byron", lastName: "lovelace" }),
          staffMember(11, { lastName: "Zeta" }),
          staffMember(12, { firstName: "Prince" }),
          staffMember(13),
        ],
        people: [],
      }),
    });

    expect(await listStaff({ db })).toMatchObject([
      // The middle name stays out of the circle.
      { initials: "AL" },
      { initials: "Z" },
      { initials: "P" },
      // Nothing to build initials from is a blank circle, not a placeholder.
      { initials: "" },
    ]);
  });

  it("has no photo when FACTS holds no picture filename", async () => {
    await sync({
      db,
      facts: fakeFacts({
        staff: [staffMember(10, { firstName: "Jane", lastName: "Doe" })],
        people: [person(10, "Jane", "Doe")],
      }),
    });

    expect(await listStaff({ db })).toMatchObject([{ photoUrl: null }]);
  });

  it("has no photo when the picture filename is not a plain filename", async () => {
    // A path that would leave the FACTS pictures location is treated as no
    // photo at all, so the row falls back to initials.
    await sync({
      db,
      facts: fakeFacts({
        staff: [staffMember(10, { firstName: "Jane", lastName: "Doe" })],
        people: [person(10, "Jane", "Doe", { pathToPicture: "../../../etc/passwd" })],
      }),
    });

    expect(await listStaff({ db })).toMatchObject([{ photoUrl: null }]);
  });

  it("omits staff FACTS no longer lists as active", async () => {
    const stayed = staffMember(10, { firstName: "Jane", lastName: "Doe" });
    const departed = staffMember(11, { firstName: "Bob", lastName: "Beta" });
    await sync({ db, facts: fakeFacts({ staff: [stayed, departed], people: [person(10, "Jane", "Doe"), person(11, "Bob", "Beta")] }) });

    await sync({ db, facts: fakeFacts({ staff: [stayed], people: [person(10, "Jane", "Doe")] }) });

    expect(await listStaff({ db })).toMatchObject([{ staffId: 10 }]);
  });

  it("lists an active staff member whose person row is missing, without an email", async () => {
    // FACTS has staff with no matching /People row. The staff endpoint carries
    // its own names, so the entry stands; person-owned email is just absent.
    await sync({ db, facts: fakeFacts({ staff: [staffMember(10, { firstName: "Jane", lastName: "Doe" })], people: [] }) });

    expect(await listStaff({ db })).toEqual([
      { staffId: 10, name: "Jane Doe", initials: "JD", department: null, homeroom: null, contactEmail: null, photoUrl: null },
    ]);
  });

  it("keeps utility-looking staff — the portal does not guess at data errors", async () => {
    await sync({
      db,
      facts: fakeFacts({
        staff: [
          staffMember(10, { firstName: "Front", lastName: "Office" }),
          staffMember(11, { firstName: "Substitute", lastName: "Teacher" }),
        ],
        people: [],
      }),
    });

    expect(await listStaff({ db })).toHaveLength(2);
  });

  it("builds the name from the parts that are present", async () => {
    await sync({
      db,
      facts: fakeFacts({
        staff: [
          staffMember(10, { firstName: "Jane", lastName: "Doe" }),
          staffMember(11, { firstName: "Ada", middleName: "Byron", lastName: "Lovelace" }),
          staffMember(12, { lastName: "Zeta" }),
        ],
        people: [],
      }),
    });

    expect(await listStaff({ db })).toMatchObject([
      { name: "Jane Doe" },
      { name: "Ada Byron Lovelace" },
      { name: "Zeta" },
    ]);
  });

  it("still lists a staff member FACTS gave no name at all", async () => {
    // Nothing to render but the email. Dropping the row would hide a real
    // FACTS data problem, which is the same call as the utility names above.
    await sync({ db, facts: fakeFacts({ staff: [staffMember(10)], people: [person(10, "", "", { contactEmail: "x@tbs.org" })] }) });

    expect(await listStaff({ db })).toEqual([
      { staffId: 10, name: "", initials: "", department: null, homeroom: null, contactEmail: "x@tbs.org", photoUrl: null },
    ]);
  });

  it("orders by last name, then first name, then staff id — ignoring case", async () => {
    await sync({
      db,
      facts: fakeFacts({
        staff: [
          staffMember(30, { firstName: "Zoe", lastName: "alpha" }),
          staffMember(20, { firstName: "Ann", lastName: "Beta" }),
          staffMember(10, { firstName: "ann", lastName: "beta" }),
          staffMember(40, { firstName: "Bob", lastName: "ALPHA" }),
        ],
        people: [],
      }),
    });

    expect((await listStaff({ db })).map((entry) => entry.staffId)).toEqual([40, 30, 10, 20]);
  });

  it("reports an empty active population as an empty list", async () => {
    expect(await listStaff({ db })).toEqual([]);
  });
});
