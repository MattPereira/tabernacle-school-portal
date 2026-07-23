// One-time identity matcher: pairs active tbs.org Workspace accounts with
// FACTS people by name, producing the seed data for the identity link table.
//
//   scripts/data/identity-links.json   [{ googleEmail, factsId, type, firstName, lastName, how }]
//   scripts/data/review.json     ambiguous/unmatched Google accounts + candidate suggestions (human resolves)
//   scripts/data/unmatched-facts.json  FACTS people with no Workspace account (grades 03-08 + staff only)
//
// Run: node scripts/build-identity-links.mjs
//
// factsId is studentId / staffId — the keys the local mirror and future sync
// use (staffId == personId; students are keyed by studentId everywhere we read).
// Zero FACTS writes; inputs are the local mirror files only.
//
// Inputs live in scripts/data/ (gitignored — student PII), produced by the
// sibling fetchers. Regenerate them first:
//   node --env-file=.env scripts/google/fetch-workspace-users.mjs
//   node --env-file=.env scripts/facts/fetch-students.mjs
//   node --env-file=.env scripts/facts/fetch-staff.mjs

import { readFile, writeFile, mkdir } from "node:fs/promises";

const read = async (p) => JSON.parse(await readFile(new URL(p, import.meta.url), "utf8"));
const workspace = await read("data/workspace-users.json");
const students = await read("data/students.json");
const staff = await read("data/staff.json");
// Human review decisions (HITL): { links: [{ googleEmail, factsId, type, note }], skip: { "email": "why", ... } }
const manual = await read("data/manual-links.json").catch(() => ({ links: [], skip: {} }));

// Accounts that can hold a link: active, in a person-holding OU. Device/program
// accounts and board members have no FACTS person; classroom accounts (e.g.
// "1G Taberancle") fall out naturally as unmatched.
const SKIP_OU = [/Programs & Devices/, /Board Members/, /Withdrawn/, /Retired/];
const candidates = workspace.filter(
  (u) =>
    !u.suspended &&
    (u.orgUnitPath.startsWith("/Students") || u.orgUnitPath.startsWith("/Staff")) &&
    !SKIP_OU.some((re) => re.test(u.orgUnitPath))
);

const norm = (s) =>
  (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .trim();

const factsPeople = [
  ...students.map((s) => ({ factsId: s.studentId, type: "student", ...s })),
  ...staff.map((s) => ({ factsId: s.staffId, type: "staff", ...s })),
];
const byName = new Map(); // "first last" -> [person]
for (const p of factsPeople) {
  const key = `${norm(p.firstName)} ${norm(p.lastName)}`;
  byName.set(key, [...(byName.get(key) || []), p]);
}
const staffByEmail = new Map(staff.map((s) => [norm(s.email), s]));

const links = [];
const review = [];
const linkedFactsIds = new Set();

for (const m of manual.links) {
  links.push({ ...m, how: "manual" });
  linkedFactsIds.add(`${m.type}:${m.factsId}`);
}
const manuallyHandled = new Set([...Object.keys(manual.skip), ...manual.links.map((m) => m.googleEmail)]);

for (const u of candidates) {
  if (manuallyHandled.has(u.email)) continue;
  const isStudentOu = u.orgUnitPath.startsWith("/Students");
  // Staff: FACTS email == Workspace email is the strongest signal
  const emailHit = !isStudentOu && staffByEmail.get(norm(u.email));
  if (emailHit) {
    claim(u, { factsId: emailHit.staffId, type: "staff" }, "staff-email");
    continue;
  }

  const key = `${norm(u.firstName)} ${norm(u.lastName)}`;
  let hits = (byName.get(key) || []).filter((p) => (p.type === "student") === isStudentOu);
  let how = "name-exact";
  if (hits.length !== 1) {
    // space-insensitive retry: "A. J. Card"/"AJ Card", "Galvan - Goble"/"Galvan-Goble"
    const squash = (p) => norm(p.firstName).replace(/ /g, "") + " " + norm(p.lastName).replace(/ /g, "");
    const loose = factsPeople.filter((p) => (p.type === "student") === isStudentOu && squash(p) === squash(u));
    if (loose.length === 1) (hits = loose), (how = "name-squashed");
  }
  if (hits.length === 1) {
    claim(u, hits[0], how);
  } else {
    // 0 or 2+ exact hits: suggest by last name (same side) for human review
    const suggestions = factsPeople.filter(
      (p) => (p.type === "student") === isStudentOu && norm(p.lastName) === norm(u.lastName)
    );
    review.push({
      googleEmail: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      orgUnitPath: u.orgUnitPath,
      reason: hits.length ? "ambiguous" : "no-exact-match",
      candidates: (hits.length ? hits : suggestions).map((p) => ({
        factsId: p.factsId,
        type: p.type,
        firstName: p.firstName,
        lastName: p.lastName,
        ...(p.gradeLevel ? { gradeLevel: p.gradeLevel } : {}),
      })),
    });
  }
}

// One link per FACTS person: a second Google account claiming an already-linked
// person (e.g. a staffer's spare account) goes to review instead of links.
function claim(u, p, how) {
  const key = `${p.type}:${p.factsId}`;
  if (linkedFactsIds.has(key)) {
    review.push({
      googleEmail: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      orgUnitPath: u.orgUnitPath,
      reason: "duplicate-account",
      candidates: [{ factsId: p.factsId, type: p.type, alreadyLinkedTo: links.find((l) => l.factsId === p.factsId && l.type === p.type)?.googleEmail }],
    });
    return;
  }
  links.push({ googleEmail: u.email, factsId: p.factsId, type: p.type, firstName: u.firstName, lastName: u.lastName, how });
  linkedFactsIds.add(key);
}

// FACTS people we'd expect to hold an account but don't: staff + students 3rd
// grade up (school issues accounts from 3rd; PS-2nd absence is expected).
const unmatchedFacts = factsPeople.filter(
  (p) =>
    !linkedFactsIds.has(`${p.type}:${p.factsId}`) &&
    (p.type === "staff" || /^0[3-8]$/.test(p.gradeLevel))
);

await mkdir(new URL("data/", import.meta.url), { recursive: true });
const out = async (name, data) =>
  writeFile(new URL(`data/${name}`, import.meta.url), JSON.stringify(data, null, 2));
await out("identity-links.json", links);
await out("review.json", review);
await out("unmatched-facts.json", unmatchedFacts.map(({ factsId, type, firstName, lastName, gradeLevel }) => ({ factsId, type, firstName, lastName, ...(gradeLevel ? { gradeLevel } : {}) })));

console.log(`${candidates.length} candidate accounts`);
console.log(`  linked:  ${links.length} (${links.filter((l) => l.how === "staff-email").length} by staff email, ${links.filter((l) => l.how === "name-exact").length} by exact name)`);
console.log(`  review:  ${review.length} -> scripts/data/review.json`);
console.log(`  FACTS people missing an account: ${unmatchedFacts.length} -> scripts/data/unmatched-facts.json`);
