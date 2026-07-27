import { and, desc, eq, inArray, isNotNull, notInArray, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { identityLink, factsPerson, factsStaff, factsStudent, syncRun } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import type { SyncRun } from "@/lib/db/schema";
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


// An existing portal account that looks like it belongs to this FACTS person.
// Carries the row id, not just the address, because "confirm in one click"
// (ADR-0001 §6) means pointing *that* row at this person — the account already
// exists, it just isn't linked to FACTS yet.
export type LinkSuggestion = {
  linkId: number;
  googleEmail: string;
};

// A FACTS person nobody can log in as yet. The admin screen's work queue: it
// lists these with suggestions and the admin confirms one in a click
// (ADR-0001 §6). Sync itself never acts on them.
export type UnlinkedPerson = {
  personId: number;
  firstName: string | null;
  lastName: string | null;
  // Portal accounts not linked to any FACTS person whose address looks like
  // this person's name. A hint for the admin, never an automatic link.
  suggestions: LinkSuggestion[];
};

// A person a sync flagged as gone from FACTS, tagged with the run that did it
// (ADR-0003) so the admin can see which run to blame and clear its flags
// wholesale. Person-centric like UnlinkedPerson: the three FACTS snapshot tables share
// one id space, so a person flagged in any of them is one entry here, named
// from facts_person when it holds a row for them.
export type FlaggedPerson = {
  personId: number;
  firstName: string | null;
  lastName: string | null;
  flaggedByRunId: number;
  // When the flagging run started — enough for the admin to spot "the 3am run
  // misfired" without joining the run log themselves.
  flaggedAt: Date;
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

  // Open the run before touching FACTS (ADR-0003): its id is what stamps the
  // rows this run flags, and the row is written outside the FACTS snapshot transaction,
  // so a crash leaves a visible half-run (null outcome) instead of nothing.
  const [opened] = await db.insert(syncRun).values({ startedAt }).returning({ id: syncRun.id });
  const runId = opened.id;

  const close = (outcome: "applied" | "failed", counts: SyncCounts, detail: string | null) =>
    db
      .update(syncRun)
      .set({
        finishedAt: now(),
        outcome,
        peopleCount: counts.people,
        studentCount: counts.students,
        staffCount: counts.staff,
        flaggedCount: counts.flagged,
        unlinkedCount: counts.unlinked,
        detail,
      })
      .where(eq(syncRun.id, runId));

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

    // All-or-nothing: every FACTS snapshot table moves together or none of them do,
    // so a mid-sync failure can never leave students pointing at last week's
    // staff (CONTEXT.md, Sync).
    const flagged = await db.transaction(async (tx) => {
      const seenAt = now();
      let count = 0;

      if (people.length) {
        await tx
          .insert(factsPerson)
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
            target: factsPerson.personId,
            set: {
              firstName: sql`excluded.first_name`,
              lastName: sql`excluded.last_name`,
              contactEmail: sql`excluded.contact_email`,
              // Seen again: un-flag, and drop the run that flagged it. Returning
              // to FACTS is as ordinary as leaving it, and neither touches
              // anyone's access.
              inactive: false,
              flaggedByRunId: null,
              lastSeenAt: seenAt,
            },
          });
      }
      count += await flagMissing(
        tx,
        factsPerson,
        factsPerson.personId,
        people.map((p) => p.personId),
        runId,
      );

      if (students.length) {
        await tx
          .insert(factsStudent)
          .values(
            students.map((s) => ({
              studentId: s.studentId,
              gradeLevel: s.gradeLevel,
              status: s.status,
              lastSeenAt: seenAt,
            })),
          )
          .onConflictDoUpdate({
            target: factsStudent.studentId,
            set: {
              gradeLevel: sql`excluded.grade_level`,
              status: sql`excluded.status`,
              inactive: false,
              flaggedByRunId: null,
              lastSeenAt: seenAt,
            },
          });
      }
      count += await flagMissing(
        tx,
        factsStudent,
        factsStudent.studentId,
        students.map((s) => s.studentId),
        runId,
      );

      if (staff.length) {
        await tx
          .insert(factsStaff)
          .values(staff.map((s) => ({ staffId: s.staffId, lastSeenAt: seenAt })))
          .onConflictDoUpdate({
            target: factsStaff.staffId,
            set: { inactive: false, flaggedByRunId: null, lastSeenAt: seenAt },
          });
      }
      count += await flagMissing(
        tx,
        factsStaff,
        factsStaff.staffId,
        staff.map((s) => s.staffId),
        runId,
      );

      return count;
    });

    // Read-only, and deliberately after the commit: this is a report for the
    // admin screen, not part of the atomic swap. Note what's absent — sync
    // never inserts, updates or deletes identity_link. Link rows come from
    // seeding or an explicit admin action, only (ADR-0001, Amendment).
    const queue = await unlinkedPeople(db);

    const counts: SyncCounts = { ...incoming, flagged, unlinked: queue.length };
    await close("applied", counts, null);

    return { outcome: "applied", runId, counts, unlinkedPeople: queue };
  } catch (error) {
    // The transaction has already rolled back, so the FACTS snapshot is exactly as it
    // was. Close the run outside it — evidence of a failed run mustn't roll
    // back with the run.
    const detail = error instanceof Error ? error.message : String(error);
    await close("failed", empty, detail);
    return { outcome: "failed", runId, detail };
  }
}

