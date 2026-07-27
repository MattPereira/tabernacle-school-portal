import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { syncRun } from "@/lib/db/schema";
import { sync } from "@/lib/sync";

import { createTestDb, type TestDb } from "../support/db";
import { fakeFacts, person, staffMember, student } from "../support/facts";
import { resetSync } from "./support";

describe("sync records every run", () => {
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

  it("writes one sync_run with its outcome and counts", async () => {
    const result = await sync({
      db,
      facts: fakeFacts({
        students: [student(1), student(2)],
        staff: [staffMember(3)],
        people: [person(1, "Ann", "Alpha"), person(2, "Bob", "Beta"), person(3, "Cy", "Gamma")],
      }),
    });

    const runs = await db.select().from(syncRun);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      outcome: "applied",
      peopleCount: 3,
      studentCount: 2,
      staffCount: 1,
      flaggedCount: 0,
      detail: null,
    });
    expect(result).toMatchObject({ runId: runs[0].id });
  });

  it("timestamps the run from the injected clock", async () => {
    const startedAt = new Date("2026-07-23T09:00:00.000Z");
    const finishedAt = new Date("2026-07-23T09:02:30.000Z");
    const times = [startedAt, finishedAt, finishedAt, finishedAt];

    await sync({ db, facts: fakeFacts({}), now: () => times.shift() ?? finishedAt });

    const [run] = await db.select().from(syncRun);
    expect(run.startedAt).toEqual(startedAt);
    expect(run.finishedAt).toEqual(finishedAt);
  });

  it("accumulates a history rather than overwriting the last run", async () => {
    const facts = fakeFacts({ students: [student(1)], people: [person(1, "A", "B")] });
    await sync({ db, facts });
    await sync({ db, facts });
    await sync({ db, facts: fakeFacts({ failOn: "staff" }) });

    const runs = await db.select().from(syncRun);
    expect(runs.map((r) => r.outcome)).toEqual(["applied", "applied", "failed"]);
  });
});
