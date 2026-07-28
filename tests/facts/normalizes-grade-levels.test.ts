import { describe, expect, it } from "vitest";

import { type FactsRow, toGradeLevels } from "@/lib/facts/normalize";

// A realistic /Academics/GradeLevels row: the school's grade-level
// configuration, of which the portal wants the name and the school's own order.
const wireGradeLevel = (overrides: Record<string, unknown> = {}): FactsRow =>
  ({
    gradeLevelId: 7,
    gradeLevelName: "01",
    sortOrder: 5,
    // Configuration the portal has no use for.
    finalGradeLevel: false,
    capacity: 30,
    elementary: true,
    reportCardTemplate: "Elementary RC",
    attendanceMethod: "Daily",
    nextGradeLevelReference: { gradeLevel: "02" },
    ...overrides,
  }) as FactsRow;

describe("FACTS grade-level normalization", () => {
  it("returns the grade level's name and the school's sort order, and nothing else", () => {
    expect(toGradeLevels([wireGradeLevel()])).toEqual([{ gradeLevel: "01", sortOrder: 5 }]);
  });

  it("trims the name and treats a missing sort order as absent", () => {
    const rows = [
      wireGradeLevel({ gradeLevelName: "  PS  " }),
      wireGradeLevel({ gradeLevelName: "JK", sortOrder: null }),
      wireGradeLevel({ gradeLevelName: "TK", sortOrder: undefined }),
    ];

    expect(toGradeLevels(rows)).toEqual([
      { gradeLevel: "PS", sortOrder: 5 },
      { gradeLevel: "JK", sortOrder: null },
      { gradeLevel: "TK", sortOrder: null },
    ]);
  });

  it("drops a nameless grade level — the name is what students are filed under", () => {
    const rows = [wireGradeLevel({ gradeLevelName: "  " }), wireGradeLevel({ gradeLevelName: null })];

    expect(toGradeLevels(rows)).toEqual([]);
  });
});
