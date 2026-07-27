// One-time identity matcher: pairs active tbs.org Workspace accounts with
// FACTS people by name, producing reviewed data for a possible student rollout.
// It is an ops-time prototype, not a portal identity seed or runtime dependency.
//
//   scripts/data/review.json     ambiguous/unmatched Google accounts + candidate suggestions
//   scripts/data/unmatched-facts.json  FACTS people with no Workspace account
//
// Run: node scripts/build-identity-links.mjs
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
const manual = await read("data/manual-links.json").catch(() => ({ links: [], skip: {} }));

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
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .trim();

const factsPeople = [
  ...students.map((s) => ({ factsId: s.studentId, type: "student", ...s })),
  ...staff.map((s) => ({ factsId: s.staffId, type: "staff", ...s })),
];
const byName = new Map();
for (const p of factsPeople) {
  const key = `${norm(p.firstName)} ${norm(p.lastName)}`;
  byName.set(key, [...(byName.get(key) || []), p]);
}
const staffByEmail = new Map(staff.map((s) => [norm(s.email), s]));

const matches = [];
const review = [];
const matchedFactsIds = new Set();

for (const m of manual.links) {
  matches.push({ ...m, how: "manual" });
  matchedFactsIds.add(`${m.type}:${m.factsId}`);
}
const manuallyHandled = new Set([...Object.keys(manual.skip), ...manual.links.map((m) => m.googleEmail)]);

for (const u of candidates) {
  if (manuallyHandled.has(u.email)) continue;
  const isStudentOu = u.orgUnitPath.startsWith("/Students");
  const emailHit = !isStudentOu && staffByEmail.get(norm(u.email));
  if (emailHit) {
    claim(u, { factsId: emailHit.staffId, type: "staff" }, "staff-email");
    continue;
  }

  const key = `${norm(u.firstName)} ${norm(u.lastName)}`;
  let hits = (byName.get(key) || []).filter((p) => (p.type === "student") === isStudentOu);
  let how = "name-exact";
  if (hits.length !== 1) {
    const squash = (p) => norm(p.firstName).replace(/ /g, "") + " " + norm(p.lastName).replace(/ /g, "");
    const loose = factsPeople.filter((p) => (p.type === "student") === isStudentOu && squash(p) === squash(u));
    if (loose.length === 1) {
      hits = loose;
      how = "name-squashed";
    }
  }
  if (hits.length === 1) {
    claim(u, hits[0], how);
  } else {
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

function claim(u, p, how) {
  const key = `${p.type}:${p.factsId}`;
  if (matchedFactsIds.has(key)) {
    review.push({
      googleEmail: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      orgUnitPath: u.orgUnitPath,
      reason: "duplicate-account",
      candidates: [{ factsId: p.factsId, type: p.type, alreadyMatchedTo: matches.find((l) => l.factsId === p.factsId && l.type === p.type)?.googleEmail }],
    });
    return;
  }
  matches.push({ googleEmail: u.email, factsId: p.factsId, type: p.type, firstName: u.firstName, lastName: u.lastName, how });
  matchedFactsIds.add(key);
}

const unmatchedFacts = factsPeople.filter(
  (p) =>
    !matchedFactsIds.has(`${p.type}:${p.factsId}`) &&
    (p.type === "staff" || /^0[3-8]$/.test(p.gradeLevel))
);

await mkdir(new URL("data/", import.meta.url), { recursive: true });
const out = async (name, data) =>
  writeFile(new URL(`data/${name}`, import.meta.url), JSON.stringify(data, null, 2));
await out("review.json", review);
await out("unmatched-facts.json", unmatchedFacts.map(({ factsId, type, firstName, lastName, gradeLevel }) => ({ factsId, type, firstName, lastName, ...(gradeLevel ? { gradeLevel } : {}) })));

console.log(`${candidates.length} candidate accounts`);
console.log(`  matched: ${matches.length}`);
console.log(`  review:  ${review.length} -> scripts/data/review.json`);
console.log(`  FACTS people missing an account: ${unmatchedFacts.length} -> scripts/data/unmatched-facts.json`);
