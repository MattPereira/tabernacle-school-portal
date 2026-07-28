import { describe, expect, it } from "vitest";

import type { StudentEntry, StudentGroup } from "@/lib/students";
import { countStudents, gradeLevelsIn, selectGradeLevel } from "@/lib/students/grades";

const entry = (studentId: number, name: string): StudentEntry => ({
  studentId,
  name,
  initials: "",
  gradeLevel: null,
  homeroom: null,
  homeroomTeacher: null,
  photoUrl: null,
  contactEmail: null,
});

const kindergarten: StudentGroup = {
  gradeLevel: "K",
  homerooms: [
    { homeroom: "*K- HR-A", teacher: "Sylvia Borde", students: [entry(10, "Ada Lovelace")] },
    {
      homeroom: "*K- HR-B",
      teacher: "Cecilia Prior",
      students: [entry(11, "Alan Turing"), entry(12, "Katherine Johnson")],
    },
  ],
};

const first: StudentGroup = {
  gradeLevel: "01",
  homerooms: [{ homeroom: "01 HR-A", teacher: "Alexis Jue", students: [entry(13, "Grace Hopper")] }],
};

const roster: StudentGroup[] = [kindergarten, first];

describe("countStudents", () => {
  it("counts a grade level across its homerooms", () => {
    expect(countStudents(kindergarten)).toBe(3);
  });

  it("counts a grade level nobody is in as none", () => {
    expect(countStudents({ gradeLevel: "08", homerooms: [] })).toBe(0);
  });
});

describe("gradeLevelsIn", () => {
  it("keeps the roster's own grade-level order rather than sorting the labels", () => {
    expect(gradeLevelsIn(roster)).toEqual(["K", "01"]);
  });

  it("has nothing to offer for an empty roster", () => {
    expect(gradeLevelsIn([])).toEqual([]);
  });
});

describe("selectGradeLevel", () => {
  it("shows every grade level when none is picked", () => {
    expect(selectGradeLevel(roster, null)).toEqual(roster);
  });

  it("shows the picked grade level whole, homerooms and all", () => {
    expect(selectGradeLevel(roster, "K")).toEqual([kindergarten]);
  });

  it("shows nothing for a grade level the roster has no group for", () => {
    expect(selectGradeLevel(roster, "08")).toEqual([]);
  });
});
