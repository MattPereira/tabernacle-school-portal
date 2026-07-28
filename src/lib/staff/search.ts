import type { StaffGroup } from "./index";

// Preserve department sections when narrowing, so a result still tells the
// reader where the colleague works instead of flattening the roster.
export function searchStaff(groups: StaffGroup[], query: string): StaffGroup[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return groups;

  return groups
    .map((group) => ({ ...group, staff: group.staff.filter((entry) => entry.name.toLowerCase().includes(needle)) }))
    .filter((group) => group.staff.length > 0);
}
