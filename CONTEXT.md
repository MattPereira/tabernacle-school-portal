# Domain glossary

Terms with settled meanings in this project. Use these words exactly; don't drift to synonyms.

- **Contact email** — the email field on a FACTS person. FACTS owns it; the portal never reads it for auth and never writes it. Not to be confused with login identity.
- **Login identity** — the Google account a person authenticates with (school-issued `tbs.org` Workspace account for students/staff). Governed by school IT, not FACTS.
- **Link table** (`identity_link`) — portal-owned mapping `google_email ↔ facts_person_id`. The one fact neither FACTS nor Workspace stores. Doubles as the allowlist. See [ADR-0001](docs/adr/0001-identity-link-table.md).
- **Linked / unlinked** — a login identity with / without a link-table row. Unlinked logins reach the **holding page** (name + "contact the office"), nothing else.
- **Holding page** — what an authenticated-but-unlinked user sees. The soft failure mode that keeps login independent of data quality.
- **Sync** — the scheduled read-only pull from the FACTS API into the portal DB. FACTS always wins; there is no write-back.
- **Walking skeleton** — the MVP: login, role-aware home, sync, admin view. A chassis for future features, deliberately feature-free.

## Avoided terms

- "FACTS email" as a login concept — say **contact email**, and remember it plays no role in auth (ADR-0001, Alternatives).
