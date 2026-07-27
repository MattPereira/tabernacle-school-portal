import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/lib/db/client";
import { isSchoolDomain, resolveAccess } from "@/lib/identity";

import { auth } from "./index";

// Who is looking at the page: anonymous, unmatched, student-only, or staff.
export type Viewer =
  | { state: "anonymous" }
  | { state: "unmatched"; name: string; email: string }
  | { state: "student"; name: string; email: string }
  | { state: "staff"; name: string; email: string };

// Wiring: reads the session off the request and hands the decision to
// resolveAccess. The rules live in lib/identity — this only plumbs.
export async function getViewer(): Promise<Viewer> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { state: "anonymous" };

  const { name, email } = session.user;

  // Belt and braces: better-auth already rejects a Google sign-in whose verified
  // `hd` claim isn't the school's. If one ever slips through we fail closed to
  // the holding page rather than erroring — a soft dead end is the house style
  // for "we don't know you" (ADR-0001, Decision 4; CONTEXT.md, holding page).
  if (!isSchoolDomain(email)) return { state: "unmatched", name, email };

  const access = await resolveAccess(email, { db });
  switch (access.kind) {
    case "staff": return { state: "staff", name, email };
    case "student": return { state: "student", name, email };
    case "unmatched": return { state: "unmatched", name, email };
  }
}

// Authentication boundary for mutations available to every signed-in user.
export async function requireSignedInViewer(): Promise<Exclude<Viewer, { state: "anonymous" }>> {
  const viewer = await getViewer();
  if (viewer.state === "anonymous") redirect("/login");
  return viewer;
}

export type StaffViewer = Extract<Viewer, { state: "staff" }>;
