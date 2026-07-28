// The Staff read seam: the portal's answer to "who works here right now?",
// read from the FACTS snapshot rather than from FACTS itself, so browsing never
// waits on the rate-limited API. FACTS stays authoritative; nothing here writes.
import { asc, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { factsPerson, factsStaff } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";

export type StaffDeps = { db: PgDatabase<PgQueryResultHKT, typeof schema> };

// One Staff entry, display-ready: the page arranges these, it doesn't decide
// anything about them.
export type StaffEntry = {
  // FACTS' internal id. Carried for list keys and the ordering tie-break —
  // never rendered (CONTEXT.md, Professional staff profile).
  staffId: number;
  // "First Middle Last", missing parts omitted.
  name: string;
  department: string | null;
  // FACTS' contact email, verbatim — personal addresses included, because
  // hiding them would hide a real FACTS data problem.
  contactEmail: string | null;
};

// Active staff only: a flagged row stays in the snapshot (it still grants
// access) but has left the school's current population, so Staff omits it.
export async function listStaff(deps: StaffDeps): Promise<StaffEntry[]> {
  const rows = await deps.db
    .select({
      staffId: factsStaff.staffId,
      firstName: factsStaff.firstName,
      middleName: factsStaff.middleName,
      lastName: factsStaff.lastName,
      department: factsStaff.department,
      contactEmail: factsPerson.contactEmail,
    })
    .from(factsStaff)
    // Left join: FACTS has staff with no /People row, and that data wart must
    // not cost the school a colleague in the list — only their email.
    .leftJoin(factsPerson, eq(factsPerson.personId, factsStaff.staffId))
    .where(eq(factsStaff.inactive, false))
    // A roster order: surname first, case-insensitive, with the hidden staff id
    // making the order total so two identical names never swap between reads.
    .orderBy(
      sql`lower(${factsStaff.lastName})`,
      sql`lower(${factsStaff.firstName})`,
      asc(factsStaff.staffId),
    );

  return rows.map(({ firstName, middleName, lastName, ...entry }) => ({
    ...entry,
    name: [firstName, middleName, lastName].filter(Boolean).join(" "),
  }));
}
