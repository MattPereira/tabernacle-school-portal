// The Students read seam: the portal's answer to "who is enrolled right now?",
// read from the FACTS snapshot rather than from FACTS itself, so browsing never
// waits on the rate-limited API. FACTS stays authoritative; nothing here writes.
import { asc, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

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
  // FACTS' combined homeroom label. Null for the students FACTS has assigned no
  // homeroom — a gap the page shows rather than hides.
  homeroom: string | null;
  // The FACTS-hosted photo, already derived and vetted here so the page only
  // has to render it. Null covers "no photo" and "not a usable filename"
  // alike — both show initials, and neither is the page's decision.
  photoUrl: string | null;
};

// One of the school's grade levels and where the school puts it in the order.
export type GradeLevel = { gradeLevel: string; sortOrder: number | null };

// One grade level's students, in the order Students shows them.
export type StudentGroup = { gradeLevel: string; students: StudentEntry[] };

// Where a student goes when their grade level matches no grade level FACTS
// configures. Named rather than dropped: a child missing from the roster is the
// one outcome this list must never have.
export const NO_GRADE_LEVEL = "No grade level";

// Currently enrolled students only: sync fetches the enrolled population and
// flags whoever has left it, so an unflagged row is a child who is here now.
export async function listStudents(deps: StudentDeps): Promise<StudentEntry[]> {
  const rows = await deps.db
    .select({
      studentId: factsStudent.studentId,
      gradeLevel: factsStudent.gradeLevel,
      homeroom: factsStudent.homeroom,
      firstName: factsPerson.firstName,
      lastName: factsPerson.lastName,
      pathToPicture: factsPerson.pathToPicture,
    })
    .from(factsStudent)
    // Left join: FACTS has students with no /People row, and that data wart
    // must not hide a child — only their name and photo.
    .leftJoin(factsPerson, eq(factsPerson.personId, factsStudent.studentId))
    .where(eq(factsStudent.inactive, false))
    // A roster order: surname first, case-insensitive, with the hidden student
    // id making the order total so two identical names never swap between
    // reads. A student with no person row has no surname to sort on, so
    // Postgres' default puts them last in their grade level.
    .orderBy(
      sql`lower(${factsPerson.lastName})`,
      sql`lower(${factsPerson.firstName})`,
      asc(factsStudent.studentId),
    );

  return rows.map(({ firstName, lastName, pathToPicture, ...entry }) => ({
    ...entry,
    name: [firstName, lastName].filter(Boolean).join(" "),
    initials: initials(firstName, lastName),
    photoUrl: factsPictureUrl(pathToPicture),
  }));
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
// ours to hardcode. Within a grade level the entries keep listStudents' surname
// order. A grade level nobody is in shows no heading.
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
    .map((level) => ({ gradeLevel: level.gradeLevel, students: buckets.get(level.gradeLevel) ?? [] }));

  const unmatched = buckets.get(NO_GRADE_LEVEL);
  return unmatched ? [...groups, { gradeLevel: NO_GRADE_LEVEL, students: unmatched }] : groups;
}
