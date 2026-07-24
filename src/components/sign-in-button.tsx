"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export function SignInButton() {
  return (
    <Button
      type="button"
      size="lg"
      onClick={() => authClient.signIn.social({ provider: "google" })}
    >
      Sign in with your school Google account
    </Button>
  );
}
