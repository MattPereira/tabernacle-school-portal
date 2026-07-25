import { PageShell } from "@/components/page-shell";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";

export function AccessPendingScreen({ name, signOut }: { name: string; signOut: () => Promise<void> }) {
  return (
    <PageShell title={`Hi ${name}`} className="max-w-lg">
      <Card>
        <CardHeader>
          <CardDescription>
            Your account isn&apos;t set up for the portal yet. Please contact the school office.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <form action={signOut}>
            <SubmitButton variant="outline">Sign out</SubmitButton>
          </form>
        </CardFooter>
      </Card>
    </PageShell>
  );
}
