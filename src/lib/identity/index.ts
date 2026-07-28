import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { factsPerson, factsStaff, factsStudent } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";

export type IdentityDeps = {
  db: PgDatabase<PgQueryResultHKT, typeof schema>;
};

export type Access = { kind: "staff"; staffId: number } | { kind: "student" } | { kind: "unmatched" };

export const SCHOOL_DOMAIN = "tbs.org";

// FACTS contact emails and Google identities compare after provider-insensitive
// whitespace/case normalization only. Plus and dot variants are distinct.
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const isSchoolDomain = (email: string) => normalizeEmail(email).endsWith(`@${SCHOOL_DOMAIN}`);

// Every request resolves against the current snapshot. A staff match wins over
// any student match because student contact emails may belong to their family.
export async function resolveAccess(email: string, deps: IdentityDeps): Promise<Access> {
  const loginIdentity = normalizeEmail(email);
  if (!isSchoolDomain(loginIdentity)) return { kind: "unmatched" };

  const matches = await deps.db
    .select({
      personId: factsPerson.personId,
      staffId: factsStaff.staffId,
      studentId: factsStudent.studentId,
    })
    .from(factsPerson)
    .leftJoin(factsStaff, eq(factsStaff.staffId, factsPerson.personId))
    .leftJoin(factsStudent, eq(factsStudent.studentId, factsPerson.personId))
    .where(eq(factsPerson.contactEmail, loginIdentity));

  const staff = new Set(matches.flatMap((match) => (match.staffId === null ? [] : [match.staffId])));
  if (staff.size === 1) return { kind: "staff", staffId: staff.values().next().value! };
  if (staff.size > 1) return { kind: "unmatched" };

  const students = new Set(matches.flatMap((match) => (match.studentId === null ? [] : [match.personId])));
  return students.size === 1 ? { kind: "student" } : { kind: "unmatched" };
}
