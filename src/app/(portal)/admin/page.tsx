import { redirect } from "next/navigation";

import { AdminScreen } from "@/components/admin/admin-screen";
import { getViewer } from "@/lib/auth/viewer";
import { db } from "@/lib/db/client";
import { listLinks } from "@/lib/identity";
import { flaggedPeople, latestSyncRun, unlinkedPeople } from "@/lib/sync";

// Route wiring only: the Admin screen owns its presentation while lib/ owns
// every read and mutation rule.
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string; all?: string; edit?: string; q?: string }>;
}) {
  const viewer = await getViewer();
  if (viewer.state !== "linked" || !viewer.admin) redirect("/");

  const [{ add, all, edit, q }, lastRun, queue, flagged, links] = await Promise.all([
    searchParams,
    latestSyncRun(db),
    unlinkedPeople(db),
    flaggedPeople(db),
    listLinks({ db }),
  ]);

  return (
    <AdminScreen
      editing={Number(edit)}
      adding={add === "1"}
      showAll={all === "1"}
      query={q ?? ""}
      lastRun={lastRun}
      queue={queue}
      flagged={flagged}
      links={links}
    />
  );
}
