// The Staff read seam: the portal's answer to "who works here right now?",
// read from the FACTS snapshot rather than from FACTS itself, so browsing never
// waits on the rate-limited API. FACTS stays authoritative; nothing here writes.
import { asc, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { factsPerson, factsStaff } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import { factsPictureUrl } from "@/lib/facts/pictures";

export type StaffDeps = { db: PgDatabase<PgQueryResultHKT, typeof schema> };

// One Staff entry, display-ready: the page arranges these, it doesn't decide
// anything about them.
export type StaffEntry = {
  // FACTS' internal id. Carried for list keys and the ordering tie-break —
  // never rendered (CONTEXT.md, Professional staff profile).
  staffId: number;
  // "First Middle Last", missing parts omitted.
  name: string;
  // What stands in for a photo: first and last initials, so "Ada Byron
  // Lovelace" reads AL. Empty when FACTS gave no name at all — a blank circle
  // rather than a placeholder person, because the missing name is the thing
  // worth noticing.
  initials: string;
  department: string | null;
  // FACTS' contact email, verbatim — personal addresses included, because
  // hiding them would hide a real FACTS data problem.
  contactEmail: string | null;
  // The FACTS-hosted photo, already derived and vetted here so the page only
  // has to render it. Null covers "no photo" and "not a usable filename"
  // alike — both show initials, and neither is the page's decision.
  photoUrl: string | null;
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
      pathToPicture: factsPerson.pathToPicture,
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

  return rows.map(({ firstName, middleName, lastName, pathToPicture, ...entry }) => ({
    ...entry,
    name: [firstName, middleName, lastName].filter(Boolean).join(" "),
    initials: initials(firstName, lastName),
    photoUrl: factsPictureUrl(pathToPicture),
  }));
}

// First and last only — a middle initial in the circle reads as noise at 40px.
function initials(firstName: string | null, lastName: string | null): string {
  const firstLetter = (part: string | null) => (part ? ([...part.trim()][0] ?? "") : "");
  return (firstLetter(firstName) + firstLetter(lastName)).toUpperCase();
}
