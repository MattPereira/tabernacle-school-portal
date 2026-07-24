import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { clearRunFlags, flaggedPeople, sync } from "@/lib/sync";

import { createTestDb, type TestDb } from "../support/db";
import { fakeFacts, person, student } from "../support/facts";
import { resetSync } from "./support";

// Flag-don't-revoke leaves the admin a pile of `inactive` rows after a misfired
// sync. This screen makes them undoable *by the run that set them* (ADR-0003),
// which is what makes shipping without the <50% guard safe rather than a gamble.
describe("flag management", () => {
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

  // A healthy run holding both people, then a misfire that drops one.
  const healthy = fakeFacts({
    students: [student(1), student(2)],
    people: [person(1, "Benjamin", "Olson"), person(2, "Bob", "Beta")],
  });
  const misfire = fakeFacts({
    students: [student(1)],
    people: [person(1, "Benjamin", "Olson")],
  });

  const runId = (r: Awaited<ReturnType<typeof sync>>) => (r.outcome === "applied" ? r.runId : -1);

  it("lists a run's flagged people, carrying the run that flagged them", async () => {
    const flaggedAt = new Date("2026-07-24T03:00:00Z");
    await sync({ db, facts: healthy });
    const bad = await sync({ db, facts: misfire, now: () => flaggedAt });

    const flagged = await flaggedPeople(db);

    expect(flagged).toEqual([
      {
        personId: 2,
        firstName: "Bob",
        lastName: "Beta",
        flaggedByRunId: runId(bad),
        flaggedAt,
      },
    ]);
  });

  it("keeps a flag on the run that first set it, not a later run that also misses them", async () => {
    await sync({ db, facts: healthy });
    const first = await sync({ db, facts: misfire }); // flags person 2
    const second = await sync({ db, facts: misfire }); // still gone, already flagged

    const flagged = await flaggedPeople(db);

    // The person left FACTS during `first`; `second` re-running the same misfire
    // is not a fresh departure, so attribution — and thus which run's clear
    // restores them — stays put.
    expect(flagged).toHaveLength(1);
    expect(flagged[0].flaggedByRunId).toBe(runId(first));
    expect(flagged[0].flaggedByRunId).not.toBe(runId(second));
  });

  // Two people, each lost by a different run.
  const three = fakeFacts({
    students: [student(1), student(2), student(3)],
    people: [person(1, "A", "One"), person(2, "Bob", "Beta"), person(3, "Cara", "Gamma")],
  });
  const dropped3 = fakeFacts({
    students: [student(1), student(2)],
    people: [person(1, "A", "One"), person(2, "Bob", "Beta")],
  });
  const dropped2and3 = fakeFacts({
    students: [student(1)],
    people: [person(1, "A", "One")],
  });

  it("clears one run's flags wholesale, leaving another run's flags standing", async () => {
    await sync({ db, facts: three });
    const runB = await sync({ db, facts: dropped3 }); // flags person 3
    const runC = await sync({ db, facts: dropped2and3 }); // flags person 2 (3 already flagged)

    await clearRunFlags(db, runId(runC));

    // Person 2 came back; person 3 — flagged by the untouched run B — stays.
    expect(await flaggedPeople(db)).toEqual([
      { personId: 3, firstName: "Cara", lastName: "Gamma", flaggedByRunId: runId(runB), flaggedAt: expect.any(Date) },
    ]);

    await clearRunFlags(db, runId(runB));
    expect(await flaggedPeople(db)).toEqual([]);
  });

  // FACTS has students with no /People row (mirror.ts). Their flag lands only in
  // mirror_student, and no /People row will ever turn up to reveal it — so a
  // person-table-only read hides them from the list forever, taking the clear
  // button with them.
  it("lists a person flagged only outside mirror_person, unnamed but clearable", async () => {
    const nameless = fakeFacts({
      students: [student(1), student(2)],
      people: [person(1, "Benjamin", "Olson")], // no /People row for student 2
    });
    const droppedNameless = fakeFacts({
      students: [student(1)],
      people: [person(1, "Benjamin", "Olson")],
    });

    await sync({ db, facts: nameless });
    const bad = await sync({ db, facts: droppedNameless });

    expect(await flaggedPeople(db)).toEqual([
      {
        personId: 2,
        firstName: null,
        lastName: null,
        flaggedByRunId: runId(bad),
        flaggedAt: expect.any(Date),
      },
    ]);

    await clearRunFlags(db, runId(bad));
    expect(await flaggedPeople(db)).toEqual([]);
  });

  // A departing student is flagged in mirror_person and mirror_student by the
  // same run. That is one human to the admin, not two rows.
  it("lists a person once per run however many mirror tables flagged them", async () => {
    await sync({ db, facts: healthy });
    const bad = await sync({ db, facts: misfire });

    expect(bad).toMatchObject({ counts: { flagged: 2 } }); // the person and student rows
    expect(await flaggedPeople(db)).toHaveLength(1);
  });

  it("un-flags a person who returns to FACTS, dropping their run tag with the flag", async () => {
    await sync({ db, facts: healthy });
    await sync({ db, facts: misfire }); // person 2 flagged
    expect(await flaggedPeople(db)).toHaveLength(1);

    await sync({ db, facts: healthy }); // person 2 seen again
    expect(await flaggedPeople(db)).toEqual([]);
  });
});
