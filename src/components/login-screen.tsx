import { ThemeToggle } from "@/components/theme-toggle";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

// Adapted from shadcn's login-03: its centred muted canvas, text branding,
// and card composition remain; unsupported providers and credential fields do not.
export function LoginScreen({ signIn }: { signIn: () => Promise<void> }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <p className="font-medium">Tabernacle School Portal</p>
          <ThemeToggle />
        </div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Welcome</CardTitle>
            <CardDescription>Use your school Google account to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-sm text-muted-foreground">
              Sign in with the Google account issued by Tabernacle School.
            </p>
          </CardContent>
          <CardFooter>
            <form action={signIn} className="w-full">
              <SubmitButton className="w-full" size="lg">
                <GoogleIcon data-icon="inline-start" />
                Continue with Google
              </SubmitButton>
            </form>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}

function GoogleIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M21.35 12.27c0-.79-.07-1.55-.21-2.27H12v4.3h5.22a4.46 4.46 0 0 1-1.93 2.92v2.79h3.59c2.1-1.93 3.31-4.78 3.31-7.74Z"
      />
      <path
        fill="currentColor"
        d="M12 21.75c2.62 0 4.82-.87 6.43-2.35l-3.59-2.79c-1 .67-2.27 1.07-3.84 1.07-2.95 0-5.45-1.99-6.35-4.66H.94v2.88A9.75 9.75 0 0 0 12 21.75Z"
      />
      <path
        fill="currentColor"
        d="M5.65 13.02A5.87 5.87 0 0 1 5.3 12c0-.35.06-.69.17-1.02V8.1H.94a9.75 9.75 0 0 0 0 7.8l4.71-2.88Z"
      />
      <path
        fill="currentColor"
        d="M12 6.32c1.43 0 2.72.49 3.73 1.46l2.8-2.8C16.81 3.38 14.62 2.25 12 2.25A9.75 9.75 0 0 0 .94 8.1l4.71 2.88C6.55 8.31 9.05 6.32 12 6.32Z"
      />
    </svg>
  );
}
