import Link from "next/link";

import { PageShell } from "@/components/page-shell";
import { SubmitButton } from "@/components/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { LinkedViewer } from "@/lib/auth/viewer";

export function HomeScreen({
  viewer,
  signOut,
}: {
  viewer: LinkedViewer;
  signOut: () => Promise<void>;
}) {
  return (
    <PageShell title={`Hi ${viewer.name}`} className="max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Home</CardTitle>
          <CardDescription>
            You&apos;re signed in as {viewer.role === "student" ? "a student" : "staff"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">More portal features will appear here soon.</p>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-3">
          {viewer.admin && (
            <Link href="/admin" className={buttonVariants({ variant: "secondary" })}>
              Admin
            </Link>
          )}
          <form action={signOut}>
            <SubmitButton variant="outline">Sign out</SubmitButton>
          </form>
        </CardFooter>
      </Card>
    </PageShell>
  );
}
