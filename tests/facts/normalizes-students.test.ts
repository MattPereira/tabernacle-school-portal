import { describe, expect, it } from "vitest";

import { type FactsRow, toStudents } from "@/lib/facts/normalize";

// A realistic /Students row: the student record carries the enrolment block and
// a pile of fields the portal is not allowed to keep.
const wireStudent = (overrides: Record<string, unknown> = {}): FactsRow =>
  ({
    studentId: 1203006,
    personStudentId: 1568,
    configSchoolId: 1,
    schoolCode: "TCS-CA",
    school: {
      status: "Enrolled",
      substatus: "",
      enrollDate: "2016-05-26T00:00:00Z",
      gradeLevel: "08",
      nextStatus: "Graduate",
    },
    // None of the below is approved data (CONTEXT.md).
    gender: "F",
    birthdate: "2011-04-02T00:00:00Z",
    busOrCarpool: "Carpool",
    advisorId: "1202753",
    locker: [{ id: 1, name: "109" }],
    ...overrides,
  }) as FactsRow;

describe("FACTS student normalization", () => {
  it("returns the approved student fields and nothing else", () => {
    expect(toStudents([wireStudent()])).toEqual([
      {
        studentId: 1203006,
        gradeLevel: "08",
        status: "Enrolled",
        enrolledSince: "2016-05-26",
      },
    ]);
  });

  it("keeps the enrolment date as a calendar day, not an instant", () => {
    // FACTS sends midnight UTC; a date that can shift a day under a timezone is
    // worse than no date at all.
    const rows = [
      wireStudent({ studentId: 1, school: { enrollDate: "2016-05-26T00:00:00Z" } }),
      wireStudent({ studentId: 2, school: { enrollDate: "" } }),
      wireStudent({ studentId: 3, school: {} }),
      wireStudent({ studentId: 4, school: undefined }),
    ];

    expect(toStudents(rows)).toMatchObject([
      { enrolledSince: "2016-05-26" },
      { enrolledSince: null },
      { enrolledSince: null },
      { enrolledSince: null },
    ]);
  });

  it("ignores the student record's own homeroom field", () => {
    // Blank on every row at this school, so it says nothing — the homeroom the
    // portal shows comes from the student-homeroom endpoint instead.
    expect(toStudents([wireStudent({ homeroom: "K Smith" })])[0]).not.toHaveProperty("homeroom");
  });
});
