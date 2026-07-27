// Raw pull for the issue #37 probe. Caches to gitignored scripts/data/ so the
// analysis can be re-run without re-hitting the rate-limited API.
//
// Run: node --env-file=.env scripts/facts/probe-username-fetch.mjs

import { writeFile } from "node:fs/promises";
import { apiGetAll } from "./facts-client.mjs";

const out = (name) => new URL(`../data/probe-${name}.json`, import.meta.url);

const pulls = [
  ["people", "/People", {}],
  ["staff", "/people/Staff", {}],
  ["students", "/Students", {}],
  ["parent-links", "/People/ParentStudent", {}],
];

for (const [name, path, params] of pulls) {
  console.log(`Fetching ${path}...`);
  const results = await apiGetAll(path, params);
  await writeFile(out(name), JSON.stringify(results));
  console.log(`  cached ${results.length} rows -> probe-${name}.json`);
}
