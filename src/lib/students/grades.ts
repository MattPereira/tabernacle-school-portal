// Narrowing the roster to one grade level, and counting what each holds. Lives
// apart from ./index for the same reason ./search does: this is the browser's
// half of the Students module, and importing the read seam would drag the
// database client into the client bundle with it.
import type { StudentGroup } from "./index";

// The grade levels the roster actually holds someone in, in the order it
// already puts them — the school's own order, not alphabetical
// (groupByGradeLevel owns that). Read off the whole roster rather than a search
// result on purpose: a chip row that reshuffles as you type stops being a
// stable place to aim at.
export function gradeLevelsIn(groups: StudentGroup[]): string[] {
  return groups.map((group) => group.gradeLevel);
}

// The roster showing one grade level, or all of them. `null` is "all", which is
// what the page starts on: the whole school is still the default answer, and
// picking a grade is the shortcut, not the price of entry. A grade level no
// group carries narrows to nothing rather than silently falling back to
// everything — an empty answer to a question nobody can ask.
export function selectGradeLevel(
  groups: StudentGroup[],
  gradeLevel: string | null,
): StudentGroup[] {
  if (gradeLevel === null) return groups;

  return groups.filter((group) => group.gradeLevel === gradeLevel);
}

// How many students a grade level holds, across its homerooms.
export function countStudents(group: StudentGroup): number {
  return group.homerooms.reduce((count, homeroom) => count + homeroom.students.length, 0);
}
