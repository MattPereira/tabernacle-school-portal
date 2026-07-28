import { DatabaseIcon, TriangleAlertIcon } from "lucide-react";

import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <CardHeader className="grid-cols-[auto_1fr_auto] grid-rows-[auto_auto] gap-x-3 gap-y-1 px-5">
        <DatabaseIcon className="row-start-1 self-center" aria-hidden="true" />
        <CardTitle className="col-start-2">Data</CardTitle>
        <CardDescription className="col-start-2 row-start-2">Staff and student information is copied from FACTS.</CardDescription>
        {!failed && (
          <CardAction className="col-start-3 row-span-2 row-start-1 self-start">
            <form action={runSync}>
              <SubmitButton disabled={inFlight}>{inFlight ? "Sync in progress…" : "Sync now"}</SubmitButton>
            </form>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-5">
        <p className="text-sm text-muted-foreground">
          {appliedAt ? (
            <>Last synced <time dateTime={appliedAt.toISOString()}>{schoolDateTimeFormatter.format(appliedAt)}</time></>
          ) : "Not synced yet."}
        </p>
        {failed && (
          <Alert variant="destructive">
            <TriangleAlertIcon aria-hidden="true" />
            <AlertTitle>Latest sync failed</AlertTitle>
            <AlertDescription>Existing portal data is unchanged.</AlertDescription>
            <AlertAction>
              <form action={runSync}><SubmitButton size="sm" variant="outline">Try again</SubmitButton></form>
            </AlertAction>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
