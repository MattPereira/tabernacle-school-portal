// Narrowing the roster by name. Lives apart from ./index because this is the
// one piece of the Students module the browser runs: the search box filters an
// already-loaded roster, and importing the read seam would drag the database
// client into the client bundle with it.
import type { StudentEntry, StudentGroup } from "./index";

// Matching narrows *within* grade-level groups rather than flattening them, so
// a search still answers "which grade is this child in?". A grade level nobody
// matches drops out; an empty search is the whole roster. A student FACTS holds
// no person row for has no name to match, so no query reaches them — they are
// findable by scrolling their grade level, where the gap is visible anyway.
export function searchStudents(groups: StudentGroup[], query: string): StudentGroup[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return groups;

  return groups
    .map((group) => ({ ...group, students: group.students.filter((entry) => matches(entry, needle)) }))
    .filter((group) => group.students.length > 0);
}

// Any part of the name, not just its start: staff search for the surname as
// often as the given name, and FACTS holds both in one string here.
const matches = (entry: StudentEntry, needle: string) => entry.name.toLowerCase().includes(needle);
