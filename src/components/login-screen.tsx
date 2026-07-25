import Image from "next/image";

import { SubmitButton } from "@/components/submit-button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

// Adapted from shadcn's login-03: its centred muted canvas, text branding,
// and card composition remain; unsupported providers and credential fields do not.
export function LoginScreen({ signIn }: { signIn: () => Promise<void> }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Tabernacle School Portal</CardTitle>
            <CardDescription className="py-5">Sign in with an @tbs.org account.</CardDescription>
          </CardHeader>
          <CardFooter>
            <form action={signIn} className="w-full">
              <SubmitButton className="w-full" size="xl">
                <Image src="/google.svg" alt="" width={24} height={24} data-icon="inline-start" />
                Continue with Google
              </SubmitButton>
            </form>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
