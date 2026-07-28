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
};

export type FactsStudent = {
  studentId: number;
  gradeLevel: string | null;
  status: string | null;
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
  active?: boolean;
  school?: { gradeLevel?: string | null; status?: string | null };
};

// FACTS pads free-text fields and sends blanks for "not set" — both mean absent.
const trimmedOrNull = (value: string | null | undefined): string | null => value?.trim() || null;

export const toStudents = (rows: FactsRow[]): FactsStudent[] =>
  rows.map((row) => ({
    studentId: Number(row.studentId),
    gradeLevel: row.school?.gradeLevel ?? null,
    status: row.school?.status ?? null,
  }));

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
  }));
