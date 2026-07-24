import { asc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { identityLink, mirrorPerson, roleEnum, type Role } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import type { IdentityLink } from "@/lib/db/schema";

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

// ---------------------------------------------------------------------------
// Link management — the allowlist's only write path.
//
// The allowlist grows in exactly two ways: the one-time seed script, and an
// admin acting here (ADR-0001 §1, Amendment). Sync is deliberately not one of
// them. The actor's own Access is a dependency for the same reason
// recordLoginAttempt takes a log: the "may they?" decision is behavior, so it
// belongs in a rule module where it's tested, not in a route that isn't.
// ---------------------------------------------------------------------------

// The actor's resolved access travels with the db handle, so no caller can
// reach these without having answered "who is asking?" first.
export type AdminDeps = IdentityDeps & { actor: Access };

// Every field the admin sets. `googleEmail` is absent from the edit patch on
// purpose: the login identity is fixed at creation. Re-pointing an existing row
// at a different account would silently transfer that account's access, so the
// office creates a new row instead.
export type LinkInput = {
  googleEmail: string;
  factsPersonId: number | null;
  role: Role;
  admin: boolean;
};

export type LinkPatch = Partial<Omit<LinkInput, "googleEmail">>;

// Refusals are values, not exceptions — every one of them is a message the
// admin screen has to render, and a raw unique-violation isn't one.
export type LinkFailure = "forbidden" | "not-school-domain" | "duplicate-email" | "not-found";

export type LinkResult = { ok: true; link: IdentityLink } | { ok: false; reason: LinkFailure };

// Admin is portal-owned and orthogonal to role — being staff is not being an
// admin (ADR-0001, Amendment).
const mayAdminister = (actor: Access) => actor.linked && actor.admin;

// Role is a closed vocabulary, so anything arriving from outside (a form post,
// a query string) has to be checked against it rather than cast. Lives here
// because the vocabulary does.
export const parseRole = (value: unknown): Role | null =>
  roleEnum.enumValues.includes(value as Role) ? (value as Role) : null;

// The FACTS person id off a form carries three meanings, two of which share a
// shape: blank is the deliberate "no FACTS person" (a null link is legitimate),
// a non-number is a typo to report, and neither may quietly become the other.
// Lives here with the link vocabulary it feeds; the caller phrases the error.
export type ParsedFactsPersonId = { ok: true; value: number | null } | { ok: false };

export const parseFactsPersonId = (value: unknown): ParsedFactsPersonId => {
  const raw = String(value ?? "").trim();
  if (!raw) return { ok: true, value: null };
  const id = Number(raw);
  return Number.isInteger(id) ? { ok: true, value: id } : { ok: false };
};

// Grant a portal account. A `null` factsPersonId is legitimate and expected —
// the ~7 active staff FACTS will never track — and reaching it through here is
// what makes it admin-only.
export async function createLink(input: LinkInput, deps: AdminDeps): Promise<LinkResult> {
  if (!mayAdminister(deps.actor)) return { ok: false, reason: "forbidden" };

  const googleEmail = normalizeEmail(input.googleEmail);

  // A row for an address that can never log in is a dead end nobody would ever
  // notice; refuse it at the door instead. (If a non-tbs.org staffer ever needs
  // access, that's the documented policy tweak in ADR-0001's Consequences — a
  // decision, not a typo to accommodate here.)
  if (!isSchoolDomain(googleEmail)) return { ok: false, reason: "not-school-domain" };

  const [existing] = await deps.db
    .select({ id: identityLink.id })
    .from(identityLink)
    .where(eq(identityLink.googleEmail, googleEmail))
    .limit(1);
  // Checked rather than caught so the screen can say which address clashed. The
  // unique index stays the real guarantee — this is the readable path to it.
  if (existing) return { ok: false, reason: "duplicate-email" };

  // Note what isn't checked: that the FACTS person exists in the mirror. The
  // mirror is a cache and may be stale or mid-sync, and a lagging sync must
  // never stop the office granting somebody access.
  const [link] = await deps.db
    .insert(identityLink)
    .values({
      googleEmail,
      factsPersonId: input.factsPersonId,
      role: input.role,
      admin: input.admin,
    })
    .returning();

  return { ok: true, link };
}

// Correct a row: role, admin flag, or which FACTS person it points at (or none
// at all). Absent keys are left alone, so the screen can submit one field.
export async function updateLink(
  id: number,
  patch: LinkPatch,
  deps: AdminDeps,
): Promise<LinkResult> {
  if (!mayAdminister(deps.actor)) return { ok: false, reason: "forbidden" };

  const changes: LinkPatch = {};
  if (patch.role !== undefined) changes.role = patch.role;
  if (patch.admin !== undefined) changes.admin = patch.admin;
  if (patch.factsPersonId !== undefined) changes.factsPersonId = patch.factsPersonId;

  const [link] = Object.keys(changes).length
    ? await deps.db.update(identityLink).set(changes).where(eq(identityLink.id, id)).returning()
    : await deps.db.select().from(identityLink).where(eq(identityLink.id, id)).limit(1);

  return link ? { ok: true, link } : { ok: false, reason: "not-found" };
}

// A link row plus the mirrored name, for the screen to show. The name is
// display only and comes from the mirror, which is never authoritative — a link
// whose person the mirror hasn't got still lists, it just shows no name.
export type LinkListing = IdentityLink & { factsName: string | null };

export async function listLinks(deps: IdentityDeps): Promise<LinkListing[]> {
  const rows = await deps.db
    .select({ link: identityLink, person: mirrorPerson })
    .from(identityLink)
    .leftJoin(mirrorPerson, eq(identityLink.factsPersonId, mirrorPerson.personId))
    .orderBy(asc(identityLink.googleEmail));

  return rows.map(({ link, person }) => ({
    ...link,
    factsName: person ? [person.firstName, person.lastName].filter(Boolean).join(" ") || null : null,
  }));
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
