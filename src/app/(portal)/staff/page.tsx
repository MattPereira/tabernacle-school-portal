import { StaffScreen } from "@/components/staff-screen";
import { StaffHomeroomPrototype } from "@/components/prototype/staff-homeroom-prototype";
import { db } from "@/lib/db/client";
import { groupByDepartment, listStaff } from "@/lib/staff";

// The (portal) layout is this page's only gate — no feature-specific access
// rule. Reads the snapshot, so it never waits on a live FACTS request.
export default async function StaffPage({ searchParams }: { searchParams: Promise<{ prototype?: string }> }) {
  const groups = groupByDepartment(await listStaff({ db }));
  if ((await searchParams).prototype === "homeroom") return <StaffHomeroomPrototype groups={groups} />;
  return <StaffScreen groups={groups} />;
}
