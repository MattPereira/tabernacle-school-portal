# ADR-0005: Derive portal identity from FACTS contact email

**Status:** Accepted (2026-07-27)
**Wayfinder:** [map #36](https://github.com/MattPereira/tabernacle-school-portal/issues/36), decisions [#37](https://github.com/MattPereira/tabernacle-school-portal/issues/37), [#38](https://github.com/MattPereira/tabernacle-school-portal/issues/38), [#39](https://github.com/MattPereira/tabernacle-school-portal/issues/39), and [#40](https://github.com/MattPereira/tabernacle-school-portal/issues/40)

## Context

ADR-0001 rejected FACTS contact email as identity because the field was absent for most students, often held a parent's address, and used personal addresses for many staff. Live data on 2026-07-27 no longer supports that conclusion:

| Active people | No email | Personal email | `@tbs.org` |
|---|---:|---:|---:|
| Staff (70) | 3 | 9 | 58 |
| Students (535) | 214 | 0 | 321 |

Of 605 active people, 379 now have an `@tbs.org` contact email. Of 340 links built by the prototype name matcher, 326 (96%) had identical FACTS contact and Google addresses. Active people had zero duplicate `@tbs.org` contact emails. The derived rule adds 39 eligible accounts compared with the prototype links; remaining staff discrepancies are data fixes in FACTS.

ADR-0001 also treated contact email as likely inseparable from the FACTS Family Portal credential. [Research](../research/facts-family-portal-credential.md) found a distinct, stable `username`; changing `email` moves an email sign-in/reset path but does not remove the username credential. The planned student change would fill only empty email fields. The old lockout argument is withdrawn.

## Decision

FACTS is the sole source of portal identity and role. The portal owns no identity table, exception state, role, or admin flag.

A Google login resolves by trimming and lowercasing its `@tbs.org` address, then matching it to `facts_person.contact_email`. No plus-address or dot folding occurs. Identity derives from the local FACTS snapshots: read-only, potentially stale copies named `facts_person`, `facts_student`, and `facts_staff`.

The match query resolves a person before access is gated by role. Role is derived from staff/student snapshot membership and never stored. For MVP:

- exactly one staff match grants access;
- a staff match takes permanent precedence over student matches because a student's contact email may identify their family, while a staff contact email identifies the staff member;
- a student-only match reaches a student-not-yet holding page;
- no match or a same-role collision reaches the generic holding page.

The generic page states the matching rule and shows only the signed-in user's own `@tbs.org` address. It never reveals an email read from FACTS. Role gating is an exhaustive switch so student rollout changes the student case rather than the identity query.

### Presence, not active status

Identity matching ignores `inactive` on person, staff, and student rows. Because sync retains rows, access means **the address matches a row that some sync has ever seen**, not necessarily a currently active FACTS record. This preserves flag-don't-revoke and prevents a partial FACTS response from causing a school-wide lockout.

Workspace suspension is therefore the only revocation lever. Prompt, reliable suspension of leavers is an operational dependency. A stale row plus a reassigned address could cause permanent same-role ambiguity; TBS does not currently reassign addresses, and manual SQL is the only repair if that assumption changes.

### MVP FACTS writes

FACTS remains read-only for the MVP because no staff-only feature needs to write it—not because FACTS writes are forbidden in principle. Whether student rollout may fill empty contact emails, whether that is ops-time only, which fields are permitted, what human review is required, and whether relocated Workspace-to-FACTS matching is acceptable are explicitly deferred to that rollout. Any writer would be security-sensitive because changing FACTS contact email can grant portal access.

### Admin and sync

There is no admin role or admin screen. Any signed-in user may trigger the read-only, transactional sync and see its latest status on the home page. MVP has no cooldown; the trigger is disabled only while a run is in flight. Flag clearing and `flagged_by_run_id` attribution are removed. The sync-run lifecycle from ADR-0003 remains.

## Consequences

- Login performs one pull-style lookup for the address in front of it. The runtime never enumerates Workspace and needs no Directory domain-wide delegation.
- Google OAuth and server-side hosted-domain enforcement remain. Ops-time Workspace prototypes may remain local; delegated credentials never enter production.
- The portal has no identity records to seed, reconcile, administer, migrate, or drift from FACTS.
- Missing/mistyped FACTS contact data denies access until corrected in FACTS. Same-role ambiguity fails closed.
- Parent identity, student access, cron sync, and any FACTS write permission remain out of scope.

## Retired decisions

- [ADR-0001](0001-identity-link-table.md) is superseded. Its portal-owned account/link model, stored roles, and manual exceptions fall. Its read-only rule survives only as MVP scope; its Family Portal lockout rationale does not.
- [ADR-0004](0004-workspace-driven-identity-reconciliation.md) is withdrawn, not superseded, because it was never implemented. Its cost came from pushing over the entire Workspace domain and pre-computing links. Matching itself remains useful only as a possible reviewed ops-time student-rollout tool.
- [ADR-0003](0003-sync-run-lifecycle-and-flag-attribution.md) remains authoritative for sync-run lifecycle. Its flag-attribution decision is superseded because the clearing workflow and admin consumer are removed.
