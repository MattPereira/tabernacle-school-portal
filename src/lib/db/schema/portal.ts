// Portal-owned truth (identity_link, sync_run). The authoritative side.
import { boolean, integer, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// Portal-owned, set at link creation, never derived from FACTS — whose role
// signals are junk (administrator=true on 48/70 active staff). ADR-0001.
export const roleEnum = pgEnum("identity_role", ["student", "staff"]);

export type Role = (typeof roleEnum.enumValues)[number];

// The allowlist: row exists = portal account exists. No self-registration;
// rows only ever come from seeding or an explicit admin action (ADR-0001).
export const identityLink = pgTable(
  "identity_link",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    // The login identity — the allowlist key. Stored lowercased; callers go
    // through resolveAccess, which normalizes before looking up.
    googleEmail: text("google_email").notNull(),
    // Optional FACTS link, deliberately NOT unique: many logins may map to one
    // FACTS person, but one login can never resolve to two people. Null means a
    // portal account with no FACTS person (~7 staff FACTS will never track) and
    // is admin-created only — sync can never mint it.
    factsPersonId: integer("facts_person_id"),
    role: roleEnum().notNull(),
    // Orthogonal to role: admin access is granted explicitly.
    admin: boolean().notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("identity_link_google_email_key").on(table.googleEmail)],
);

export type IdentityLink = typeof identityLink.$inferSelect;
