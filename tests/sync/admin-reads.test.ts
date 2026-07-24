import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { identityLink } from "@/lib/db/schema";
import { latestSyncRun, sync, unlinkedPeople } from "@/lib/sync";

import { createTestDb, type TestDb } from "../support/db";
import { fakeFacts, person, staffMember, student } from "../support/facts";
import { resetSync } from "./support";

// The two reads the admin screen loads on every page view — the same answers
// sync returns, asked without running one.
describe("the admin screen's reads", () => {
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

  const facts = fakeFacts({
    students: [student(1), student(2)],
    staff: [staffMember(3)],
    people: [person(1, "Benjamin", "Olson"), person(2, "Bob", "Beta"), person(3, "Jane", "Doe")],
  });

  describe("latestSyncRun", () => {
    it("is null before the button has ever been pressed", async () => {
      expect(await latestSyncRun(db)).toBeNull();
    });

    it("reports the most recent run, not the first", async () => {
      await sync({ db, facts });
      await sync({ db, facts: fakeFacts({ students: [student(1)], people: [person(1, "B", "O")] }) });

      const run = await latestSyncRun(db);

      expect(run).toMatchObject({ outcome: "applied", studentCount: 1, staffCount: 0 });
    });

    it("surfaces a failure, so a broken sync can't look like a fresh one", async () => {
      await sync({ db, facts });
      await sync({ db, facts: fakeFacts({ failOn: "students" }) });

      expect(await latestSyncRun(db)).toMatchObject({
        outcome: "failed",
        detail: "FACTS students read failed",
      });
    });

    it("carries the counts and timing the screen shows", async () => {
      const startedAt = new Date("2026-07-23T09:00:00Z");
      await sync({ db, facts, now: () => startedAt });

      expect(await latestSyncRun(db)).toMatchObject({
        outcome: "applied",
        peopleCount: 3,
        studentCount: 2,
        staffCount: 1,
        flaggedCount: 0,
        unlinkedCount: 3,
        startedAt,
        finishedAt: startedAt,
      });
    });
  });

  describe("unlinkedPeople", () => {
    it("is empty before the first sync", async () => {
      expect(await unlinkedPeople(db)).toEqual([]);
    });

    it("returns the work queue the last sync computed", async () => {
      await db.insert(identityLink).values([
        { googleEmail: "bob@tbs.org", factsPersonId: 2, role: "student" },
        { googleEmail: "27beno@tbs.org", factsPersonId: null, role: "student" },
      ]);

      const result = await sync({ db, facts });
      const queue = await unlinkedPeople(db);

      expect(result.outcome).toBe("applied");
      expect(queue).toEqual(result.outcome === "applied" ? result.unlinkedPeople : []);
      expect(queue.map((p) => p.personId).sort()).toEqual([1, 3]);
      expect(queue.find((p) => p.personId === 1)?.suggestions.map((s) => s.googleEmail)).toEqual([
        "27beno@tbs.org",
      ]);
    });

    it("shrinks as the admin works through it", async () => {
      await sync({ db, facts });
      expect(await unlinkedPeople(db)).toHaveLength(3);

      await db.insert(identityLink).values({
        googleEmail: "27beno@tbs.org",
        factsPersonId: 1,
        role: "student",
      });

      expect((await unlinkedPeople(db)).map((p) => p.personId).sort()).toEqual([2, 3]);
    });
  });
});
