// The Students read seam: the portal's answer to "who is enrolled right now?",
// read from the FACTS snapshot rather than from FACTS itself, so browsing never
// waits on the rate-limited API. FACTS stays authoritative; nothing here writes.
import { asc, eq, sql } from "drizzle-orm";
import { alias, type PgDatabase, type PgQueryResultHKT } from "drizzle-orm/pg-core";

import { factsGradeLevel, factsPerson, factsStudent } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import { initials } from "@/lib/facts/initials";
import { factsPictureUrl } from "@/lib/facts/pictures";

export type StudentDeps = { db: PgDatabase<PgQueryResultHKT, typeof schema> };

// One Student entry, display-ready: the page arranges these, it doesn't decide
// anything about them.
export type StudentEntry = {
  // FACTS' internal id. Carried for list keys and the ordering tie-break —
  // never rendered.
  studentId: number;
  // "First Last". Empty when FACTS has no person row for this student, which
  // happens and must not cost the school a child in the list.
  name: string;
  // What stands in for a photo: first and last initials, so "Ada Lovelace"
  // reads AL (lib/facts/initials).
  initials: string;
  // FACTS' grade-level name, e.g. "PS", "K", "08". The bucket the entry belongs
  // to; putting those buckets in order is groupByGradeLevel's job.
  gradeLevel: string | null;
  // FACTS' combined homeroom label, and what keeps a grade level's classmates
  // adjacent: listStudents sorts on it ahead of the name. Null for the students
  // FACTS has assigned no homeroom — a gap the page shows rather than hides.
  homeroom: string | null;
  // Who runs that homeroom, "First Last", read from the person record rather
  // than the staff set: FACTS has homerooms held by staff it no longer marks
  // active, and their name is still the right one to print. Null when the
  // homeroom has no staff id, or that id has no person row.
  homeroomTeacher: string | null;
  // The FACTS-hosted photo, already derived and vetted here so the page only
  // has to render it. Null covers "no photo" and "not a usable filename"
  // alike — both show initials, and neither is the page's decision.
  photoUrl: string | null;
};

// One of the school's grade levels and where the school puts it in the order.
export type GradeLevel = { gradeLevel: string; sortOrder: number | null };

// One homeroom's students within a grade level: the heading the page prints
// over them, and the entries themselves in listStudents' order.
export type HomeroomGroup = {
  // FACTS' combined label verbatim ("01 HR-A", "*0PS - HR-A"). Not prettied up:
  // it is the code the office types into FACTS, and for the handful of students
  // FACTS files in another grade's homeroom it is the only thing that says so.
  homeroom: string;
  // The teacher's name, or null — a homeroom whose staff FACTS never filled in
  // still gets its heading, just a shorter one.
  teacher: string | null;
  students: StudentEntry[];
};

// One grade level's students, split into the homerooms they are taught in, in
// the order Students shows them.
export type StudentGroup = { gradeLevel: string; homerooms: HomeroomGroup[] };

// Where a student goes when their grade level matches no grade level FACTS
// configures. Named rather than dropped: a child missing from the roster is the
// one outcome this list must never have.
export const NO_GRADE_LEVEL = "No grade level";

// The same idea one level down: ~62 of 536 enrolled students have no homeroom,
// concentrated in preschool and kindergarten. They get a named heading at the
// end of their grade level rather than being hidden or left loose.
export const NO_HOMEROOM = "No homeroom";

