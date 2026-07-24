import { headers } from "next/headers";
import { notFound } from "next/navigation";

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

// A signed-in viewer, resolved and linked.
export type LinkedViewer = Extract<Viewer, { state: "linked" }>;

// Wiring: the admin screen's render guard. 404 rather than 403 — a screen you
// may not use is a screen that isn't there, as far as you're concerned.
//
// This guards rendering only. The boundary that actually matters is inside
// lib/identity, where every mutation takes the actor's Access and refuses a
// non-admin itself — a server action is a POST endpoint, so it can be called
// without ever rendering the page this sits on.
export async function requireAdmin(): Promise<LinkedViewer> {
  const viewer = await getViewer();
  if (viewer.state !== "linked" || !viewer.admin) notFound();
  return viewer;
}

// The Access the rule modules want, recovered from the viewer. Handed to
// createLink/updateLink as their `actor`.
export const accessOf = (viewer: LinkedViewer): Access => ({
  linked: true,
  role: viewer.role,
  admin: viewer.admin,
  factsPersonId: viewer.factsPersonId,
});
