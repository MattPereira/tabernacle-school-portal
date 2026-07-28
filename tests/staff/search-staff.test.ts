import { describe, expect, it } from "vitest";

import type { StaffEntry, StaffGroup } from "@/lib/staff";
import { searchStaff } from "@/lib/staff/search";

const entry = (staffId: number, name: string): StaffEntry => ({
  staffId,
  name,
  initials: "",
  department: null,
  homeroom: null,
  contactEmail: null,
  photoUrl: null,
});

const roster: StaffGroup[] = [
  { department: "Administration", staff: [entry(10, "Ada Lovelace")] },
  { department: "Faculty", staff: [entry(11, "Grace Hopper"), entry(12, "Alan Turing")] },
];

describe("searchStaff", () => {
  it("returns the complete roster for an empty search", () => {
    expect(searchStaff(roster, "   ")).toEqual(roster);
  });

  it("matches any part of a name and retains its department section", () => {
    expect(searchStaff(roster, "  HOPPER ")).toEqual([
      { department: "Faculty", staff: [entry(11, "Grace Hopper")] },
    ]);
  });

  it("removes departments without a matching colleague", () => {
    expect(searchStaff(roster, "zzz")).toEqual([]);
  });
});
