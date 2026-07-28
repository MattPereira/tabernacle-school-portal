import { describe, expect, it } from "vitest";

import { groupByDepartment, NO_DEPARTMENT, type StaffEntry } from "@/lib/staff";

// listStaff has already done the reading; grouping decides department buckets
// and the homeroom scan order within each bucket.
const entry = (staffId: number, name: string, department: string | null, homeroom: string | null = null): StaffEntry => ({
  staffId,
  name,
  initials: "",
  department,
  homeroom,
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

  it("orders each department by homeroom, with unassigned staff last", () => {
    const groups = groupByDepartment([
      entry(10, "Ada Lovelace", "Faculty", "03 Adams"),
      entry(11, "Grace Hopper", "Administration"),
      entry(12, "Alan Turing", "Faculty", "01 Baker"),
      entry(13, "Barbara Liskov", "Faculty"),
    ]);

    expect(groups).toEqual([
      { department: "Administration", staff: [entry(11, "Grace Hopper", "Administration")] },
      {
        department: "Faculty",
        staff: [
          entry(12, "Alan Turing", "Faculty", "01 Baker"),
          entry(10, "Ada Lovelace", "Faculty", "03 Adams"),
          entry(13, "Barbara Liskov", "Faculty"),
        ],
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
