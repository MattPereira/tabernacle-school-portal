import { and, eq, isNotNull, notInArray, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { identityLink, mirrorPerson, mirrorStaff, mirrorStudent, syncRun } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import type { FactsClient, FactsPerson } from "@/lib/facts";

// Driver-agnostic, exactly like lib/identity: Neon in production, PGlite in
// tests, and the deep module never learns which one it got.
export type SyncDb = PgDatabase<PgQueryResultHKT, typeof schema>;

export type SyncDeps = {
  db: SyncDb;
  facts: FactsClient;
  // Injected so a run's timestamps are assertable.
  now?: () => Date;
};


// A FACTS person nobody can log in as yet. The admin screen's work queue: it
// lists these with suggestions and the admin confirms one in a click
// (ADR-0001 §6). Sync itself never acts on them.
export type UnlinkedPerson = {
  personId: number;
  firstName: string | null;
  lastName: string | null;
  // Google logins that already exist as portal accounts but aren't linked to
  // any FACTS person, whose address looks like this person's name. A hint for
  // the admin, never an automatic link.
  suggestions: string[];
};

export type SyncCounts = {
  people: number;
  students: number;
  staff: number;
  flagged: number;
  unlinked: number;
};

export type SyncResult =
  | { outcome: "applied"; runId: number; counts: SyncCounts; unlinkedPeople: UnlinkedPerson[] }
  | { outcome: "failed"; runId: number; detail: string };

// Sync deliberately has no "that looks wrong, refusing to apply" guard. An
// implausibly small FACTS response — a bad filter, a truncated page — flags a
// lot of people inactive, and that is the whole of the damage: nothing is
// deleted, nobody loses access (ADR-0001), and the next good run un-flags
// everyone automatically. The cost is a noisy admin screen for one run, which
// the admin clears in a click; a threshold guard would buy that back at the
// price of a knob to tune and a force flag to remember. Superseded #13 §4.
export async function sync(deps: SyncDeps): Promise<SyncResult> {
  const { db, facts, now = () => new Date() } = deps;
  const startedAt = now();

  const record = (outcome: "applied" | "failed", counts: SyncCounts, detail: string | null) =>
    db
      .insert(syncRun)
      .values({
        startedAt,
        finishedAt: now(),
        outcome,
        peopleCount: counts.people,
        studentCount: counts.students,
        staffCount: counts.staff,
        flaggedCount: counts.flagged,
        unlinkedCount: counts.unlinked,
        detail,
      })
      .returning({ id: syncRun.id });

  const empty: SyncCounts = { people: 0, students: 0, staff: 0, flagged: 0, unlinked: 0 };

  try {
    const [students, staff] = await Promise.all([
      facts.fetchEnrolledStudents(),
      facts.fetchActiveStaff(),
    ]);
    // One /People read covers both populations — students and staff share the
    // personId space, and a staffer who is also a parent appears once.
    const people = await facts.fetchPeople([
      ...students.map((s) => s.studentId),
      ...staff.map((s) => s.staffId),
    ]);

    const incoming = { people: people.length, students: students.length, staff: staff.length };

    // All-or-nothing: every mirrored table moves together or none of them do,
    // so a mid-sync failure can never leave students pointing at last week's
    // staff (CONTEXT.md, Sync).
    const flagged = await db.transaction(async (tx) => {
      const seenAt = now();
      let count = 0;

      if (people.length) {
        await tx
          .insert(mirrorPerson)
          .values(
            people.map((p) => ({
              personId: p.personId,
              firstName: p.firstName,
              lastName: p.lastName,
              contactEmail: p.contactEmail,
              lastSeenAt: seenAt,
            })),
          )
          .onConflictDoUpdate({
            target: mirrorPerson.personId,
            set: {
              firstName: sql`excluded.first_name`,
              lastName: sql`excluded.last_name`,
              contactEmail: sql`excluded.contact_email`,
              // Seen again: un-flag. Returning to FACTS is as ordinary as
              // leaving it, and neither touches anyone's access.
              inactive: false,
              lastSeenAt: seenAt,
            },
          });
      }
      count += await flagMissing(
        tx,
        mirrorPerson,
        mirrorPerson.personId,
        people.map((p) => p.personId),
      );

      if (students.length) {
        await tx
          .insert(mirrorStudent)
          .values(
            students.map((s) => ({
              studentId: s.studentId,
              gradeLevel: s.gradeLevel,
              status: s.status,
              lastSeenAt: seenAt,
            })),
          )
          .onConflictDoUpdate({
            target: mirrorStudent.studentId,
            set: {
              gradeLevel: sql`excluded.grade_level`,
              status: sql`excluded.status`,
              inactive: false,
              lastSeenAt: seenAt,
            },
          });
      }
      count += await flagMissing(
        tx,
        mirrorStudent,
        mirrorStudent.studentId,
        students.map((s) => s.studentId),
      );

      if (staff.length) {
        await tx
          .insert(mirrorStaff)
          .values(staff.map((s) => ({ staffId: s.staffId, lastSeenAt: seenAt })))
          .onConflictDoUpdate({
            target: mirrorStaff.staffId,
            set: { inactive: false, lastSeenAt: seenAt },
          });
      }
      count += await flagMissing(
        tx,
        mirrorStaff,
        mirrorStaff.staffId,
        staff.map((s) => s.staffId),
      );

      return count;
    });

    // Read-only, and deliberately after the commit: this is a report for the
    // admin screen, not part of the atomic swap. Note what's absent — sync
    // never inserts, updates or deletes identity_link. Link rows come from
    // seeding or an explicit admin action, only (ADR-0001, Amendment).
    const unlinkedPeople = await findUnlinkedPeople(db);

    const counts: SyncCounts = { ...incoming, flagged, unlinked: unlinkedPeople.length };
    const [run] = await record("applied", counts, null);

    return { outcome: "applied", runId: run.id, counts, unlinkedPeople };
  } catch (error) {
    // The transaction has already rolled back, so the mirror is exactly as it
    // was. Record the failure outside it — evidence of a failed run mustn't
    // roll back with the run.
    const detail = error instanceof Error ? error.message : String(error);
    const [run] = await record("failed", empty, detail);
    return { outcome: "failed", runId: run.id, detail };
  }
}

// Flag-don't-revoke: everything not in the incoming set is marked inactive and
// kept. Returns how many rows this run newly flagged (already-flagged rows
// aren't re-counted, so the number means "left FACTS since last sync").
async function flagMissing(
  tx: SyncDb,
  table: typeof mirrorPerson | typeof mirrorStudent | typeof mirrorStaff,
  idColumn: Parameters<typeof notInArray>[0],
  presentIds: number[],
): Promise<number> {
  const stillHere = eq(table.inactive, false);
  const flagged = await tx
    .update(table)
    .set({ inactive: true })
    // notInArray on an empty list is invalid SQL — and with nothing incoming,
    // everything we hold is missing anyway.
    .where(presentIds.length ? and(stillHere, notInArray(idColumn, presentIds)) : stillHere)
    .returning({ inactive: table.inactive });

  return flagged.length;
}

// FACTS people nobody can log in as: mirrored, active, and no link row points
// at them. Portal accounts with no FACTS person (the ~7 staff FACTS will never
// track) are the pool we suggest from.
async function findUnlinkedPeople(db: SyncDb): Promise<UnlinkedPerson[]> {
  const linkedIds = db
    .select({ id: identityLink.factsPersonId })
    .from(identityLink)
    .where(isNotNull(identityLink.factsPersonId));

  const [unlinked, candidates] = await Promise.all([
    db
      .select({
        personId: mirrorPerson.personId,
        firstName: mirrorPerson.firstName,
        lastName: mirrorPerson.lastName,
      })
      .from(mirrorPerson)
      .where(
        and(eq(mirrorPerson.inactive, false), notInArray(mirrorPerson.personId, linkedIds)),
      ),
    db
      .select({ googleEmail: identityLink.googleEmail })
      .from(identityLink)
      .where(sql`${identityLink.factsPersonId} is null`),
  ]);

  return unlinked.map((person) => ({
    ...person,
    suggestions: candidates
      .filter((c) => looksLikeName(c.googleEmail, person))
      .map((c) => c.googleEmail),
  }));
}

const letters = (value: string | null) => (value ?? "").toLowerCase().replace(/[^a-z]/g, "");

// Does this address look like it was minted from this person's name? The school
// mints logins by concatenating pieces of the two names — `27beno@tbs.org` for
// Benjamin Olson — so we accept any prefix of one name followed by any prefix
// of the other, in either order, ignoring digits and punctuation.
//
// Tuned loose on purpose: a wrong suggestion costs the admin a glance, while a
// missing one costs them a manual search. Nothing here links anybody.
export function looksLikeName(
  email: string,
  person: Pick<FactsPerson, "firstName" | "lastName">,
): boolean {
  const local = letters(email.split("@")[0]);
  const first = letters(person.firstName);
  const last = letters(person.lastName);
  if (!local || !first || !last) return false;

  return isPrefixPair(local, first, last) || isPrefixPair(local, last, first);
}

// local == (non-empty prefix of a) + (non-empty prefix of b)?
function isPrefixPair(local: string, a: string, b: string): boolean {
  for (let split = 1; split < local.length; split++) {
    if (a.startsWith(local.slice(0, split)) && b.startsWith(local.slice(split))) return true;
  }
  return false;
}
