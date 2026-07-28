# Domain glossary

Terms with settled meanings in this project. Use these words exactly; don't drift to synonyms.

- **Contact email** — the email field on a FACTS person. For portal identity it is the person-owned `@tbs.org` address matched to the Google login after trim + lowercase normalization. On student records it may instead be a family's address, so staff membership takes precedence when the same address appears on staff and student records. FACTS owns the field; the MVP reads it for auth and does not write it.
- **Login identity** — the authenticated `@tbs.org` Google address. It receives staff access only when it matches the contact email of exactly one staff member in the FACTS snapshot; same-role ambiguity denies access.
- **Role** — `student` | `staff`, derived from FACTS snapshot membership and never stored. The MVP permits staff only; a matched student reaches the student-not-yet holding page. Staff membership permanently takes precedence over student membership for a person or shared contact email.
- **Holding page** — what a signed-in user without staff access sees. A matched student is told student access is not available. Other failures state the contact-email match rule and name only the user's own `@tbs.org` address, never an email read from FACTS. No request-access flow.
- **Sync** — the read-only MVP pull from the FACTS API into the portal's FACTS snapshot. FACTS always wins. Any signed-in user may trigger it from the home page; concurrent triggering is disabled while a run is in flight (cron is a fast-follow on the same endpoint). Applies all-or-nothing in one transaction.
- **FACTS snapshot** (`facts_person`, `facts_student`, `facts_staff`) — the portal's local, read-only, potentially stale copy of FACTS data. Rows are retained and flagged rather than deleted when they leave the FACTS active set.
- **FACTS snapshot population** — every FACTS person whose data the application may need, whether or not that person can log in. This includes younger students whose parents may later view their data.
- **Sync run** (`sync_run`) — one row per sync, created when the run *starts* and finalized when it *ends*; `outcome` (`applied` | `failed`) and `finished_at` are null while in flight, or if the run crashed. The home page's answer to "did the last sync work?".
- **Flagged (inactive)** — a FACTS snapshot row that left the FACTS active set: kept and marked `inactive`, never deleted. Identity matching deliberately ignores `inactive` on person, staff, and student rows: access derives from any row a sync has ever seen. Workspace suspension is the only revocation lever.
- **Walking skeleton** — the MVP: staff-only login, home page, and home-page sync status/trigger. A chassis for future features, deliberately feature-free.
- **Controlled prototype** — a portal feature intended for evaluation by the developer and school super-admin, without prototype-specific authorization. The **Staff** feature appears in shared navigation and is technically available to every authenticated staff user; the audience restriction is operational only.
- **Staff entry** — one row in the portal's **Staff** list for a staff member currently present in FACTS' active staff set. Inactive staff remain in the FACTS snapshot but are absent from Staff and its search results; the prototype has no separate detail pages.
- **Professional staff profile** — the approved FACTS data describing a staff member: name, department, photo, and contact email. Contact email is included even when personal and displayed without a special label. School assignment is omitted because this is a single-school portal; job title and grade taught are omitted because verified FACTS read endpoints do not expose reliable values; education and certification are deferred because current FACTS data has no records for active staff. Other private, demographic, credential, medical, financial, government-identifier, free-text note, and custom-field data is never stored, logged, or displayed; fields unavoidably returned by an approved FACTS endpoint are discarded during normalization.

## Avoided terms

- "FACTS email" — say **contact email**. It is the FACTS-owned field the portal uses to resolve a Google login; it is not a second login identity.
- "active" as an access condition — snapshot presence grants identity even when the matching rows are flagged inactive.
- "Directory" in the UI — label the feature and navigation item **Staff**.
