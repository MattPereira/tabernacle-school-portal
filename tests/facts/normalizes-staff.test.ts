import { describe, expect, it } from "vitest";

import { type FactsRow, toActiveStaff } from "@/lib/facts/normalize";

// A realistic /people/Staff row: FACTS sends far more than the professional
// staff profile, and this is the seam that decides what survives.
const wireStaff = (overrides: Record<string, unknown> = {}): FactsRow =>
  ({
    staffId: 1203006,
    active: true,
    firstName: "Jane",
    middleName: "Q",
    lastName: "Doe",
    department: "Middle School",
    // None of the below is approved data (CONTEXT.md, Professional staff profile).
    spouse: "Sam Doe",
    workPhone: "555-555-5555",
    occupation: "Teacher",
    fte: 1,
    startDate: "2019-08-01",
    endDate: null,
    financialFamilyId: 8812,
    parentAlertPin: "1234",
    administrator: true,
    demographics: { person: { birthdate: "1980-01-01", cellPhone: "555-000-0000" } },
    ...overrides,
  }) as FactsRow;

describe("FACTS staff normalization", () => {
  it("returns the approved staff fields and nothing else", async () => {
    expect(toActiveStaff([wireStaff()])).toEqual([
      {
        staffId: 1203006,
        firstName: "Jane",
        middleName: "Q",
        lastName: "Doe",
        department: "Middle School",
      },
    ]);
  });

  it("trims department and treats a blank one as absent", async () => {
    const rows = [
      wireStaff({ staffId: 1, department: "  Elementary  " }),
      wireStaff({ staffId: 2, department: "   " }),
      wireStaff({ staffId: 3, department: null }),
    ];

    expect(toActiveStaff(rows)).toMatchObject([
      { staffId: 1, department: "Elementary" },
      { staffId: 2, department: null },
      { staffId: 3, department: null },
    ]);
  });

  it("treats missing name parts as absent", async () => {
    const rows = [wireStaff({ middleName: "", lastName: undefined, firstName: "  Jane  " })];

    expect(toActiveStaff(rows)).toMatchObject([
      { firstName: "Jane", middleName: null, lastName: null },
    ]);
  });

  it("keeps staff whose staffDirectoryBlock is set", async () => {
    // FACTS' directory-block flag is theirs, not ours: it does not decide who
    // the portal lists (#49, Implementation Decisions).
    expect(toActiveStaff([wireStaff({ staffDirectoryBlock: true })])).toHaveLength(1);
  });

  it("drops staff FACTS no longer marks active", async () => {
    const rows = [wireStaff({ staffId: 1 }), wireStaff({ staffId: 2, active: false })];

    expect(toActiveStaff(rows)).toMatchObject([{ staffId: 1 }]);
  });
});
