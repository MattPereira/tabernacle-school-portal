// Analysis for issue #37: is FACTS contact email the Family Portal credential?
//
// Reads the gitignored cache written by probe-username-fetch.mjs and reports
// how `username` (a PersonVM field distinct from `email`/`email2`) is populated
// per cohort. Read-only; writes nothing to FACTS.
//
// Run: node scripts/facts/probe-username-fetch.mjs   (once, hits the API)
//      node scripts/facts/probe-username.mjs         (repeatable, offline)

import { readFile } from "node:fs/promises";

const load = async (name) =>
  JSON.parse(await readFile(new URL(`../data/probe-${name}.json`, import.meta.url), "utf8"));

const [people, staff, students, links] = await Promise.all(
  ["people", "staff", "students", "parent-links"].map(load),
);

const byPersonId = new Map(people.map((p) => [p.personId, p]));
const norm = (s) => (s ?? "").trim().toLowerCase();

// Classify one person by how `username` relates to `email`.
function classify(person) {
  const username = norm(person.username);
  const email = norm(person.email);
  if (!username) return "username blank";
  if (username === email) return "username == email";
  if (username.includes("@")) return "username is some OTHER email";
  return "username is a non-email handle";
}

function tally(rows, label) {
  const counts = {};
  for (const r of rows) counts[classify(r)] = (counts[classify(r)] ?? 0) + 1;
  console.log(`\n  ${label} (n=${rows.length})`);
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(v).padStart(5)}  ${k}`);
  }
  return counts;
}

const enrolled = students.filter((s) => s.school?.status === "Enrolled");
// People.personId == studentId. personStudentId is a different id space —
// joining on it attaches unrelated people (see fetch-students.mjs).
const studentRows = [...new Set(enrolled.map((s) => s.studentId))]
  .map((id) => byPersonId.get(id))
  .filter(Boolean);

console.log("=== ENROLLED STUDENTS by contact-email domain ===");
tally(studentRows.filter((r) => norm(r.email).endsWith("@tbs.org")), "@tbs.org contact email");
tally(studentRows.filter((r) => !norm(r.email)), "no contact email");

console.log("\n=== ACTIVE STAFF by contact-email domain ===");
const staffRows = staff
  .filter((s) => s.active)
  .map((s) => byPersonId.get(s.staffId))
  .filter(Boolean);
tally(staffRows.filter((r) => norm(r.email).endsWith("@tbs.org")), "@tbs.org contact email");
tally(
  staffRows.filter((r) => norm(r.email) && !norm(r.email).endsWith("@tbs.org")),
  "personal contact email",
);

console.log("\n=== PARENTS of enrolled students ===");
const enrolledIds = new Set(enrolled.map((s) => s.studentId));
const parentRows = [
  ...new Set(links.filter((l) => enrolledIds.has(l.studentID)).map((l) => l.parentID)),
]
  .map((id) => byPersonId.get(id))
  .filter(Boolean);
tally(parentRows, "all parents of enrolled students");

// Wider-population uniqueness is reported for completeness, not used as proof:
// active-person emails are unique, so historical collisions cannot settle auth semantics.
console.log("\n=== uniqueness across ALL people ===");
for (const field of ["username", "email"]) {
  const values = people.map((p) => norm(p[field])).filter(Boolean);
  const distinct = new Set(values);
  const dupes = values.length - distinct.size;
  console.log(
    `  ${field.padEnd(9)} populated: ${String(values.length).padStart(5)}` +
      `  distinct: ${String(distinct.size).padStart(5)}  collisions: ${dupes}`,
  );
}
