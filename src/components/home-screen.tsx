import { GraduationCapIcon, UsersIcon } from "lucide-react";
import Link from "next/link";

import { FactsSyncCard } from "@/components/facts-sync-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card";
import type { StaffViewer } from "@/lib/auth/viewer";
import type { SyncRun } from "@/lib/db/schema";

const destinations = [
  { href: "/staff", label: "Staff", icon: UsersIcon, countKey: "staff" },
  { href: "/students", label: "Students", icon: GraduationCapIcon, countKey: "students" },
] as const;

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

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">Welcome, {firstName}</h1>
        <p className="mt-2 text-muted-foreground">Choose where you&apos;d like to go.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {destinations.map((destination) => (
          <Link
            key={destination.href}
            href={destination.href}
            className="group rounded-xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Card className="h-full">
              <CardHeader className="grid-cols-[1fr_auto] items-center gap-3">
                <CardTitle className="flex items-center gap-3">
                  <destination.icon aria-hidden="true" />
                  {destination.label}
                </CardTitle>
                <CardAction className="self-center">
                  <Badge variant="secondary" aria-label={`${counts[destination.countKey]} active ${destination.label.toLowerCase()}`}>
                    {counts[destination.countKey]}
                  </Badge>
                </CardAction>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
      <FactsSyncCard latestRun={latestRun} latestAppliedRun={latestAppliedRun} runSync={runSync} />
    </div>
  );
}
