import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SyncControl } from "@/components/sync-control";
import { SubmitButton } from "@/components/submit-button";
import type { StaffViewer } from "@/lib/auth/viewer";
import type { SyncRun } from "@/lib/db/schema";

export function HomeScreen({ viewer, lastRun, runSync, signOut }: { viewer: StaffViewer; lastRun: SyncRun | null; runSync: () => Promise<void>; signOut: () => Promise<void> }) {
  return (
    <div className="max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Hi {viewer.name}</CardTitle>
          <CardDescription>
            You&apos;re signed in as staff.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">More portal features will appear here soon.</p>
          <div className="mt-6"><SyncControl lastRun={lastRun} runSync={runSync} /></div>
          <form className="mt-3" action={signOut}><SubmitButton variant="outline">Sign out</SubmitButton></form>
        </CardContent>
      </Card>
    </div>
  );
}
