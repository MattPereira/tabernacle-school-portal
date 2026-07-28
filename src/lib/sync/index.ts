import { and, desc, eq, notInArray, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { factsGradeLevel, factsPerson, factsStaff, factsStudent, syncRun } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import type { FactsClient, FactsHomeroom, FactsStudent } from "@/lib/facts";

export type SyncDb = PgDatabase<PgQueryResultHKT, typeof schema>;

export type SyncDeps = { db: SyncDb; facts: FactsClient; now?: () => Date };

export type SyncCounts = { people: number; students: number; staff: number; flagged: number };

export type SyncResult =
  | { outcome: "applied"; runId: number; counts: SyncCounts }
  | { outcome: "failed"; runId: number; detail: string }
  | { outcome: "in_flight" };

// The FACTS snapshot applies transactionally. Missing records are retained as
// inactive, but that flag intentionally never revokes request-time access.
export async function sync(deps: SyncDeps): Promise<SyncResult> {
  const { db, facts, now = () => new Date() } = deps;
  let opened: { id: number };
  try {
    [opened] = await db.insert(syncRun).values({ startedAt: now() }).returning({ id: syncRun.id });
  } catch (error) {
    // The partial unique index is the concurrency gate. The browser is also
    // disabled for the same condition, but it is not an authorization boundary.
    if (isInFlightConflict(error)) return { outcome: "in_flight" };
    throw error;
  }
  const runId = opened.id;
  const empty: SyncCounts = { people: 0, students: 0, staff: 0, flagged: 0 };
  const close = (outcome: "applied" | "failed", counts: SyncCounts, detail: string | null) =>
    db.update(syncRun).set({
      finishedAt: now(), outcome, peopleCount: counts.people, studentCount: counts.students,
      staffCount: counts.staff, flaggedCount: counts.flagged, detail,
    }).where(eq(syncRun.id, runId));

  try {
    const [students, staff, homerooms, gradeLevels] = await Promise.all([
      facts.fetchEnrolledStudents(),
      facts.fetchActiveStaff(),
      facts.fetchHomerooms(),
      facts.fetchGradeLevels(),
    ]);
    // Homeroom teachers join the people batch: one of them is inactive in FACTS
    // and so absent from the staff fetch, and a homeroom must not read as
    // unstaffed just because its teacher left the active set (#54).
    const people = await facts.fetchPeople([
      ...students.map((row) => row.studentId),
      ...staff.map((row) => row.staffId),
      ...homerooms.map((row) => row.staffId).filter((id): id is number => id !== null),
    ]);
    const enrolled = withHomerooms(students, homerooms);
    const incoming = { people: people.length, students: students.length, staff: staff.length };
    const flagged = await db.transaction(async (tx) => {
      const seenAt = now();
      let count = 0;
      if (people.length) await tx.insert(factsPerson).values(people.map((row) => ({ ...row, lastSeenAt: seenAt }))).onConflictDoUpdate({
        target: factsPerson.personId,
        set: {
          firstName: sql`excluded.first_name`, lastName: sql`excluded.last_name`,
          contactEmail: sql`excluded.contact_email`, pathToPicture: sql`excluded.path_to_picture`,
          birthdate: sql`excluded.birthdate`,
          inactive: false, lastSeenAt: seenAt,
        },
      });
      count += await flagMissing(tx, factsPerson, factsPerson.personId, people.map((row) => row.personId));
      if (enrolled.length) await tx.insert(factsStudent).values(enrolled.map((row) => ({ ...row, lastSeenAt: seenAt }))).onConflictDoUpdate({
        target: factsStudent.studentId,
        set: {
          gradeLevel: sql`excluded.grade_level`, status: sql`excluded.status`,
          enrolledSince: sql`excluded.enrolled_since`, homeroom: sql`excluded.homeroom`,
          room: sql`excluded.room`, homeroomStaffId: sql`excluded.homeroom_staff_id`,
          inactive: false, lastSeenAt: seenAt,
        },
      });
      count += await flagMissing(tx, factsStudent, factsStudent.studentId, students.map((row) => row.studentId));
      if (staff.length) await tx.insert(factsStaff).values(staff.map((row) => ({ ...row, lastSeenAt: seenAt }))).onConflictDoUpdate({
        target: factsStaff.staffId,
        set: {
          firstName: sql`excluded.first_name`, middleName: sql`excluded.middle_name`,
          lastName: sql`excluded.last_name`, department: sql`excluded.department`,
          inactive: false, lastSeenAt: seenAt,
        },
      });
      count += await flagMissing(tx, factsStaff, factsStaff.staffId, staff.map((row) => row.staffId));
      if (gradeLevels.length) await tx.insert(factsGradeLevel).values(gradeLevels.map((row) => ({ ...row, lastSeenAt: seenAt }))).onConflictDoUpdate({
        target: factsGradeLevel.gradeLevel,
        set: { sortOrder: sql`excluded.sort_order`, inactive: false, lastSeenAt: seenAt },
      });
      count += await flagMissing(tx, factsGradeLevel, factsGradeLevel.gradeLevel, gradeLevels.map((row) => row.gradeLevel));
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

function isInFlightConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "23505" && "constraint" in error
    && error.constraint === "sync_run_one_in_flight") return true;
  return "cause" in error && isInFlightConflict(error.cause);
}

export async function latestSyncRun(db: SyncDb) {
  const [run] = await db.select().from(syncRun).orderBy(desc(syncRun.id)).limit(1);
  return run ?? null;
}

// The enrolled roster with each student's homeroom folded in. The homeroom
// endpoint can't be filtered, so a row for someone outside the roster fetch is
// dropped rather than allowed to invent a student.
function withHomerooms(students: FactsStudent[], homerooms: FactsHomeroom[]) {
  const byStudent = new Map(homerooms.map((row) => [row.studentId, row]));
  return students.map((row) => {
    const assigned = byStudent.get(row.studentId);
    return {
      ...row,
      homeroom: assigned?.homeroom ?? null,
      room: assigned?.room ?? null,
      homeroomStaffId: assigned?.staffId ?? null,
    };
  });
}

async function flagMissing(
  tx: SyncDb,
  table: typeof factsPerson | typeof factsStudent | typeof factsStaff | typeof factsGradeLevel,
  idColumn: Parameters<typeof notInArray>[0],
  presentIds: (number | string)[],
): Promise<number> {
  const active = eq(table.inactive, false);
  const flagged = await tx.update(table).set({ inactive: true }).where(
    presentIds.length ? and(active, notInArray(idColumn, presentIds)) : active,
  ).returning({ inactive: table.inactive });
  return flagged.length;
}
