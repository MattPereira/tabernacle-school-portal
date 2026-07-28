import { describe, expect, it } from "vitest";

import type { StudentEntry, StudentGroup } from "@/lib/students";
import { searchStudents } from "@/lib/students/search";

const entry = (studentId: number, name: string): StudentEntry => ({
  studentId,
  name,
  initials: "",
  gradeLevel: null,
  homeroom: null,
  homeroomTeacher: null,
  photoUrl: null,
});

const roster: StudentGroup[] = [
  {
    gradeLevel: "K",
    homerooms: [
      { homeroom: "*K- HR-A", teacher: "Sylvia Borde", students: [entry(10, "Ada Lovelace")] },
      { homeroom: "*K- HR-B", teacher: "Cecilia Prior", students: [entry(11, "Alan Turing")] },
    ],
  },
  {
    gradeLevel: "01",
    homerooms: [
      { homeroom: "01 HR-A", teacher: "Alexis Jue", students: [entry(12, "Grace Hopper")] },
    ],
  },
];

describe("searchStudents", () => {
  it("shows the whole roster for an empty search", () => {
    expect(searchStudents(roster, "")).toEqual(roster);
    expect(searchStudents(roster, "   ")).toEqual(roster);
  });

  it("narrows within grade-level and homeroom groups rather than flattening them", () => {
    expect(searchStudents(roster, "a")).toEqual(roster);
  });

  it("drops a homeroom nobody in it matches, and the grade level left empty", () => {
    expect(searchStudents(roster, "hopper")).toEqual([
      {
        gradeLevel: "01",
        homerooms: [
          { homeroom: "01 HR-A", teacher: "Alexis Jue", students: [entry(12, "Grace Hopper")] },
        ],
      },
    ]);
  });

  it("keeps the grade level when only one of its homerooms matches", () => {
    expect(searchStudents(roster, "turing")).toEqual([
      {
        gradeLevel: "K",
        homerooms: [
          { homeroom: "*K- HR-B", teacher: "Cecilia Prior", students: [entry(11, "Alan Turing")] },
        ],
      },
    ]);
  });

  it("matches any part of the name, ignoring case and surrounding space", () => {
    expect(searchStudents(roster, "  LOVE  ")).toEqual([
      {
        gradeLevel: "K",
        homerooms: [
          { homeroom: "*K- HR-A", teacher: "Sylvia Borde", students: [entry(10, "Ada Lovelace")] },
        ],
      },
    ]);
  });

  it("has nothing to show when no name matches", () => {
    expect(searchStudents(roster, "zzz")).toEqual([]);
  });
});
