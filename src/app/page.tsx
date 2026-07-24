import Link from "next/link";

import { PageShell } from "@/components/page-shell";
import { SignInButton } from "@/components/sign-in-button";
import { SignOutButton } from "@/components/sign-out-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getViewer } from "@/lib/auth/viewer";

// The walking skeleton's one page. It renders whichever of the three viewer
// states came back — it does not decide them (ADR-0002 §2).
export default async function Home() {
  const viewer = await getViewer();

  if (viewer.state === "anonymous") {
    return (
      <PageShell title="Tabernacle School Portal" className="max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
          </CardHeader>
          <CardContent>
            <SignInButton />
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (viewer.state === "unlinked") {
    return (
      <PageShell title={`Hi ${viewer.name}`} className="max-w-lg">
        <Card>
          <CardHeader>
            <CardDescription>
              Your account isn&apos;t set up for the portal yet. Please contact the school office.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignOutButton />
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell title={`Hi ${viewer.name}`} className="max-w-lg">
      <Card>
        <CardHeader>
          <CardDescription>
            You&apos;re signed in as {viewer.role === "student" ? "a student" : "staff"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {viewer.admin && (
            <Link href="/admin" className={buttonVariants({ variant: "secondary" })}>
              Admin
            </Link>
          )}
          <SignOutButton />
        </CardContent>
      </Card>
    </PageShell>
  );
}