// Currently enrolled students only: sync fetches the enrolled population and
// flags whoever has left it, so an unflagged row is a child who is here now.
export async function listStudents(deps: StudentDeps): Promise<StudentEntry[]> {
  // The same person table twice: once for the child, once for whoever runs
  // their homeroom.
  const homeroomTeacher = alias(factsPerson, "homeroom_teacher");

  const rows = await deps.db
    .select({
      studentId: factsStudent.studentId,
      gradeLevel: factsStudent.gradeLevel,
      homeroom: factsStudent.homeroom,
      firstName: factsPerson.firstName,
      lastName: factsPerson.lastName,
      pathToPicture: factsPerson.pathToPicture,
      teacherFirstName: homeroomTeacher.firstName,
      teacherLastName: homeroomTeacher.lastName,
    })
    .from(factsStudent)
    // Left join: FACTS has students with no /People row, and that data wart
    // must not hide a child — only their name and photo.
    .leftJoin(factsPerson, eq(factsPerson.personId, factsStudent.studentId))
    // Joined to the person record and not the staff set on purpose: one of this
    // school's homerooms is held by a staff member FACTS has since marked
    // inactive, and the heading should still carry their name.
    .leftJoin(homeroomTeacher, eq(homeroomTeacher.personId, factsStudent.homeroomStaffId))
    .where(eq(factsStudent.inactive, false))
    // A roster order: homeroom first, so a grade level reads as the classes it
    // is actually taught in rather than one long alphabet; then surname,
    // case-insensitive, with the hidden student id making the order total so
    // two identical names never swap between reads. The two nulls both fall to
    // the end of what they sort within: a student FACTS assigns no homeroom
    // trails their grade level, and a student with no person row has no surname
    // to sort on, so trails their homeroom.
    .orderBy(
      sql`${factsStudent.homeroom} asc nulls last`,
      sql`lower(${factsPerson.lastName})`,
      sql`lower(${factsPerson.firstName})`,
      asc(factsStudent.studentId),
    );

  return rows.map(
    ({ firstName, lastName, pathToPicture, teacherFirstName, teacherLastName, ...entry }) => ({
      ...entry,
      name: [firstName, lastName].filter(Boolean).join(" "),
      initials: initials(firstName, lastName),
      // Empty rather than null is what a join miss and a blank name both look
      // like here, and neither is a teacher to print.
      homeroomTeacher: [teacherFirstName, teacherLastName].filter(Boolean).join(" ") || null,
      photoUrl: factsPictureUrl(pathToPicture),
    }),
  );
}

// The school's grade levels, in the school's own order. Flagged rows are left
// out: a grade level FACTS no longer configures is not one to file anyone under.
export async function listGradeLevels(deps: StudentDeps): Promise<GradeLevel[]> {
  return deps.db
    .select({ gradeLevel: factsGradeLevel.gradeLevel, sortOrder: factsGradeLevel.sortOrder })
    .from(factsGradeLevel)
    .where(eq(factsGradeLevel.inactive, false))
    .orderBy(asc(factsGradeLevel.sortOrder), asc(factsGradeLevel.gradeLevel));
}

// The roster split into its grade levels, in the order FACTS sorts them — PS,
// JK, TK, K, 01–08, which is neither alphabetical nor numeric and so is not
// ours to hardcode — and each grade level split again into its homerooms. A
// grade level or a homeroom nobody is in shows no heading.
export function groupByGradeLevel(
  students: StudentEntry[],
  gradeLevels: GradeLevel[],
): StudentGroup[] {
  const buckets = new Map<string, StudentEntry[]>();
  const known = new Set(gradeLevels.map((level) => level.gradeLevel));

  for (const entry of students) {
    const key = entry.gradeLevel && known.has(entry.gradeLevel) ? entry.gradeLevel : NO_GRADE_LEVEL;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(entry);
    else buckets.set(key, [entry]);
  }

  // Sorted here rather than trusted from the caller, so the order is the
  // function's own guarantee. A grade level FACTS gave no sort order goes after
  // the ordered ones, by name, ahead of the unmatched bucket.
  const ordered = [...gradeLevels].sort(
    (a, b) =>
      (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
      a.gradeLevel.localeCompare(b.gradeLevel, undefined, { sensitivity: "base" }),
  );

  const groups = ordered
    .filter((level) => buckets.has(level.gradeLevel))
    .map((level) => ({
      gradeLevel: level.gradeLevel,
      homerooms: byHomeroom(buckets.get(level.gradeLevel) ?? []),
    }));

  const unmatched = buckets.get(NO_GRADE_LEVEL);
  return unmatched
    ? [...groups, { gradeLevel: NO_GRADE_LEVEL, homerooms: byHomeroom(unmatched) }]
    : groups;
}

// One grade level's entries split into their homerooms. No sorting happens
// here: listStudents already ordered the roster by homeroom with the unassigned
// last, so first-seen order is the order to keep, and the unassigned run lands
// at the end of the grade level on its own.
function byHomeroom(students: StudentEntry[]): HomeroomGroup[] {
  const buckets = new Map<string, HomeroomGroup>();

  for (const entry of students) {
    const key = entry.homeroom ?? NO_HOMEROOM;
    const bucket = buckets.get(key);
    if (bucket) bucket.students.push(entry);
    // The teacher comes from the first entry in the homeroom because it is a
    // property of the homeroom, not of the child: every student in it carries
    // the same name. The unassigned run is not a homeroom and so has none.
    else
      buckets.set(key, {
        homeroom: key,
        teacher: entry.homeroom ? entry.homeroomTeacher : null,
        students: [entry],
      });
  }

  return [...buckets.values()];
}
