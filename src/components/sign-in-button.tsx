"use client";

import { authClient } from "@/lib/auth/client";

export function SignInButton() {
  return (
    <button type="button" onClick={() => authClient.signIn.social({ provider: "google" })}>
      Sign in with your school Google account
    </button>
  );
}
