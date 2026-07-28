import { StaffScreen } from "@/components/staff-screen";
import { db } from "@/lib/db/client";
import { groupByDepartment, listStaff } from "@/lib/staff";

// The (portal) layout is this page's only gate — no feature-specific access
// rule. Reads the snapshot, so it never waits on a live FACTS request.
export default async function StaffPage() {
  return <StaffScreen groups={groupByDepartment(await listStaff({ db }))} />;
}
