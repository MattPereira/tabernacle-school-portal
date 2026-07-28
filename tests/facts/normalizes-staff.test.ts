import { describe, expect, it } from "vitest";

import { createFactsClient } from "@/lib/facts";

// One page of /people/Staff, straight off the wire. The client is the only
// place FACTS' JSON shape is known, so this is where "only approved fields
// cross the interface" is asserted.
function staffClient(rows: Record<string, unknown>[]) {
  const fetch = async () =>
    new Response(JSON.stringify({ results: rows, pageCount: 1 }), { status: 200 });
  return createFactsClient({
    subscriptionKey: "sub",
    apiKey: "key",
    fetch: fetch as unknown as typeof globalThis.fetch,
  });
}

// A realistic row: FACTS sends far more than the professional staff profile.
const wireStaff = (overrides: Record<string, unknown> = {}) => ({
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
});

describe("FACTS staff normalization", () => {
  it("returns the approved staff fields and nothing else", async () => {
    const facts = staffClient([wireStaff()]);

    expect(await facts.fetchActiveStaff()).toEqual([
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
    const facts = staffClient([
      wireStaff({ staffId: 1, department: "  Elementary  " }),
      wireStaff({ staffId: 2, department: "   " }),
      wireStaff({ staffId: 3, department: null }),
    ]);

    expect(await facts.fetchActiveStaff()).toMatchObject([
      { staffId: 1, department: "Elementary" },
      { staffId: 2, department: null },
      { staffId: 3, department: null },
    ]);
  });

  it("treats missing name parts as absent", async () => {
    const facts = staffClient([
      wireStaff({ middleName: "", lastName: undefined, firstName: "  Jane  " }),
    ]);

    expect(await facts.fetchActiveStaff()).toMatchObject([
      { firstName: "Jane", middleName: null, lastName: null },
    ]);
  });

  it("keeps staff whose staffDirectoryBlock is set", async () => {
    // FACTS' directory-block flag is theirs, not ours: it does not decide who
    // the portal lists (#49, Implementation Decisions).
    const facts = staffClient([wireStaff({ staffDirectoryBlock: true })]);

    expect(await facts.fetchActiveStaff()).toHaveLength(1);
  });

  it("drops staff FACTS no longer marks active", async () => {
    const facts = staffClient([wireStaff({ staffId: 1 }), wireStaff({ staffId: 2, active: false })]);

    expect(await facts.fetchActiveStaff()).toMatchObject([{ staffId: 1 }]);
  });
});