// "Did the last sync work?" — the admin screen's only answer, and null until
// the button has been pressed once. Ordered by id rather than startedAt because
// id is monotonic: two runs in the same second still order correctly, and a
// failed run must be allowed to be the latest one.
export async function latestSyncRun(db: SyncDb): Promise<SyncRun | null> {
  const [run] = await db.select().from(syncRun).orderBy(desc(syncRun.id)).limit(1);
  return run ?? null;
}

// The flagged-inactive queue, each person tagged with the run that flagged them
// (ADR-0003). The admin groups these by run to spot a misfire and clear it
// wholesale.
//
// Reads all three FACTS snapshot tables, not only facts_person. FACTS has students
// with no /People row (facts.ts), and clearRunFlags already clears all three —
// so listing only the person table hides exactly the rows whose clear button
// the admin needs, and hides them permanently, since no /People row will ever
// appear to reveal them.
export async function flaggedPeople(db: SyncDb): Promise<FlaggedPerson[]> {
  const [people, students, staff] = await Promise.all([
    db
      .select({ personId: factsPerson.personId, runId: factsPerson.flaggedByRunId })
      .from(factsPerson)
      .where(eq(factsPerson.inactive, true)),
    db
      .select({ personId: factsStudent.studentId, runId: factsStudent.flaggedByRunId })
      .from(factsStudent)
      .where(eq(factsStudent.inactive, true)),
    db
      .select({ personId: factsStaff.staffId, runId: factsStaff.flaggedByRunId })
      .from(factsStaff)
      .where(eq(factsStaff.inactive, true)),
  ]);

  // One entry per person per run: a departing student is flagged in two tables
  // by the same run, and that is one human to the admin. A flag carrying no run
  // is an orphan from before ADR-0003 — there is no run to clear it by, so it
  // can't be listed under one; a fresh run re-flagging them fixes that.
  const flags = new Map<string, { personId: number; runId: number }>();
  for (const row of [...people, ...students, ...staff]) {
    if (row.runId === null) continue;
    flags.set(`${row.personId}:${row.runId}`, { personId: row.personId, runId: row.runId });
  }
  if (flags.size === 0) return [];

  const entries = [...flags.values()];
  const [names, runs] = await Promise.all([
    db
      .select({
        personId: factsPerson.personId,
        firstName: factsPerson.firstName,
        lastName: factsPerson.lastName,
      })
      .from(factsPerson)
      .where(
        inArray(
          factsPerson.personId,
          entries.map((entry) => entry.personId),
        ),
      ),
    db
      .select({ id: syncRun.id, startedAt: syncRun.startedAt })
      .from(syncRun)
      .where(
        inArray(
          syncRun.id,
          entries.map((entry) => entry.runId),
        ),
      ),
  ]);

  const nameOf = new Map(names.map((name) => [name.personId, name]));
  const startedAt = new Map(runs.map((run) => [run.id, run.startedAt]));

  return entries
    .flatMap((entry) => {
      const flaggedAt = startedAt.get(entry.runId);
      // Runs are never deleted, so this is unreachable — but an entry with no
      // run has no clear button, and listing it would only mislead.
      if (!flaggedAt) return [];
      const name = nameOf.get(entry.personId);
      return [
        {
          personId: entry.personId,
          firstName: name?.firstName ?? null,
          lastName: name?.lastName ?? null,
          flaggedByRunId: entry.runId,
          flaggedAt,
        },
      ];
    })
    .sort((a, b) => a.flaggedByRunId - b.flaggedByRunId || a.personId - b.personId);
}

