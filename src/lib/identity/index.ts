import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { identityLink, type Role } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";

// Driver-agnostic: the same module runs against Neon in production and PGlite
// in tests, so the deep module never learns which one it got.
export type IdentityDeps = {
  db: PgDatabase<PgQueryResultHKT, typeof schema>;
};

// A login is either a portal account (linked) or it isn't. There is no third
// state: an unlinked login is not an error, it's the holding page (CONTEXT.md).
export type Access =
  | { linked: true; role: Role; admin: boolean; factsPersonId: number | null }
  | { linked: false };

// The school's Google Workspace domain. Doubles as the OAuth `hd` hint.
export const SCHOOL_DOMAIN = "tbs.org";

// Link rows are stored lowercase (that's how the Workspace export seeds them),
// so every lookup normalizes first. Casing is the provider's to vary, not ours
// to gate on.
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

// Server-side enforcement of the domain policy. The OAuth `hd` parameter is a
// hint the provider may honor, never a guarantee we can trust.
export const isSchoolDomain = (email: string) => normalizeEmail(email).endsWith(`@${SCHOOL_DOMAIN}`);

// The gate. Every login and every guarded page goes through here, and it costs
// exactly one link-table lookup — so a broken or stale sync can never break
// login (ADR-0001).
export async function resolveAccess(email: string, deps: IdentityDeps): Promise<Access> {
  const [link] = await deps.db
    .select()
    .from(identityLink)
    .where(eq(identityLink.googleEmail, normalizeEmail(email)))
    .limit(1);

  if (!link) return { linked: false };

  return {
    linked: true,
    role: link.role,
    admin: link.admin,
    factsPersonId: link.factsPersonId,
  };
}

// Injected so the rule stays testable and framework-free; production passes
// `console`.
export type LoginLog = Pick<Console, "warn">;

// Resolving a login and recording the unlinked ones is one decision, not two:
// the office's only visibility into who tried and bounced is this log line
// (CONTEXT.md, holding page). Call this at login; call resolveAccess for the
// per-request lookups that shouldn't re-log.
export async function recordLoginAttempt(
  email: string,
  deps: IdentityDeps & { log: LoginLog },
): Promise<Access> {
  const access = await resolveAccess(email, deps);

  if (!access.linked) {
    deps.log.warn(`[auth] unlinked login: ${normalizeEmail(email)}`);
  }

  return access;
}
