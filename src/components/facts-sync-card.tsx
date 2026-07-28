import { DatabaseIcon, TriangleAlertIcon } from "lucide-react";

import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { SyncRun } from "@/lib/db/schema";

const schoolDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Los_Angeles",
});

export function FactsSyncCard({
  latestRun,
  latestAppliedRun,
  runSync,
}: {
  latestRun: SyncRun | null;
  latestAppliedRun: SyncRun | null;
  runSync: () => Promise<void>;
}) {
  const inFlight = latestRun?.outcome === null;
  const failed = latestRun?.outcome === "failed";
  const appliedAt = latestAppliedRun?.finishedAt;

  return (
    <Card className="py-5">
      <CardHeader className="px-5">
        <div className="flex items-start gap-3">
          <DatabaseIcon className="mt-0.5" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <CardTitle>Data</CardTitle>
            <CardDescription>School information fetched from FACTS SIS.</CardDescription>
            <p className="text-sm text-muted-foreground">
              {appliedAt ? (
                <>Last synced <time dateTime={appliedAt.toISOString()}>{schoolDateTimeFormatter.format(appliedAt)}</time></>
              ) : "Not synced yet."}
            </p>
          </div>
        </div>
      </CardHeader>
      {failed && (
        <CardContent className="px-5">
          <Alert variant="destructive">
            <TriangleAlertIcon aria-hidden="true" />
            <AlertTitle>Latest sync failed</AlertTitle>
            <AlertDescription>Existing portal data is unchanged.</AlertDescription>
            <AlertAction>
              <form action={runSync}><SubmitButton size="sm" variant="outline">Try again</SubmitButton></form>
            </AlertAction>
          </Alert>
        </CardContent>
      )}
      {!failed && (
        <CardFooter className="justify-end">
          <form action={runSync}>
            <SubmitButton disabled={inFlight}>{inFlight ? "Sync in progress…" : "Sync"}</SubmitButton>
          </form>
        </CardFooter>
      )}
    </Card>
  );
}
