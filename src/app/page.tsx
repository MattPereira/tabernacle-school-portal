import { redirect } from "next/navigation";

import { runSync, signOut } from "@/app/actions";
import { AccessPendingScreen } from "@/components/access-pending-screen";
import { HomeScreen } from "@/components/home-screen";
import { canonicalDestination } from "@/lib/auth/destination";
import { getViewer } from "@/lib/auth/viewer";
import { db } from "@/lib/db/client";
import { latestSyncRun } from "@/lib/sync";

// The signed-in home page is deliberately outside the staff-only portal group:
// every signed-in user can trigger and inspect sync, while only staff enter the
// portal shell and any future portal routes.
export default async function Home() {
  const viewer = await getViewer();
  if (viewer.state === "anonymous") redirect(canonicalDestination(viewer));

  const lastRun = await latestSyncRun(db);
  if (viewer.state !== "staff") {
    return (
      <AccessPendingScreen
        name={viewer.name}
        email={viewer.email}
        student={viewer.state === "student"}
        signOut={signOut}
        lastRun={lastRun}
        runSync={runSync}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <HomeScreen viewer={viewer} lastRun={lastRun} runSync={runSync} signOut={signOut} />
    </main>
  );
}
