// Narrowing the roster by name. Lives apart from ./index because this is the
// one piece of the Students module the browser runs: the search box filters an
// already-loaded roster, and importing the read seam would drag the database
// client into the client bundle with it.
import type { StudentEntry, StudentGroup } from "./index";

// Matching narrows *within* the grade level and homeroom groups rather than
// flattening them, so a search still answers "which class is this child in?" —
// the thing the roster is for. A homeroom nobody matches drops out, and so does
// a grade level left with no homerooms; an empty search is the whole roster. A
// student FACTS holds no person row for has no name to match, so no query
// reaches them — they are findable by scrolling their homeroom, where the gap
// is visible anyway.
export function searchStudents(groups: StudentGroup[], query: string): StudentGroup[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return groups;

  return groups
    .map((group) => ({
      ...group,
      homerooms: group.homerooms
        .map((homeroom) => ({
          ...homeroom,
          students: homeroom.students.filter((entry) => matches(entry, needle)),
        }))
        .filter((homeroom) => homeroom.students.length > 0),
    }))
    .filter((group) => group.homerooms.length > 0);
}

// Any part of the name, not just its start: staff search for the surname as
// often as the given name, and FACTS holds both in one string here.
const matches = (entry: StudentEntry, needle: string) => entry.name.toLowerCase().includes(needle);
