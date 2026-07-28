import { describe, expect, it } from "vitest";

import {
  groupByGradeLevel,
  NO_GRADE_LEVEL,
  NO_HOMEROOM,
  type StudentEntry,
} from "@/lib/students";

// listStudents has already done the reading and the ordering; grouping only
// decides the buckets, so these entries carry just what it looks at.
const entry = (
  studentId: number,
  name: string,
  gradeLevel: string | null,
  homeroom: string | null = null,
): StudentEntry => ({
  studentId,
  name,
  initials: "",
  gradeLevel,
  homeroom,
  photoUrl: null,
  contactEmail: null,
});

// The school's own order, as FACTS sorts it: PS, JK, TK, K, then 01 up.
const schoolOrder = [
  { gradeLevel: "PS", sortOrder: 1 },
  { gradeLevel: "JK", sortOrder: 2 },
  { gradeLevel: "TK", sortOrder: 3 },
  { gradeLevel: "K", sortOrder: 4 },
  { gradeLevel: "01", sortOrder: 5 },
];

// What a grade level holds, flattened, for the assertions that are about the
// grade level rather than the homerooms inside it.
const studentIds = (group: { homerooms: { students: StudentEntry[] }[] }) =>
  group.homerooms.flatMap((homeroom) => homeroom.students.map((student) => student.studentId));

describe("groupByGradeLevel", () => {
  it("reads grade levels in FACTS' sort order, never alphabetically", () => {
    const groups = groupByGradeLevel(
      [entry(10, "Ada Lovelace", "01"), entry(11, "Grace Hopper", "K"), entry(12, "Alan Turing", "PS")],
      schoolOrder,
    );

    expect(groups.map((group) => group.gradeLevel)).toEqual(["PS", "K", "01"]);
  });

  it("honours the school's order however the grade levels arrive", () => {
    const groups = groupByGradeLevel(
      [entry(10, "Ada Lovelace", "01"), entry(11, "Grace Hopper", "JK"), entry(12, "Alan Turing", "TK")],
      [...schoolOrder].reverse(),
    );

    expect(groups.map((group) => group.gradeLevel)).toEqual(["JK", "TK", "01"]);
  });

  it("splits a grade level into its homerooms, keeping listStudents' order", () => {
    const hrA = "01 HR-A";
    const hrB = "01 HR-B";
    const groups = groupByGradeLevel(
      [
        entry(10, "Ada Lovelace", "01", hrA),
        entry(11, "Alan Turing", "01", hrA),
        entry(12, "Grace Hopper", "01", hrB),
      ],
      schoolOrder,
    );

    expect(groups).toEqual([
      {
        gradeLevel: "01",
        homerooms: [
          {
            homeroom: "01 HR-A",
            students: [entry(10, "Ada Lovelace", "01", hrA), entry(11, "Alan Turing", "01", hrA)],
          },
          {
            homeroom: "01 HR-B",
            students: [entry(12, "Grace Hopper", "01", hrB)],
          },
        ],
      },
    ]);
  });

  it("keeps a homeroom apart from the same-named one in another grade level", () => {
    // FACTS' labels carry the grade, so this doesn't arise at this school — but
    // the buckets are per grade level regardless, not global.
    const hr = "HR-A";
    const groups = groupByGradeLevel(
      [entry(10, "Ada Lovelace", "K", hr), entry(11, "Grace Hopper", "01", hr)],
      schoolOrder,
    );

    expect(groups.map((group) => studentIds(group))).toEqual([[10], [11]]);
  });

  it("names the run FACTS assigned no homeroom", () => {
    // Roughly 62 of 536, concentrated in preschool and kindergarten. Named
    // rather than left loose under the grade level heading.
    const groups = groupByGradeLevel(
      [
        entry(10, "Ada Lovelace", "PS", "*0PS - HR-A"),
        entry(11, "Grace Hopper", "PS"),
      ],
      schoolOrder,
    );

    expect(groups[0].homerooms.map(({ homeroom }) => homeroom)).toEqual(["*0PS - HR-A", NO_HOMEROOM]);
  });

  it("gives every assigned homeroom a heading", () => {
    const groups = groupByGradeLevel(
      [entry(10, "Ada Lovelace", "01", "01 HR-A")],
      schoolOrder,
    );

    expect(groups[0].homerooms).toMatchObject([{ homeroom: "01 HR-A" }]);
  });

  it("shows no group for a grade level nobody is in", () => {
    const groups = groupByGradeLevel([entry(10, "Ada Lovelace", "K")], schoolOrder);

    expect(groups.map((group) => group.gradeLevel)).toEqual(["K"]);
  });

  it("files a student FACTS gave no matching grade level under a named bucket, last", () => {
    // The alternative is a child who is simply not in the list, which is the
    // one outcome the roster must never have.
    const groups = groupByGradeLevel(
      [entry(10, "Ada Lovelace", null), entry(11, "Grace Hopper", "K"), entry(12, "Alan Turing", "99")],
      schoolOrder,
    );

    expect(groups.map((group) => group.gradeLevel)).toEqual(["K", NO_GRADE_LEVEL]);
    expect(studentIds(groups[1])).toEqual([10, 12]);
  });

  it("files everyone under the named bucket when the snapshot has no grade levels", () => {
    const groups = groupByGradeLevel([entry(10, "Ada Lovelace", "K")], []);

    expect(groups).toEqual([
      {
        gradeLevel: NO_GRADE_LEVEL,
        homerooms: [
          { homeroom: NO_HOMEROOM, students: [entry(10, "Ada Lovelace", "K")] },
        ],
      },
    ]);
  });

  it("has no groups for an empty roster", () => {
    expect(groupByGradeLevel([], schoolOrder)).toEqual([]);
  });
});
