import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { listStaff } from "@/lib/staff";
import { sync } from "@/lib/sync";

import { createTestDb, type TestDb } from "../support/db";
import { fakeFacts, person, staffMember } from "../support/facts";
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
        people: [person(10, "Jane", "Doe", "jdoe@tbs.org")],
      }),
    });

    expect(await listStaff({ db })).toEqual([
      { staffId: 10, name: "Jane Q Doe", department: "Middle School", contactEmail: "jdoe@tbs.org" },
    ]);
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
      { staffId: 10, name: "Jane Doe", department: null, contactEmail: null },
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
    await sync({ db, facts: fakeFacts({ staff: [staffMember(10)], people: [person(10, "", "", "x@tbs.org")] }) });

    expect(await listStaff({ db })).toEqual([
      { staffId: 10, name: "", department: null, contactEmail: "x@tbs.org" },
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
