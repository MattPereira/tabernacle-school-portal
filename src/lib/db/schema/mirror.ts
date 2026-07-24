// Read-only mirror of FACTS (students / people / staff). NEVER authoritative.
// FACTS always wins and there is no write-back (CONTEXT.md, Sync). Nothing here
// gates access — that is identity_link's job, so a stale or broken mirror can
// never lock anyone out.
import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// The FACTS personId is the natural key across all three tables — FACTS mints
// it, we never do. People.personId == Students.studentId == Staff.staffId.
// (personStudentId is a *different* id space; joining on it attaches unrelated
// people's names — verified against the Workspace export. Don't use it.)

// Deliberately no foreign keys between these tables: FACTS has students whose
// /People row is missing, and a data-quality wart on their side must not abort
// our whole sync.

// Columns every mirrored table carries, so "is this still in FACTS?" is asked
// the same way everywhere.
const mirrored = {
  // Flag-don't-revoke: a record that leaves the FACTS active set is flagged for
  // the admin, never deleted. Sync never revokes access; Workspace suspension
  // is the real kill switch (CONTEXT.md, Sync).
  inactive: boolean().notNull().default(false),
  // When sync last saw this record in the FACTS active set. On a flagged row,
  // this is when it was last seen — i.e. roughly when it went inactive.
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
  // The sync_run that flagged this row, so a misfired run's flags can be cleared
  // wholesale (ADR-0003). Null iff active — set with `inactive`, cleared with it.
  // No FK by the same rule as the rest of the mirror: a data wart must never
  // abort a sync (and identity_link.facts_person_id is a plain int for the
  // same reason).
  flaggedByRunId: integer("flagged_by_run_id"),
};

export const mirrorPerson = pgTable("mirror_person", {
  personId: integer("person_id").primaryKey(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  // Contact email — FACTS owns it. Mirrored for the office to read; the portal
  // never uses it for auth and never writes it back (ADR-0001 §3).
  contactEmail: text("contact_email"),
  ...mirrored,
});

export const mirrorStudent = pgTable("mirror_student", {
  studentId: integer("student_id").primaryKey(),
  gradeLevel: text("grade_level"),
  // FACTS school.status verbatim, e.g. "Enrolled". Mirrored as text because
  // it's their vocabulary, not ours to model.
  status: text(),
  ...mirrored,
});

export const mirrorStaff = pgTable("mirror_staff", {
  staffId: integer("staff_id").primaryKey(),
  ...mirrored,
});

export type MirrorPerson = typeof mirrorPerson.$inferSelect;
export type MirrorStudent = typeof mirrorStudent.$inferSelect;
export type MirrorStaff = typeof mirrorStaff.$inferSelect;
