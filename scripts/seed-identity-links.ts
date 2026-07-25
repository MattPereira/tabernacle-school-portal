// Seeds identity_link from the verified pairs the matcher produced.
//
//   scripts/data/identity-links.json  ->  identity_link
//
// Run: pnpm db:seed   (needs DATABASE_URL; migrations applied first)
//
// Idempotent, and deliberately conservative about it: re-running refreshes the
// FACTS link on an existing row but leaves `role` and `admin` alone. Both are
// portal-owned and "set at link creation" (ADR-0001, Amendment) — a re-seed must
// never silently demote an admin or undo a role an admin corrected by hand.
//
// Only reads identity-links.json, which by construction holds *verified* pairs
// only; the matcher's ambiguous cases go to review.json and are never linked
// without a human (ADR-0001, Decision 5).
import { readFile } from "node:fs/promises";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { identityLink, type Role } from "@/lib/db/schema";
import { isSchoolDomain, normalizeEmail, SCHOOL_DOMAIN } from "@/lib/identity";

// Mirrors the on-disk shape build-identity-links.mjs writes. Its key names
// predate the glossary (`factsId`, `type`); they're translated to the domain's
// words — facts_person_id, role — the moment they're read below.
type MatcherLink = {
  googleEmail: string;
  factsId: number | null;
  type: Role;
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const pool = new Pool({ connectionString, max: 1 });
const db = drizzle({ client: pool });

const pairs: MatcherLink[] = JSON.parse(
  await readFile(new URL("data/identity-links.json", import.meta.url), "utf8"),
);

const rows = [];
const skipped: string[] = [];
for (const pair of pairs) {
  if (!isSchoolDomain(pair.googleEmail)) {
    skipped.push(pair.googleEmail);
    continue;
  }
  rows.push({
    googleEmail: normalizeEmail(pair.googleEmail),
    factsPersonId: pair.factsId,
    role: pair.type,
  });
}

if (skipped.length) {
  console.warn(`Skipped ${skipped.length} non-${SCHOOL_DOMAIN} address(es): ${skipped.join(", ")}`);
}

try {
  await db
    .insert(identityLink)
    .values(rows)
    .onConflictDoUpdate({
      target: identityLink.googleEmail,
      // facts_person_id only. role and admin are portal-owned and stay as they
      // are — see the header note.
      set: { factsPersonId: sql`excluded.facts_person_id` },
    });

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(identityLink);
  console.log(`Seeded ${rows.length} link rows; identity_link now holds ${count}.`);
} finally {
  await pool.end();
}
