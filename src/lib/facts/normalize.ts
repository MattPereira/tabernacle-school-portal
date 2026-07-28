// What crosses the FACTS boundary, and nothing else. FACTS returns far more
// than the portal is allowed to keep, so the projection from wire row to domain
// record is a decision — kept here, pure and testable, rather than buried in
// the fetching wiring next door (docs/conventions.md, Testing).
//
// The Swagger contract lives in reference/facts/api-definitions.json — read it
// there, don't re-derive it from this file (docs/conventions.md §5).

// What sync consumes. Normalized off the wire here so the rule modules never
// learn FACTS' JSON shape — they see people, students and staff.
export type FactsPerson = {
  personId: number;
  firstName: string | null;
  lastName: string | null;
  // Contact email. FACTS owns it; staff access derives from an exact match.
  contactEmail: string | null;
  // The filename of the profile photo FACTS hosts, trimmed. Blank means "no
  // photo"; turning it into a URL is ./pictures' job, not this projection's.
  pathToPicture: string | null;
  // A calendar day, `YYYY-MM-DD`. FACTS populates this on the person record and
  // not on the student one, so it arrives here for the whole snapshot
  // population; no staff-facing surface displays it (CONTEXT.md).
  birthdate: string | null;
};

export type FactsStudent = {
  studentId: number;
  gradeLevel: string | null;
  status: string | null;
  // The day this enrolment began, as a calendar day.
  enrolledSince: string | null;
};

// A student's homeroom, from the endpoint that owns it. The student record has
// a `homeroom` field of its own, but it is blank on every row at this school —
// this is the source that means something.
export type FactsHomeroom = {
  studentId: number;
  // FACTS' combined homeroom label, trimmed — its separate name and section
  // fields say the same thing twice, so they stop here.
  homeroom: string | null;
  room: string | null;
  // Who runs the homeroom. Not necessarily anyone in the active staff set.
  staffId: number | null;
};

// One of the school's grade levels: the name students are filed under, and the
// order the school puts them in.
export type FactsGradeLevel = {
  gradeLevel: string;
  sortOrder: number | null;
};

// The professional staff profile, as FACTS' staff endpoint owns it. Only the
// approved fields cross this interface — everything else FACTS sends (spouse,
// phones, HR dates, demographics, …) stops here (CONTEXT.md).
export type FactsStaff = {
  staffId: number;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  // FACTS' own department text, trimmed. Blank means "no department".
  department: string | null;
};

// Only the fields we actually read; FACTS returns far more.
export type FactsRow = {
  personId?: number;
  studentId?: number;
  staffId?: number;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  department?: string | null;
  email?: string | null;
  pathToPicture?: string | null;
  birthdate?: string | null;
  active?: boolean;
  school?: { gradeLevel?: string | null; status?: string | null; enrollDate?: string | null };
  // /People/StudentsHomeroom. FACTS wraps its foreign keys in reference objects
  // on this endpoint, where the student and staff endpoints send them flat.
  studentReference?: { studentId?: number | null };
  staffReference?: { staffId?: number | null };
  homeRoom?: string | null;
  room?: string | null;
  // /Academics/GradeLevels.
  gradeLevelName?: string | null;
  sortOrder?: number | null;
};

// FACTS pads free-text fields and sends blanks for "not set" — both mean absent.
const trimmedOrNull = (value: string | null | undefined): string | null => value?.trim() || null;

// FACTS sends calendar dates as midnight-UTC instants ("2016-05-26T00:00:00Z").
// Keep the day and drop the instant: a birthday or an enrolment day that can
// shift under a timezone is worse than none at all.
const dayOrNull = (value: string | null | undefined): string | null =>
  /^\d{4}-\d{2}-\d{2}/.exec(value?.trim() ?? "")?.[0] ?? null;

// Absent stays absent: `Number(null)` is 0, which would invent an id or a
// sort order out of a missing field.
const numberOrNull = (value: number | null | undefined): number | null =>
  value == null || !Number.isFinite(Number(value)) ? null : Number(value);

// The student record's own `homeroom` field is deliberately not read: it is
// blank on every row at this school, so it would only ever be a false absence.
export const toStudents = (rows: FactsRow[]): FactsStudent[] =>
  rows.map((row) => ({
    studentId: Number(row.studentId),
    gradeLevel: row.school?.gradeLevel ?? null,
    status: row.school?.status ?? null,
    enrolledSince: dayOrNull(row.school?.enrollDate),
  }));

// A row naming no student has nothing to attach itself to, so it stops here
// rather than reaching sync as a homeroom for student `NaN`.
export const toHomerooms = (rows: FactsRow[]): FactsHomeroom[] =>
  rows
    .map((row) => ({
      studentId: numberOrNull(row.studentReference?.studentId),
      homeroom: trimmedOrNull(row.homeRoom),
      room: trimmedOrNull(row.room),
      staffId: numberOrNull(row.staffReference?.staffId),
    }))
    .filter((assignment): assignment is FactsHomeroom => assignment.studentId !== null);

// The name is the key students are filed under, so a nameless grade level is
// not a grade level the portal can use.
export const toGradeLevels = (rows: FactsRow[]): FactsGradeLevel[] =>
  rows
    .map((row) => ({
      gradeLevel: trimmedOrNull(row.gradeLevelName),
      sortOrder: numberOrNull(row.sortOrder),
    }))
    .filter((level): level is FactsGradeLevel => level.gradeLevel !== null);

// The staff endpoint returns former staff too; `active` is the live flag, and
// the only one that decides inclusion. It is a *staff* flag, not FACTS' junk
// `administrator` role signal — and `staffDirectoryBlock` is FACTS' own
// directory setting, which means nothing to the portal (#49).
export const toActiveStaff = (rows: FactsRow[]): FactsStaff[] =>
  rows
    .filter((row) => row.active)
    .map((row) => ({
      staffId: Number(row.staffId),
      firstName: trimmedOrNull(row.firstName),
      middleName: trimmedOrNull(row.middleName),
      lastName: trimmedOrNull(row.lastName),
      department: trimmedOrNull(row.department),
    }));

export const toPeople = (rows: FactsRow[]): FactsPerson[] =>
  rows.map((row) => ({
    personId: Number(row.personId),
    firstName: row.firstName ?? null,
    lastName: row.lastName ?? null,
    contactEmail: row.email || null,
    pathToPicture: trimmedOrNull(row.pathToPicture),
    birthdate: dayOrNull(row.birthdate),
  }));
