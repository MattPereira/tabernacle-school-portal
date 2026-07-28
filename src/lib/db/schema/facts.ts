// Read-only FACTS snapshot (students / people / staff). NEVER authoritative.
// FACTS always wins and there is no write-back (CONTEXT.md, Sync). Nothing here
// gates access at request time, including inactive rows.
import { boolean, date, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// The FACTS personId is the natural key across all three tables — FACTS mints
// it, we never do. People.personId == Students.studentId == Staff.staffId.
// (personStudentId is a *different* id space; joining on it attaches unrelated
// people's names — verified against the Workspace export. Don't use it.)

// Deliberately no foreign keys between these tables: FACTS has students whose
// /People row is missing, and a data-quality wart on their side must not abort
// our whole sync.

// Columns every FACTS snapshot table carries, so "is this still in FACTS?" is asked
// the same way everywhere.
const snapshotFields = {
  // A record that leaves the FACTS active set is retained and flagged inactive.
  // Sync never revokes access; Workspace suspension is the real kill switch.
  inactive: boolean().notNull().default(false),
  // When sync last saw this record in the FACTS active set. On a flagged row,
  // this is when it was last seen — i.e. roughly when it went inactive.
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
};

export const factsPerson = pgTable("facts_person", {
  personId: integer("person_id").primaryKey(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  // Contact email — FACTS owns it and request-time identity derives from it.
  contactEmail: text("contact_email"),
  // Filename of the profile photo FACTS hosts. The bytes stay on FACTS' tenant
  // site; the portal keeps the name and derives the URL (lib/facts/pictures).
  pathToPicture: text("path_to_picture"),
  // A calendar date, not an instant: a birthday doesn't move with a timezone.
  // Stored for everyone the snapshot covers because FACTS populates it here and
  // not on the student record; no staff-facing surface displays it (CONTEXT.md,
  // Professional staff profile).
  birthdate: date(),
  ...snapshotFields,
});

export const factsStudent = pgTable("facts_student", {
  studentId: integer("student_id").primaryKey(),
  gradeLevel: text("grade_level"),
  // FACTS school.status verbatim, e.g. "Enrolled". Stored as text because
  // it's their vocabulary, not ours to model.
  status: text(),
  // FACTS' school.enrollDate — the day this enrolment began, as a calendar date.
  enrolledSince: date("enrolled_since"),
  // The homeroom, as the student-homeroom endpoint reports it: FACTS' combined
  // label ("K Smith"), the room it meets in, and who runs it. 1:1 with the
  // student, so it sits here rather than in a table of its own. Deliberately no
  // foreign key on the staff id — FACTS has homerooms held by staff who left
  // the active set, and that must not abort a sync.
  homeroom: text(),
  room: text(),
  homeroomStaffId: integer("homeroom_staff_id"),
  ...snapshotFields,
});

// The school's own grade levels — the vocabulary facts_student.gradeLevel draws
// from, keyed by that same name, plus the order FACTS sorts them in. That order
// is why this table exists: PS, JK, TK, K, 01–08 is not alphabetical and is not
// ours to hardcode.
export const factsGradeLevel = pgTable("facts_grade_level", {
  gradeLevel: text("grade_level").primaryKey(),
  sortOrder: integer("sort_order"),
  ...snapshotFields,
});

export const factsStaff = pgTable("facts_staff", {
  staffId: integer("staff_id").primaryKey(),
  // The professional staff profile FACTS' staff endpoint owns — its own name
  // parts, not the person row's, so a staff member is listable even when their
  // /People row is missing. Department is FACTS' text; blank means absent.
  firstName: text("first_name"),
  middleName: text("middle_name"),
  lastName: text("last_name"),
  department: text(),
  ...snapshotFields,
});

export type FactsPersonRow = typeof factsPerson.$inferSelect;
export type FactsStudentRow = typeof factsStudent.$inferSelect;
export type FactsStaffRow = typeof factsStaff.$inferSelect;
export type FactsGradeLevelRow = typeof factsGradeLevel.$inferSelect;
