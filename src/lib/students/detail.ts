// The Student-detail read seam: one enrolled child and the facts that do not
// belong on every roster row. It reads the FACTS snapshot only; no live FACTS
// request and no Next.js dependency cross this boundary.
import { and, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { factsPerson, factsStudent } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import { initials } from "@/lib/facts/initials";
import { factsPictureUrl } from "@/lib/facts/pictures";

export type StudentDetailDeps = {
  db: PgDatabase<PgQueryResultHKT, typeof schema>;
  // A clock is injected because age is an answer for a calendar day, not a
  // value persisted alongside a birthday.
  now: () => Date;
};

export type StudentDetail = {
  // Internal only: route identity and list keys, never page text.
  studentId: number;
  name: string;
  initials: string;
  gradeLevel: string | null;
  // FACTS' vocabulary, deliberately not remapped to a portal enum.
  status: string | null;
  contactEmail: string | null;
  photoUrl: string | null;
  enrolledSince: string | null;
  birthdate: string | null;
  age: number | null;
  homeroom: {
    label: string | null;
    room: string | null;
    teacherId: number | null;
    teacherName: string;
  } | null;
};

// Enrolled means the snapshot's current, unflagged student population. A
// withdrawn or graduated row stays in the snapshot but has no detail page.
export async function getStudentDetail(
  { db, now }: StudentDetailDeps,
  studentId: number,
): Promise<StudentDetail | null> {
  const teacher = alias(factsPerson, "homeroom_teacher");
  const [row] = await db
    .select({
      studentId: factsStudent.studentId,
      gradeLevel: factsStudent.gradeLevel,
      status: factsStudent.status,
      enrolledSince: factsStudent.enrolledSince,
      homeroomLabel: factsStudent.homeroom,
      room: factsStudent.room,
      teacherId: factsStudent.homeroomStaffId,
      firstName: factsPerson.firstName,
      lastName: factsPerson.lastName,
      contactEmail: factsPerson.contactEmail,
      pathToPicture: factsPerson.pathToPicture,
      birthdate: factsPerson.birthdate,
      teacherFirstName: teacher.firstName,
      teacherLastName: teacher.lastName,
    })
    .from(factsStudent)
    // Both people joins are left joins: a snapshot data gap must not make an
    // enrolled child (or an inactive former teacher) disappear from the page.
    .leftJoin(factsPerson, eq(factsPerson.personId, factsStudent.studentId))
    .leftJoin(teacher, eq(teacher.personId, factsStudent.homeroomStaffId))
    .where(and(eq(factsStudent.studentId, studentId), eq(factsStudent.inactive, false)));

  if (!row) return null;

  const homeroom = row.homeroomLabel || row.room || row.teacherId
    ? {
        label: row.homeroomLabel,
        room: row.room,
        teacherId: row.teacherId,
        teacherName: [row.teacherFirstName, row.teacherLastName].filter(Boolean).join(" "),
      }
    : null;

  return {
    studentId: row.studentId,
    name: [row.firstName, row.lastName].filter(Boolean).join(" "),
    initials: initials(row.firstName, row.lastName),
    gradeLevel: row.gradeLevel,
    status: row.status,
    contactEmail: row.contactEmail,
    photoUrl: factsPictureUrl(row.pathToPicture),
    enrolledSince: row.enrolledSince,
    birthdate: row.birthdate,
    age: row.birthdate ? ageOn(row.birthdate, now()) : null,
    homeroom,
  };
}

// Dates from FACTS are calendar days. UTC accessors prevent a server timezone
// from moving a birthday over the boundary while deriving age.
function ageOn(birthdate: string, now: Date) {
  const [year, month, day] = birthdate.split("-").map(Number);
  const birthdayPassed =
    now.getUTCMonth() + 1 > month ||
    (now.getUTCMonth() + 1 === month && now.getUTCDate() >= day);
  return now.getUTCFullYear() - year - (birthdayPassed ? 0 : 1);
}
