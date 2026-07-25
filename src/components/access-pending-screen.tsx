import { SubmitButton } from "@/components/submit-button";
import { Card, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";

export function AccessPendingScreen({ name, signOut }: { name: string; signOut: () => Promise<void> }) {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight text-balance">Hi {name}</h1>
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
    </main>
  );
}