// Undo a misfired run wholesale (ADR-0003): every row that run flagged, across
// all three FACTS snapshot tables, goes active again. The admin's escape hatch for a
// sync that obviously pulled too little — the thing that makes shipping without
// the <50% guard safe rather than a gamble. Idempotent, and a no-op for a run
// whose flags a healthy re-sync has already cleared.
export async function clearRunFlags(db: SyncDb, runId: number): Promise<void> {
  const unflag = { inactive: false, flaggedByRunId: null };
  await db.transaction(async (tx) => {
    for (const table of [factsPerson, factsStudent, factsStaff]) {
      await tx.update(table).set(unflag).where(eq(table.flaggedByRunId, runId));
    }
  });
}

// Flag-don't-revoke: everything not in the incoming set is marked inactive and
// kept. Returns how many rows this run newly flagged (already-flagged rows
// aren't re-counted, so the number means "left FACTS since last sync").
async function flagMissing(
  tx: SyncDb,
  table: typeof factsPerson | typeof factsStudent | typeof factsStaff,
  idColumn: Parameters<typeof notInArray>[0],
  presentIds: number[],
  runId: number,
): Promise<number> {
  const stillHere = eq(table.inactive, false);
  const flagged = await tx
    .update(table)
    .set({ inactive: true, flaggedByRunId: runId })
    // notInArray on an empty list is invalid SQL — and with nothing incoming,
    // everything we hold is missing anyway.
    .where(presentIds.length ? and(stillHere, notInArray(idColumn, presentIds)) : stillHere)
    .returning({ inactive: table.inactive });

  return flagged.length;
}

// FACTS people nobody can log in as: in the FACTS snapshot, active, and no link row points
// at them. Portal accounts with no FACTS person (the ~7 staff FACTS will never
// track) are the pool we suggest from.
//
// Exported because the admin screen asks the same question on every page view,
// and the answer must not depend on having just run a sync — the queue shrinks
// as the admin links people, between syncs.
export async function unlinkedPeople(db: SyncDb): Promise<UnlinkedPerson[]> {
  const linkedIds = db
    .select({ id: identityLink.factsPersonId })
    .from(identityLink)
    .where(isNotNull(identityLink.factsPersonId));

  const [unlinked, candidates] = await Promise.all([
    db
      .select({
        personId: factsPerson.personId,
        firstName: factsPerson.firstName,
        lastName: factsPerson.lastName,
      })
      .from(factsPerson)
      .where(
        and(eq(factsPerson.inactive, false), notInArray(factsPerson.personId, linkedIds)),
      ),
    db
      .select({ linkId: identityLink.id, googleEmail: identityLink.googleEmail })
      .from(identityLink)
      .where(sql`${identityLink.factsPersonId} is null`),
  ]);

  return unlinked.map((person) => ({
    ...person,
    suggestions: candidates.filter((c) => looksLikeName(c.googleEmail, person)),
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
