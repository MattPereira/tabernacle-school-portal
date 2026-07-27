import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { factsStudent, syncRun } from "@/lib/db/schema";
import { sync } from "@/lib/sync";

import { createTestDb, type TestDb } from "../support/db";
import { fakeFacts, population } from "../support/facts";
import { resetSync } from "./support";

// Sync has no threshold guard: it applies whatever FACTS returns, however
// implausible. These tests pin down why that's safe rather than reckless — the
// worst a broken FACTS response can do is flag people, and the next good run
// undoes it without anyone deciding anything.
describe("sync applies large changes without refusing", () => {
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

  const seed = (count: number) => sync({ db, facts: fakeFacts(population(count)) });

  it("applies a run that shrinks the FACTS snapshot to almost nothing", async () => {
    await seed(10);

    const result = await sync({ db, facts: fakeFacts(population(1)) });

    expect(result.outcome).toBe("applied");
    expect(result).toMatchObject({ counts: { flagged: 18 } }); // 9 people + 9 students
  });

  it("flags rather than deletes, even at that scale", async () => {
    await seed(10);
    await sync({ db, facts: fakeFacts(population(1)) });

    // Every row is still here. That's the whole reason no guard is needed.
    const snapshotStudents = await db.select().from(factsStudent);
    expect(snapshotStudents).toHaveLength(10);
    expect(snapshotStudents.filter((s) => s.inactive)).toHaveLength(9);
  });

  it("un-flags everyone when the next run comes back healthy", async () => {
    await seed(10);
    await sync({ db, facts: fakeFacts(population(1)) });

    await sync({ db, facts: fakeFacts(population(10)) });

    const snapshotStudents = await db.select().from(factsStudent);
    expect(snapshotStudents).toHaveLength(10);
    expect(snapshotStudents.filter((s) => s.inactive)).toHaveLength(0);
  });

  it("applies an empty FACTS response by flagging the whole FACTS snapshot", async () => {
    await seed(10);

    const result = await sync({ db, facts: fakeFacts({}) });

    expect(result.outcome).toBe("applied");
    const snapshotStudents = await db.select().from(factsStudent);
    expect(snapshotStudents).toHaveLength(10);
    expect(snapshotStudents.every((s) => s.inactive)).toBe(true);
  });

  it("seeds an empty FACTS snapshot", async () => {
    const result = await seed(10);

    expect(result.outcome).toBe("applied");
    expect(await db.select().from(factsStudent)).toHaveLength(10);
  });

  it("handles growth as ordinary news", async () => {
    await seed(4);

    const result = await sync({ db, facts: fakeFacts(population(40)) });

    expect(result.outcome).toBe("applied");
    expect(result).toMatchObject({ counts: { students: 40, flagged: 0 } });
  });

  it("records every one of those runs as applied", async () => {
    await seed(10);
    await sync({ db, facts: fakeFacts(population(1)) });

    const runs = await db.select().from(syncRun);
    expect(runs.map((r) => r.outcome)).toEqual(["applied", "applied"]);
  });
});
