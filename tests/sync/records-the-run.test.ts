import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { syncRun } from "@/lib/db/schema";
import type { FactsClient } from "@/lib/facts";
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

  it("refuses a second run while an earlier run is in flight", async () => {
    await db.insert(syncRun).values({ startedAt: new Date("2026-07-27T10:00:00.000Z") });

    await expect(sync({ db, facts: fakeFacts({}) })).resolves.toEqual({ outcome: "in_flight" });
    expect(await db.select().from(syncRun)).toHaveLength(1);
  });

  it("allows exactly one of two concurrent callers to open a run", async () => {
    let entered!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const finish = new Promise<void>((resolve) => { release = resolve; });
    const facts: FactsClient = {
      async fetchEnrolledStudents() { entered(); await finish; return []; },
      async fetchActiveStaff() { return []; },
      async fetchPeople() { return []; },
    };

    const first = sync({ db, facts });
    await started;
    const second = await sync({ db, facts });
    release();

    await expect(first).resolves.toMatchObject({ outcome: "applied" });
    expect(second).toEqual({ outcome: "in_flight" });
    expect(await db.select().from(syncRun)).toHaveLength(1);
  });
});
