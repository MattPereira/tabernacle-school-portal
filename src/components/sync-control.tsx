import { SubmitButton } from "@/components/submit-button";
import type { SyncRun } from "@/lib/db/schema";

export function SyncControl({ lastRun, runSync }: { lastRun: SyncRun | null; runSync: () => Promise<void> }) {
  const inFlight = lastRun?.outcome === null;
  const status = lastRun
    ? lastRun.outcome === null ? "A sync is in progress." : lastRun.outcome === "applied" ? "Last sync completed." : "Last sync failed."
    : "No sync has run yet.";

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{status}</p>
      <form action={runSync}><SubmitButton disabled={inFlight}>Sync FACTS</SubmitButton></form>
    </div>
  );
}
