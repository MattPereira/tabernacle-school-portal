// Fetches active staff from the FACTS API with minimal info:
//   scripts/data/staff.json  [{ staffId, firstName, lastName, email }]
//
// Run: node --env-file=.env scripts/fetch-staff.mjs
//
// The /people/Staff list output has no email, but staffId == personId in
// /People, so emails come from one chunked /People request.

import { writeFile } from "node:fs/promises";
import { apiGetAll } from "./facts-client.mjs";

const OUT_FILE = new URL("../data/staff.json", import.meta.url);
const ID_CHUNK = 200; // personIds per /People request (keeps URL length sane)

console.log("Fetching staff...");
const staff = await apiGetAll("/people/Staff");
const active = staff.filter((s) => s.active);

console.log("Fetching people (for emails)...");
const ids = active.map((s) => s.staffId);
const people = [];
for (let i = 0; i < ids.length; i += ID_CHUNK) {
  const chunk = ids.slice(i, i + ID_CHUNK);
  people.push(...(await apiGetAll("/People", { Filters: `personId==${chunk.join("|")}` })));
}
const personById = new Map(people.map((p) => [p.personId, p]));

const out = active.map((s) => ({
  staffId: s.staffId,
  firstName: s.firstName,
  lastName: s.lastName,
  email: personById.get(s.staffId)?.email || null,
}));

await writeFile(OUT_FILE, JSON.stringify(out, null, 2));
console.log(`Wrote ${out.length} active staff (of ${staff.length}) to ${OUT_FILE}`);
