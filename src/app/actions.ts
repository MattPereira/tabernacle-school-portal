"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

// Auth mutations are wiring: each action delegates to better-auth, then sends
// the browser where the completed mutation belongs.
export async function signIn() {
  const { url } = await auth.api.signInSocial({
    // Every successful login begins at the canonical portal destination.  The
    // portal boundary will then route an unlinked account to its holding page.
    body: { provider: "google", callbackURL: "/" },
  });

  if (!url) throw new Error("Google sign-in did not return a redirect URL.");
  redirect(url);
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
