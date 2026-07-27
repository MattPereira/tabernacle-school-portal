// Portal-owned truth (identity_link, sync_run). The authoritative side.
import { boolean, integer, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// Portal-owned, set at link creation, never derived from FACTS — whose role
// signals are junk (administrator=true on 48/70 active staff). ADR-0001.
export const roleEnum = pgEnum("identity_role", ["student", "staff"]);

export type Role = (typeof roleEnum.enumValues)[number];

// The allowlist: row exists = portal account exists. No self-registration;
// rows only ever come from seeding or an explicit admin action (ADR-0001).
export const identityLink = pgTable(
  "identity_link",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    // The login identity — the allowlist key. Stored lowercased; callers go
    // through resolveAccess, which normalizes before looking up.
    googleEmail: text("google_email").notNull(),
    // Optional FACTS link, deliberately NOT unique: many logins may map to one
    // FACTS person, but one login can never resolve to two people. Null means a
    // portal account with no FACTS person (~7 staff FACTS will never track) and
    // is admin-created only — sync can never mint it.
    factsPersonId: integer("facts_person_id"),
    role: roleEnum().notNull(),
    // Orthogonal to role: admin access is granted explicitly.
    admin: boolean().notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("identity_link_google_email_key").on(table.googleEmail)],
);

export type IdentityLink = typeof identityLink.$inferSelect;

// What a sync run did. `applied` touched the FACTS snapshot; `failed` rolled back and
// left it exactly as it was. There is no "refused" outcome: sync applies
// whatever FACTS says, because flag-don't-revoke makes a bad pull cost flags,
// not data (see the note on sync()). These are the two *terminal* outcomes; a
// null outcome means the run is still in flight or crashed before finishing
// (ADR-0003).
export const syncOutcomeEnum = pgEnum("sync_outcome", ["applied", "failed"]);

export type SyncOutcome = (typeof syncOutcomeEnum.enumValues)[number];

// One row per run, created when the run *starts* and finalized when it *ends*
// (ADR-0003) — so its id exists to stamp onto the rows this run flags, and a
// crash leaves a visible half-run rather than nothing. It's the admin screen's
// only answer to "did the last sync work?". Written *outside* the FACTS snapshot
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
  // FACTS people with no identity_link row, at the end of this run.
  unlinkedCount: integer("unlinked_count").notNull().default(0),
  // Abort reason or error message; null on a clean run.
  detail: text(),
});

export type SyncRun = typeof syncRun.$inferSelect;
