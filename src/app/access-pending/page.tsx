import { redirect } from "next/navigation";

import { signOut } from "@/app/actions";
import { AccessPendingScreen } from "@/components/access-pending-screen";
import { canonicalDestination } from "@/lib/auth/destination";
import { getViewer } from "@/lib/auth/viewer";

export default async function AccessPendingPage() {
  const viewer = await getViewer();

  if (viewer.state !== "unlinked") redirect(canonicalDestination(viewer));

  return <AccessPendingScreen name={viewer.name} signOut={signOut} />;
}
