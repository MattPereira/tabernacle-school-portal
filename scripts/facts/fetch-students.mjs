// Fetches active (Enrolled) students from the FACTS API with minimal info:
//   scripts/data/students.json  [{ studentId, firstName, lastName, email, gradeLevel }]
//
// Run: node --env-file=.env scripts/fetch-students.mjs
//
// Server-side filtered to keep request count low (~4 total):
//   /Students filtered to Enrolled (1 page), then /People filtered by
//   personId in chunks (Sieve OR syntax) instead of sweeping all ~9k people.

import { writeFile } from "node:fs/promises";
import { apiGetAll } from "./facts-client.mjs";

const OUT_FILE = new URL("../data/students.json", import.meta.url);
const ID_CHUNK = 200; // personIds per /People request (keeps URL length sane)

console.log("Fetching enrolled students...");
const students = await apiGetAll("/Students", { Filters: "school.status==Enrolled" });
console.log(`${students.length} enrolled students`);

console.log("Fetching people (for names)...");
// People.personId == studentId. (personStudentId is a different id space —
// joining on it attaches unrelated people's names; verified against Workspace.)
const ids = [...new Set(students.map((s) => s.studentId).filter(Boolean))];
const people = [];
for (let i = 0; i < ids.length; i += ID_CHUNK) {
  const chunk = ids.slice(i, i + ID_CHUNK);
  people.push(...(await apiGetAll("/People", { Filters: `personId==${chunk.join("|")}` })));
}
const personById = new Map(people.map((p) => [p.personId, p]));

const out = students.map((s) => {
  const person = personById.get(s.studentId);
  return {
    studentId: s.studentId,
    firstName: person?.firstName ?? null,
    lastName: person?.lastName ?? null,
    email: person?.email || null,
    gradeLevel: s.school?.gradeLevel ?? null,
  };
});

const unresolved = out.filter((s) => !s.firstName && !s.lastName);
if (unresolved.length) console.warn(`WARNING: ${unresolved.length} students with no /People match (missing personStudentId?)`);

await writeFile(OUT_FILE, JSON.stringify(out, null, 2));
console.log(`Wrote ${out.length} active students to ${OUT_FILE}`);
