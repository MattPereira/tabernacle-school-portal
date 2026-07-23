import { headers } from "next/headers";

import { db } from "@/lib/db/client";
import { type Access, isSchoolDomain, resolveAccess } from "@/lib/identity";

import { auth } from "./index";

// Who is looking at the page. Three states, matching CONTEXT.md: not signed in,
// signed in but unlinked (holding page), or a portal account. The linked variant
// composes off Access rather than restating its fields, so widening what
// resolveAccess returns can't leave this type behind.
export type Viewer =
  | { state: "anonymous" }
  | { state: "unlinked"; name: string; email: string }
  | ({ state: "linked"; name: string; email: string } & Omit<
      Extract<Access, { linked: true }>,
      "linked"
    >);

// Wiring: reads the session off the request and hands the decision to
// resolveAccess. The rules live in lib/identity — this only plumbs. Note it
// resolves rather than records: logging belongs to login (see the session hook
// in ./index), not to every page view.
export async function getViewer(): Promise<Viewer> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { state: "anonymous" };

  const { name, email } = session.user;

  // Belt and braces: better-auth already rejects a Google sign-in whose verified
  // `hd` claim isn't the school's. If one ever slips through we fail closed to
  // the holding page rather than erroring — a soft dead end is the house style
  // for "we don't know you" (ADR-0001, Decision 4; CONTEXT.md, holding page).
  if (!isSchoolDomain(email)) return { state: "unlinked", name, email };

  const access = await resolveAccess(email, { db });
  if (!access.linked) return { state: "unlinked", name, email };

  const { linked: _linked, ...link } = access;
  return { state: "linked", name, email, ...link };
}
