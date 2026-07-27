// Portal-owned operational state. Identity and roles are FACTS-derived.
import { integer, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// What a sync run did. `applied` touched the FACTS snapshot; `failed` rolled back and
// left it exactly as it was. There is no "refused" outcome: sync applies
// whatever FACTS says, because flag-don't-revoke makes a bad pull cost flags,
// not data (see the note on sync()). These are the two *terminal* outcomes; a
// null outcome means the run is still in flight or crashed before finishing
// (ADR-0003).
export const syncOutcomeEnum = pgEnum("sync_outcome", ["applied", "failed"]);

export type SyncOutcome = (typeof syncOutcomeEnum.enumValues)[number];

// One row per run, created when the run *starts* and finalized when it *ends*
// (ADR-0003). A crash leaves a visible half-run rather than nothing. It is the
// home page's answer to "did the last sync work?". Written *outside* the FACTS snapshot
// transaction, so an abort or failure still leaves a record behind instead of
// rolling its own evidence back. `outcome`/`finishedAt` are null until the run
// finishes.
export const syncRun = pgTable("sync_run", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  outcome: syncOutcomeEnum(),
  peopleCount: integer("people_count").notNull().default(0),
  studentCount: integer("student_count").notNull().default(0),
  staffCount: integer("staff_count").notNull().default(0),
  // Rows newly flagged inactive by this run (flag-don't-revoke).
  flaggedCount: integer("flagged_count").notNull().default(0),
  // Abort reason or error message; null on a clean run.
  detail: text(),
}, (table) => [
  // A partial unique index makes the home-page disabled state authoritative:
  // concurrent requests cannot both open a run.
  uniqueIndex("sync_run_one_in_flight").on(sql`(1)`).where(sql`${table.outcome} is null`),
]);

export type SyncRun = typeof syncRun.$inferSelect;
