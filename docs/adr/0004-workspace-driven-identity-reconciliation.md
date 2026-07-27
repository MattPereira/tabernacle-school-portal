# Workspace-driven identity reconciliation

**Status:** Withdrawn (2026-07-27; never implemented)

[ADR-0005](0005-facts-derived-identity.md) chooses login-time FACTS-derived identity instead. This record is withdrawn, not superseded: no implementation ever depended on it. Its expensive part was the **push** shape—enumerating the Workspace domain and pre-computing every account/link—not its matching logic. The chosen **pull** shape resolves only the address currently signing in and needs no runtime Workspace Directory client, persistent exceptions, or reconciliation UI.

The portal mirrors every active FACTS person because future features need their data, but only actual login identities require links. Therefore identity reconciliation starts from active Google Workspace identities rather than treating every unlinked FACTS person as admin work. This preserves complete FACTS data while removing expected noise from younger students and other people without school logins.

After each successful FACTS sync, reconciliation reads Workspace independently. A unique normalized full-name match within the corresponding student/staff population creates a link automatically; fuzzy, missing, and ambiguous matches become persistent **identity exceptions** with suggestions and searchable manual resolution. Existing links are never automatically repointed or deleted. FACTS failure skips reconciliation; Workspace failure leaves the successful FACTS mirror and all existing links intact.

`/Staff/Programs & Devices/**` identities are ignored. Workspace organizational units assign and continuously update the `student` or `staff` role. A person-owned Workspace super-admin initializes the shared portal `admin` flag when linked; a one-time bootstrap grants it to current person-owned super-admins. After initialization, portal administrators control that flag manually, so later Workspace changes do not revoke it.

Every portal account must link to a FACTS person; the nullable staff exception from ADR-0001 is removed. `identity_link.google_email` becomes provider-neutral `login_email`, and a minimal `link_origin` records `seed`, `workspace_exact_name`, or `manual`. Future parent identities may use another authentication source; their child access derives from FACTS family relationships, so a staff member can remain primarily `staff` while also viewing linked children.

Workspace coverage gaps are separate IT concerns, not identity exceptions. Grade-based coverage reporting is deferred until account-issuance and school-year rollover rules are defined. Admin reconciliation results report automatic links, role updates, exceptions, ignored program/device accounts, and failed or skipped status—not every unlinked FACTS person.
