import { notFound } from "next/navigation";

import { StaffDetailScreen } from "@/components/staff-detail-screen";
import { db } from "@/lib/db/client";
import { getStaffDetail } from "@/lib/staff";

// The portal layout owns staff access. This route only turns an unavailable
// active staff entry into Next's not-found response.
export default async function StaffDetailPage({ params }: { params: Promise<{ staffId: string }> }) {
  const { staffId } = await params;
  if (!/^\d+$/.test(staffId)) notFound();

  const staff = await getStaffDetail({ db }, Number(staffId));
  if (!staff) notFound();

  return <StaffDetailScreen staff={staff} />;
}
