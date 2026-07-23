// Fetches all tbs.org Google Workspace users (students + staff) via the
// Admin SDK Directory API, using domain-wide delegation impersonation:
//   scripts/data/workspace-users.json  [{ email, firstName, lastName, orgUnitPath, suspended }]
//
// Run: node --env-file=.env scripts/google/fetch-workspace-users.mjs
//
// Requires: the service account key JSON dropped in secrets/ (gitignored),
// with domain-wide delegation authorized in the Workspace Admin console for
// the admin.directory.user.readonly scope. ADMIN_IMPERSONATE_EMAIL must be a
// super-admin (or a user granted Directory API read rights) — service
// accounts can't call the Directory API without impersonating a real user.

import { readFile, readdir, writeFile } from "node:fs/promises";
import { createSign } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SECRETS_DIR = fileURLToPath(new URL("../../secrets/", import.meta.url));
const OUT_FILE = new URL("../data/workspace-users.json", import.meta.url);
const SCOPE = "https://www.googleapis.com/auth/admin.directory.user.readonly";
const TOKEN_URI = "https://oauth2.googleapis.com/token";
const DOMAIN = "tbs.org";

const { ADMIN_IMPERSONATE_EMAIL } = process.env;
if (!ADMIN_IMPERSONATE_EMAIL) {
  console.error("Missing ADMIN_IMPERSONATE_EMAIL. Run with --env-file=.env");
  process.exit(1);
}

const keyFile = (await readdir(SECRETS_DIR)).find((f) => f.endsWith(".json"));
if (!keyFile) throw new Error(`No service account key JSON found in ${SECRETS_DIR}`);
const { client_email, private_key } = JSON.parse(await readFile(path.join(SECRETS_DIR, keyFile), "utf8"));

const base64url = (input) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

function signedJwt() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: client_email,
    scope: SCOPE,
    aud: TOKEN_URI,
    iat: now,
    exp: now + 3600,
    sub: ADMIN_IMPERSONATE_EMAIL,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = createSign("RSA-SHA256").update(signingInput).sign(private_key, "base64");
  const sig64 = signature.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${signingInput}.${sig64}`;
}

async function getAccessToken() {
  const res = await fetch(TOKEN_URI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt(),
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  const { access_token } = await res.json();
  return access_token;
}

async function fetchAllUsers(accessToken) {
  const all = [];
  let pageToken;
  do {
    const params = new URLSearchParams({ domain: DOMAIN, maxResults: "500", projection: "full" });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`https://admin.googleapis.com/admin/directory/v1/users?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Directory API failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    all.push(...(data.users ?? []));
    pageToken = data.nextPageToken;
    console.log(`  fetched ${all.length} users so far...`);
  } while (pageToken);
  return all;
}

console.log(`Authenticating as ${ADMIN_IMPERSONATE_EMAIL}...`);
const accessToken = await getAccessToken();

console.log(`Fetching ${DOMAIN} Workspace users...`);
const users = await fetchAllUsers(accessToken);

const out = users.map((u) => ({
  email: u.primaryEmail,
  firstName: u.name?.givenName ?? null,
  lastName: u.name?.familyName ?? null,
  orgUnitPath: u.orgUnitPath ?? null,
  suspended: u.suspended ?? false,
}));

await writeFile(OUT_FILE, JSON.stringify(out, null, 2));
console.log(`Wrote ${out.length} Workspace users to ${OUT_FILE}`);
