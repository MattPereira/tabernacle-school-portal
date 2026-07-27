import { SyncControl } from "@/components/sync-control";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import type { SyncRun } from "@/lib/db/schema";

export function AccessPendingScreen({ name, email, student, signOut, lastRun, runSync }: { name: string; email: string; student: boolean; signOut: () => Promise<void>; lastRun: SyncRun | null; runSync: () => Promise<void> }) {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight text-balance">Hi {name}</h1>
      <Card>
        <CardHeader>
          <CardDescription>{student
            ? "Student access is not available yet."
            : <>Portal access requires your signed-in @tbs.org address to match the FACTS contact email for exactly one staff member. Signed in as {email}.</>
          }</CardDescription>
        </CardHeader>
        <CardFooter><SyncControl lastRun={lastRun} runSync={runSync} /></CardFooter>
        <CardFooter>
          <form action={signOut}>
            <SubmitButton variant="outline">Sign out</SubmitButton>
          </form>
        </CardFooter>
      </Card>
    </main>
  );
}
