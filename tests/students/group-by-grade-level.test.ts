import { describe, expect, it } from "vitest";

import { groupByGradeLevel, NO_GRADE_LEVEL, type StudentEntry } from "@/lib/students";

// listStudents has already done the reading and the surname ordering; grouping
// only decides the buckets, so these entries carry just what it looks at.
const entry = (studentId: number, name: string, gradeLevel: string | null): StudentEntry => ({
  studentId,
  name,
  initials: "",
  gradeLevel,
  homeroom: null,
  photoUrl: null,
});

// The school's own order, as FACTS sorts it: PS, JK, TK, K, then 01 up.
const schoolOrder = [
  { gradeLevel: "PS", sortOrder: 1 },
  { gradeLevel: "JK", sortOrder: 2 },
  { gradeLevel: "TK", sortOrder: 3 },
  { gradeLevel: "K", sortOrder: 4 },
  { gradeLevel: "01", sortOrder: 5 },
];

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

  it("keeps listStudents' order within a grade level", () => {
    const groups = groupByGradeLevel(
      [entry(10, "Ada Lovelace", "K"), entry(11, "Grace Hopper", "PS"), entry(12, "Alan Turing", "K")],
      schoolOrder,
    );

    expect(groups).toEqual([
      { gradeLevel: "PS", students: [entry(11, "Grace Hopper", "PS")] },
      {
        gradeLevel: "K",
        students: [entry(10, "Ada Lovelace", "K"), entry(12, "Alan Turing", "K")],
      },
    ]);
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
    expect(groups[1].students.map((student) => student.studentId)).toEqual([10, 12]);
  });

  it("files everyone under the named bucket when the snapshot has no grade levels", () => {
    const groups = groupByGradeLevel([entry(10, "Ada Lovelace", "K")], []);

    expect(groups).toEqual([{ gradeLevel: NO_GRADE_LEVEL, students: [entry(10, "Ada Lovelace", "K")] }]);
  });

  it("has no groups for an empty roster", () => {
    expect(groupByGradeLevel([], schoolOrder)).toEqual([]);
  });
});
