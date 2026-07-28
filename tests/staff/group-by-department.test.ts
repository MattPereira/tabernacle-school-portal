import { describe, expect, it } from "vitest";

import { groupByDepartment, NO_DEPARTMENT, type StaffEntry } from "@/lib/staff";

// listStaff has already done the reading and the surname ordering; grouping
// only decides the buckets, so these entries carry just what it looks at.
const entry = (staffId: number, name: string, department: string | null): StaffEntry => ({
  staffId,
  name,
  initials: "",
  department,
  contactEmail: null,
  photoUrl: null,
});

describe("groupByDepartment", () => {
  it("reads departments alphabetically, ignoring case", () => {
    const groups = groupByDepartment([
      entry(10, "Ada Lovelace", "faculty"),
      entry(11, "Grace Hopper", "Administration"),
      entry(12, "Alan Turing", "Daycare"),
    ]);

    expect(groups.map((group) => group.department)).toEqual([
      "Administration",
      "Daycare",
      "faculty",
    ]);
  });

  it("keeps listStaff's order within a department", () => {
    const groups = groupByDepartment([
      entry(10, "Ada Lovelace", "Faculty"),
      entry(11, "Grace Hopper", "Administration"),
      entry(12, "Alan Turing", "Faculty"),
    ]);

    expect(groups).toEqual([
      { department: "Administration", staff: [entry(11, "Grace Hopper", "Administration")] },
      {
        department: "Faculty",
        staff: [entry(10, "Ada Lovelace", "Faculty"), entry(12, "Alan Turing", "Faculty")],
      },
    ]);
  });

  it("files the staff FACTS gave no department under a named bucket, last", () => {
    const groups = groupByDepartment([
      entry(10, "Ada Lovelace", null),
      entry(11, "Grace Hopper", "Zoology"),
      entry(12, "Alan Turing", null),
    ]);

    expect(groups.map((group) => group.department)).toEqual(["Zoology", NO_DEPARTMENT]);
    expect(groups[1].staff.map((staff) => staff.staffId)).toEqual([10, 12]);
  });

  it("has no groups for an empty roster", () => {
    expect(groupByDepartment([])).toEqual([]);
  });
});
