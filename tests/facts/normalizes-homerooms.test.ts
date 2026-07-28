import { describe, expect, it } from "vitest";

import { type FactsRow, toHomerooms } from "@/lib/facts/normalize";

// A realistic /People/StudentsHomeroom row: the student, the homeroom label,
// where it meets, and who runs it — all in one response.
const wireHomeroom = (overrides: Record<string, unknown> = {}): FactsRow =>
  ({
    studentReference: { studentId: 1203006, link: { rel: "self", href: "…" } },
    homeRoom: "08 Smith",
    classReference: { classId: 11109 },
    staffReference: { staffId: 1202753 },
    // Redundant with the combined label above, so the portal doesn't keep them.
    name: "08",
    section: "Smith",
    room: "109",
    schoolIdReference: { schoolId: 1 },
    ...overrides,
  }) as FactsRow;

describe("FACTS homeroom normalization", () => {
  it("returns the approved homeroom fields and nothing else", () => {
    expect(toHomerooms([wireHomeroom()])).toEqual([
      { studentId: 1203006, homeroom: "08 Smith", room: "109", staffId: 1202753 },
    ]);
  });

  it("treats a blank label, room or teacher as absent", () => {
    const rows = [
      wireHomeroom({ studentId: 1, homeRoom: "  K Jones  ", room: "  12  " }),
      wireHomeroom({ homeRoom: "   ", room: "", staffReference: {} }),
      wireHomeroom({ homeRoom: null, room: null, staffReference: undefined }),
    ];

    expect(toHomerooms(rows)).toMatchObject([
      { homeroom: "K Jones", room: "12", staffId: 1202753 },
      { homeroom: null, room: null, staffId: null },
      { homeroom: null, room: null, staffId: null },
    ]);
  });

  it("drops a row that names no student — there is nothing to attach it to", () => {
    const rows = [wireHomeroom({ studentReference: {} }), wireHomeroom({ studentReference: undefined })];

    expect(toHomerooms(rows)).toEqual([]);
  });
});
