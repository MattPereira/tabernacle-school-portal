import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { listGradeLevels } from "@/lib/students";
import { sync } from "@/lib/sync";

import { createTestDb, type TestDb } from "../support/db";
import { fakeFacts, gradeLevel } from "../support/facts";
import { resetSync } from "../sync/support";

describe("listGradeLevels", () => {
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

  it("reads the school's grade levels in the school's own order", async () => {
    // The school's order, not the alphabet's: PS before K before 01.
    await sync({
      db,
      facts: fakeFacts({
        gradeLevels: [gradeLevel("01", 5), gradeLevel("PS", 1), gradeLevel("K", 4)],
        people: [],
      }),
    });

    expect(await listGradeLevels({ db })).toEqual([
      { gradeLevel: "PS", sortOrder: 1 },
      { gradeLevel: "K", sortOrder: 4 },
      { gradeLevel: "01", sortOrder: 5 },
    ]);
  });

  it("omits the grade levels FACTS no longer configures", async () => {
    await sync({ db, facts: fakeFacts({ gradeLevels: [gradeLevel("K", 4), gradeLevel("PS", 1)], people: [] }) });

    await sync({ db, facts: fakeFacts({ gradeLevels: [gradeLevel("K", 4)], people: [] }) });

    expect(await listGradeLevels({ db })).toEqual([{ gradeLevel: "K", sortOrder: 4 }]);
  });

  it("reports a snapshot with no grade levels as an empty list", async () => {
    expect(await listGradeLevels({ db })).toEqual([]);
  });
});
