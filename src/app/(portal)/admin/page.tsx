import { redirect } from "next/navigation";

import { AdminScreen } from "@/components/admin/admin-screen";
import { AdminScreenPrototype } from "@/components/admin/admin-screen-prototype";
import { PrototypeSwitcher } from "@/components/admin/prototype-switcher";
import { getViewer } from "@/lib/auth/viewer";
import { db } from "@/lib/db/client";
import { listLinks } from "@/lib/identity";
import { flaggedPeople, latestSyncRun, unlinkedPeople } from "@/lib/sync";

// Route wiring only: the Admin screen owns its presentation while lib/ owns
// every read and mutation rule.
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; variant?: string }>;
}) {
  const viewer = await getViewer();
  if (viewer.state !== "linked" || !viewer.admin) redirect("/");

  const [{ edit, variant }, lastRun, queue, flagged, links] = await Promise.all([
    searchParams,
    latestSyncRun(db),
    unlinkedPeople(db),
    flaggedPeople(db),
    listLinks({ db }),
  ]);

  const prototypeVariant =
    process.env.NODE_ENV !== "production" && ["A", "B", "C"].includes(variant ?? "")
      ? (variant as "A" | "B" | "C")
      : null;

  if (prototypeVariant) {
    return (
      <>
        <AdminScreenPrototype
          variant={prototypeVariant}
          lastRun={lastRun}
          queue={queue}
          flagged={flagged}
          links={links}
        />
        <PrototypeSwitcher current={prototypeVariant} />
      </>
    );
  }

  return (
    <AdminScreen
      editing={Number(edit)}
      lastRun={lastRun}
      queue={queue}
      flagged={flagged}
      links={links}
    />
  );
}
