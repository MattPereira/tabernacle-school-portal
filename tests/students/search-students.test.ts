import { describe, expect, it } from "vitest";

import type { StudentEntry, StudentGroup } from "@/lib/students";
import { searchStudents } from "@/lib/students/search";

const entry = (studentId: number, name: string): StudentEntry => ({
  studentId,
  name,
  initials: "",
  gradeLevel: null,
  homeroom: null,
  photoUrl: null,
});

const roster: StudentGroup[] = [
  { gradeLevel: "K", students: [entry(10, "Ada Lovelace"), entry(11, "Alan Turing")] },
  { gradeLevel: "01", students: [entry(12, "Grace Hopper")] },
];

describe("searchStudents", () => {
  it("shows the whole roster for an empty search", () => {
    expect(searchStudents(roster, "")).toEqual(roster);
    expect(searchStudents(roster, "   ")).toEqual(roster);
  });

  it("narrows within grade-level groups rather than flattening them", () => {
    expect(searchStudents(roster, "a")).toEqual([
      { gradeLevel: "K", students: [entry(10, "Ada Lovelace"), entry(11, "Alan Turing")] },
      { gradeLevel: "01", students: [entry(12, "Grace Hopper")] },
    ]);
  });

  it("drops a grade level nobody in it matches", () => {
    expect(searchStudents(roster, "hopper")).toEqual([
      { gradeLevel: "01", students: [entry(12, "Grace Hopper")] },
    ]);
  });

  it("matches any part of the name, ignoring case and surrounding space", () => {
    expect(searchStudents(roster, "  LOVE  ")).toEqual([
      { gradeLevel: "K", students: [entry(10, "Ada Lovelace")] },
    ]);
  });

  it("has nothing to show when no name matches", () => {
    expect(searchStudents(roster, "zzz")).toEqual([]);
  });
});
