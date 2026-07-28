import { describe, expect, it } from "vitest";

import { type FactsRow, toPeople } from "@/lib/facts/normalize";

// A realistic /People row: PersonVM carries the whole person record, and this
// is the seam that decides which of it the portal is allowed to keep.
const wirePerson = (overrides: Record<string, unknown> = {}): FactsRow =>
  ({
    personId: 1203006,
    firstName: "Jane",
    lastName: "Doe",
    email: "jdoe@tbs.org",
    pathToPicture: "1203006.jpg",
    // None of the below is approved data (CONTEXT.md, Professional staff profile).
    middleName: "Q",
    nickName: "Janie",
    birthdate: "1980-01-01T00:00:00Z",
    email2: "personal@gmail.com",
    cellPhone: "555-000-0000",
    homePhone: "555-111-1111",
    username: "jdoe",
    gender: "F",
    deceased: false,
    addressID: 4471,
    legacyPersonId: 22,
    ...overrides,
  }) as FactsRow;

describe("FACTS person normalization", () => {
  it("returns the approved person fields and nothing else", () => {
    expect(toPeople([wirePerson()])).toEqual([
      {
        personId: 1203006,
        firstName: "Jane",
        lastName: "Doe",
        contactEmail: "jdoe@tbs.org",
        pathToPicture: "1203006.jpg",
        birthdate: "1980-01-01",
      },
    ]);
  });

  it("keeps the birthdate as a calendar day, not an instant", () => {
    // FACTS sends midnight UTC. A birthday that shifts a day under a timezone
    // is worse than no birthday at all — and this is the only place FACTS
    // populates one, since the student record's own field is blank here.
    const rows = [
      wirePerson({ personId: 1, birthdate: "2011-04-02T00:00:00Z" }),
      wirePerson({ personId: 2, birthdate: "" }),
      wirePerson({ personId: 3, birthdate: null }),
      wirePerson({ personId: 4, birthdate: undefined }),
    ];

    expect(toPeople(rows)).toMatchObject([
      { birthdate: "2011-04-02" },
      { birthdate: null },
      { birthdate: null },
      { birthdate: null },
    ]);
  });

  it("treats a missing or blank picture path as absent", () => {
    const rows = [
      wirePerson({ personId: 1, pathToPicture: "  headshot.jpg  " }),
      wirePerson({ personId: 2, pathToPicture: "   " }),
      wirePerson({ personId: 3, pathToPicture: null }),
      wirePerson({ personId: 4, pathToPicture: undefined }),
    ];

    expect(toPeople(rows)).toMatchObject([
      { pathToPicture: "headshot.jpg" },
      { pathToPicture: null },
      { pathToPicture: null },
      { pathToPicture: null },
    ]);
  });
});
