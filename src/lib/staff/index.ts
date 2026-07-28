// The Staff read seam: the portal's answer to "who works here right now?",
// read from the FACTS snapshot rather than from FACTS itself, so browsing never
// waits on the rate-limited API. FACTS stays authoritative; nothing here writes.
import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { factsPerson, factsStaff, factsStudent } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import { initials } from "@/lib/facts/initials";
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
  // Lovelace" reads AL (lib/facts/initials).
  initials: string;
  department: string | null;
  // FACTS' homeroom label, derived from currently enrolled student rows. Null
  // means this colleague runs no homeroom the snapshot can attribute to them.
  homeroom: string | null;
  // FACTS' contact email, verbatim — personal addresses included, because
  // hiding them would hide a real FACTS data problem.
  contactEmail: string | null;
  // The FACTS-hosted photo, already derived and vetted here so the page only
  // has to render it. Null covers "no photo" and "not a usable filename"
  // alike — both show initials, and neither is the page's decision.
  photoUrl: string | null;
};

// One department's colleagues, ordered by homeroom for quick staff-room scans.
// FACTS' department text is free-form, so the buckets are whatever FACTS says
// plus one for the rows it left blank.
export type StaffGroup = { department: string; staff: StaffEntry[] };

// What a row with no department is filed under. Named rather than folded into
// the others: an active colleague FACTS has no department for is a gap worth
// seeing, the same way a personal contact email is.
export const NO_DEPARTMENT = "No department";

// Active staff only: a flagged row stays in the snapshot (it still grants
// access) but has left the school's current population, so Staff omits it.
export async function listStaff(deps: StaffDeps): Promise<StaffEntry[]> {
  // The student table is the only FACTS source for a homeroom. Group before
  // joining so one teacher's class never duplicates their Staff entry.
  const homerooms = deps.db
    .select({
      staffId: factsStudent.homeroomStaffId,
      homeroom: sql<string | null>`min(${factsStudent.homeroom})`.as("homeroom"),
    })
    .from(factsStudent)
    .where(and(eq(factsStudent.inactive, false), isNotNull(factsStudent.homeroomStaffId)))
    .groupBy(factsStudent.homeroomStaffId)
    .as("homerooms");

  const rows = await deps.db
    .select({
      staffId: factsStaff.staffId,
      firstName: factsStaff.firstName,
      middleName: factsStaff.middleName,
      lastName: factsStaff.lastName,
      department: factsStaff.department,
      homeroom: homerooms.homeroom,
      contactEmail: factsPerson.contactEmail,
      pathToPicture: factsPerson.pathToPicture,
    })
    .from(factsStaff)
    .leftJoin(homerooms, eq(homerooms.staffId, factsStaff.staffId))
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

// The roster split into its departments. Within a department, homerooms read
// alphabetically and unassigned colleagues trail them; the departments
// themselves read alphabetically, case-insensitively, with the blank bucket
// last — it's a hole in the data, not a place people work.
export function groupByDepartment(staff: StaffEntry[]): StaffGroup[] {
  const groups = new Map<string, StaffEntry[]>();

  for (const entry of staff) {
    const department = entry.department ?? NO_DEPARTMENT;
    const bucket = groups.get(department);
    if (bucket) bucket.push(entry);
    else groups.set(department, [entry]);
  }

  return [...groups]
    .map(([department, entries]) => ({ department, staff: entries.sort(byHomeroom) }))
    .sort((a, b) => {
      if (a.department === NO_DEPARTMENT) return 1;
      if (b.department === NO_DEPARTMENT) return -1;
      return a.department.localeCompare(b.department, undefined, { sensitivity: "base" });
    });
}

function byHomeroom(a: StaffEntry, b: StaffEntry) {
  if (!a.homeroom && !b.homeroom) return 0;
  if (!a.homeroom) return 1;
  if (!b.homeroom) return -1;
  return a.homeroom.localeCompare(b.homeroom, undefined, { sensitivity: "base" });
}
