import { ArrowRightIcon, DatabaseIcon, GraduationCapIcon, RefreshCwIcon, UsersIcon } from "lucide-react";
import Link from "next/link";

import { SubmitButton } from "@/components/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/components/ui/utils";
import type { StaffViewer } from "@/lib/auth/viewer";
import type { SyncRun } from "@/lib/db/schema";

const schoolDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Los_Angeles",
});

export function HomeScreen({
  viewer,
  counts,
  latestRun,
  latestAppliedRun,
  runSync,
}: {
  viewer: StaffViewer;
  counts: { staff: number; students: number };
  latestRun: SyncRun | null;
  latestAppliedRun: SyncRun | null;
  runSync: () => Promise<void>;
}) {
  const firstName = viewer.name.trim().split(/\s+/)[0] || viewer.name;
  const inFlight = latestRun?.outcome === null;
  const syncedAt = latestAppliedRun?.finishedAt
    ? schoolDateTimeFormatter.format(latestAppliedRun.finishedAt)
    : "Never";

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Welcome back, {firstName}</h1>
      </header>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-1">
            <UsersIcon aria-hidden="true" />
            <CardDescription>Active staff</CardDescription>
            <CardTitle className="text-4xl tabular-nums">{counts.staff}</CardTitle>
          </CardHeader>
          <CardFooter className="p-0">
            <Link href="/staff" className={cn(buttonVariants({ variant: "ghost" }), "h-auto w-full justify-between rounded-none p-(--card-spacing)")}>
              View staff <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader className="flex-1">
            <GraduationCapIcon aria-hidden="true" />
            <CardDescription>Active students</CardDescription>
            <CardTitle className="text-4xl tabular-nums">{counts.students}</CardTitle>
          </CardHeader>
          <CardFooter className="p-0">
            <Link href="/students" className={cn(buttonVariants({ variant: "ghost" }), "h-auto w-full justify-between rounded-none p-(--card-spacing)")}>
              View students <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader className="flex-1">
            <DatabaseIcon aria-hidden="true" />
            <CardTitle>FACTS data</CardTitle>
            <CardDescription>Last synced {syncedAt}</CardDescription>
          </CardHeader>
          <CardFooter className="p-0">
            <form action={runSync} className="w-full">
              <SubmitButton
                variant="ghost"
                disabled={inFlight}
                className="h-auto w-full justify-between rounded-none p-(--card-spacing)"
              >
                Sync
                <RefreshCwIcon data-icon="inline-end" />
              </SubmitButton>
            </form>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
