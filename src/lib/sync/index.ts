import { and, desc, eq, notInArray, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { factsPerson, factsStaff, factsStudent, syncRun } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import type { FactsClient } from "@/lib/facts";

export type SyncDb = PgDatabase<PgQueryResultHKT, typeof schema>;

export type SyncDeps = { db: SyncDb; facts: FactsClient; now?: () => Date };

export type SyncCounts = { people: number; students: number; staff: number; flagged: number };

export type SyncResult =
  | { outcome: "applied"; runId: number; counts: SyncCounts }
  | { outcome: "failed"; runId: number; detail: string };

// The FACTS snapshot applies transactionally. Missing records are retained as
// inactive, but that flag intentionally never revokes request-time access.
export async function sync(deps: SyncDeps): Promise<SyncResult> {
  const { db, facts, now = () => new Date() } = deps;
  const [opened] = await db.insert(syncRun).values({ startedAt: now() }).returning({ id: syncRun.id });
  const runId = opened.id;
  const empty: SyncCounts = { people: 0, students: 0, staff: 0, flagged: 0 };
  const close = (outcome: "applied" | "failed", counts: SyncCounts, detail: string | null) =>
    db.update(syncRun).set({
      finishedAt: now(), outcome, peopleCount: counts.people, studentCount: counts.students,
      staffCount: counts.staff, flaggedCount: counts.flagged, detail,
    }).where(eq(syncRun.id, runId));

  try {
    const [students, staff] = await Promise.all([facts.fetchEnrolledStudents(), facts.fetchActiveStaff()]);
    const people = await facts.fetchPeople([...students.map((row) => row.studentId), ...staff.map((row) => row.staffId)]);
    const incoming = { people: people.length, students: students.length, staff: staff.length };
    const flagged = await db.transaction(async (tx) => {
      const seenAt = now();
      let count = 0;
      if (people.length) await tx.insert(factsPerson).values(people.map((row) => ({ ...row, lastSeenAt: seenAt }))).onConflictDoUpdate({
        target: factsPerson.personId,
        set: { firstName: sql`excluded.first_name`, lastName: sql`excluded.last_name`, contactEmail: sql`excluded.contact_email`, inactive: false, lastSeenAt: seenAt },
      });
      count += await flagMissing(tx, factsPerson, factsPerson.personId, people.map((row) => row.personId));
      if (students.length) await tx.insert(factsStudent).values(students.map((row) => ({ ...row, lastSeenAt: seenAt }))).onConflictDoUpdate({
        target: factsStudent.studentId,
        set: { gradeLevel: sql`excluded.grade_level`, status: sql`excluded.status`, inactive: false, lastSeenAt: seenAt },
      });
      count += await flagMissing(tx, factsStudent, factsStudent.studentId, students.map((row) => row.studentId));
      if (staff.length) await tx.insert(factsStaff).values(staff.map((row) => ({ ...row, lastSeenAt: seenAt }))).onConflictDoUpdate({
        target: factsStaff.staffId, set: { inactive: false, lastSeenAt: seenAt },
      });
      count += await flagMissing(tx, factsStaff, factsStaff.staffId, staff.map((row) => row.staffId));
      return count;
    });
    const counts = { ...incoming, flagged };
    await close("applied", counts, null);
    return { outcome: "applied", runId, counts };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await close("failed", empty, detail);
    return { outcome: "failed", runId, detail };
  }
}

export async function latestSyncRun(db: SyncDb) {
  const [run] = await db.select().from(syncRun).orderBy(desc(syncRun.id)).limit(1);
  return run ?? null;
}

async function flagMissing(
  tx: SyncDb,
  table: typeof factsPerson | typeof factsStudent | typeof factsStaff,
  idColumn: Parameters<typeof notInArray>[0],
  presentIds: number[],
): Promise<number> {
  const active = eq(table.inactive, false);
  const flagged = await tx.update(table).set({ inactive: true }).where(
    presentIds.length ? and(active, notInArray(idColumn, presentIds)) : active,
  ).returning({ inactive: table.inactive });
  return flagged.length;
}
