import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { getStaffDetail } from "@/lib/staff";
import { sync } from "@/lib/sync";

import { createTestDb, type TestDb } from "../support/db";
import { fakeFacts, homeroom, person, staffMember, student } from "../support/facts";
import { resetSync } from "../sync/support";

describe("getStaffDetail", () => {
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

  it("returns an active staff member's display-ready Professional staff profile", async () => {
    await sync({
      db,
      facts: fakeFacts({
        staff: [staffMember(10, { firstName: "Jane", middleName: "Q", lastName: "Doe", department: "Elementary" })],
        students: [student(20), student(21), student(22)],
        homerooms: [
          homeroom(20, { homeroom: "02 Doe", staffId: 10 }),
          homeroom(21, { homeroom: "01 Doe", staffId: 10 }),
          homeroom(22, { homeroom: "02 Doe", staffId: 10 }),
        ],
        people: [person(10, "Jane", "Doe", { contactEmail: "jane@example.com", pathToPicture: "10.jpg" })],
      }),
    });

    expect(await getStaffDetail({ db }, 10)).toEqual({
      staffId: 10,
      name: "Jane Q Doe",
      initials: "JD",
      department: "Elementary",
      contactEmail: "jane@example.com",
      photoUrl: "https://tcs-ca.client.factsmgt.com/ftp/tcs-ca/pictures/10.jpg",
      homerooms: ["01 Doe", "02 Doe"],
    });
  });

  it("keeps an active staff member with no person row, leaving person-owned facts absent", async () => {
    await sync({
      db,
      facts: fakeFacts({
        staff: [staffMember(10, { firstName: "Jane", lastName: "Doe", department: "Elementary" })],
        students: [student(20)],
        homerooms: [homeroom(20, { homeroom: "02 Doe", staffId: 10 })],
      }),
    });

    await expect(getStaffDetail({ db }, 10)).resolves.toEqual({
      staffId: 10,
      name: "",
      initials: "JD",
      department: "Elementary",
      contactEmail: null,
      photoUrl: null,
      homerooms: ["02 Doe"],
    });
  });

  it("returns no detail for unknown or inactive staff", async () => {
    await sync({ db, facts: fakeFacts({ staff: [staffMember(10)] }) });
    await sync({ db, facts: fakeFacts({ staff: [] }) });

    await expect(getStaffDetail({ db }, 10)).resolves.toBeNull();
    await expect(getStaffDetail({ db }, 999)).resolves.toBeNull();
  });
});
