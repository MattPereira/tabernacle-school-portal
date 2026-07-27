import { redirect } from "next/navigation";

import { signOut } from "@/app/actions";
import { AccessPendingScreen } from "@/components/access-pending-screen";
import { canonicalDestination } from "@/lib/auth/destination";
import { getViewer } from "@/lib/auth/viewer";
import { db } from "@/lib/db/client";
import { latestSyncRun } from "@/lib/sync";
import { runSync } from "@/app/actions";

export default async function AccessPendingPage() {
  const viewer = await getViewer();

  if (viewer.state !== "unmatched" && viewer.state !== "student") redirect(canonicalDestination(viewer));

  return <AccessPendingScreen name={viewer.name} email={viewer.email} student={viewer.state === "student"} signOut={signOut} lastRun={await latestSyncRun(db)} runSync={runSync} />;
}
