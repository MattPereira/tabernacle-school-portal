# Domain glossary

Terms with settled meanings in this project. Use these words exactly; don't drift to synonyms.

- **Contact email** — the email field on a FACTS person. FACTS owns it; the portal never reads it for auth and never writes it. Not to be confused with login identity.
- **Login identity** — the Google account a person authenticates with (school-issued `tbs.org` Workspace account for students/staff). Governed by school IT, not FACTS.
- **Link table** (`identity_link`) — portal-owned table of portal accounts: `google_email ↔ facts_person_id` (nullable — a row is a portal account, *optionally* linked to FACTS). Doubles as the allowlist; carries the portal-owned role and admin flag. Unique on `google_email` only. See [ADR-0001](docs/adr/0001-identity-link-table.md) incl. Amendment.
- **Role** — portal-owned fact on a link row: `student` | `staff`, single-valued, set at link creation. Never derived from FACTS (its role flags are unusable); sync flags drift as an admin suggestion only. Decided in [#12](https://github.com/MattPereira/tabernacle-school-portal/issues/12).
- **Admin** — orthogonal portal-owned boolean on a link row; grants the link-management screen. Not FACTS "administrator" (= SIS access) and not Workspace admin (= IT).
- **Linked / unlinked** — a login identity with / without a link-table row. Unlinked logins reach the **holding page** (name + "contact the office"), nothing else.
- **Holding page** — what an authenticated-but-unlinked user sees: Google-name greeting, "contact the school office", sign-out. No request-access flow, no role guess. The soft failure mode that keeps login independent of data quality. Unlinked logins are server-logged (no UI).
- **Sync** — the read-only pull from the FACTS API into the portal DB mirror. FACTS always wins; there is no write-back. MVP trigger is a manual admin-screen button (nightly cron is a fast-follow on the same endpoint). Applies all-or-nothing in one transaction; **never revokes access** — FACTS-inactive people are flagged for the admin, and Workspace suspension is the real kill switch. Decided in [#13](https://github.com/MattPereira/tabernacle-school-portal/issues/13).
- **Sync run** (`sync_run`) — one row per sync, created when the run *starts* and finalized when it *ends*; `outcome` (`applied` | `failed`) and `finished_at` are null while in flight, or if the run crashed. The admin screen's answer to "did the last sync work?", and the unit an admin clears flags by. See [ADR-0003](docs/adr/0003-sync-run-lifecycle-and-flag-attribution.md).
- **Flagged (inactive)** — a mirror record that left the FACTS active set: kept, marked `inactive`, and stamped with the **sync run** that flagged it. Never deleted, and access is unaffected (*flag-don't-revoke*). Cleared wholesale per run by the admin, or automatically when the record returns to FACTS. See [ADR-0003](docs/adr/0003-sync-run-lifecycle-and-flag-attribution.md).
- **Walking skeleton** — the MVP: login, role-aware home, sync, admin view. A chassis for future features, deliberately feature-free.

## Avoided terms

- "FACTS email" as a login concept — say **contact email**, and remember it plays no role in auth (ADR-0001, Alternatives).
