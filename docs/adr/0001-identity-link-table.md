# ADR-0001: Identity via portal-owned link table; FACTS is never written

**Status:** Accepted (2026-07-22)
**Wayfinder:** [map #6](https://github.com/MattPereira/tabernacle-school-portal/issues/6), decided in [#5](https://github.com/MattPereira/tabernacle-school-portal/issues/5) (revised) with [#1](https://github.com/MattPereira/tabernacle-school-portal/issues/1) and [#4](https://github.com/MattPereira/tabernacle-school-portal/issues/4)

## Context

The portal needs two things from login: a **gate** (only school people get in; nobody self-registers) and an **identity** (a login must resolve to a FACTS record so features can use FACTS data).

FACTS and Google Workspace share **no common key**. The word "email" hides two different concepts:

- **Contact email** — the email field on a FACTS person. FACTS owns it. It is absent for 397/535 students, holds the *parents'* address for most of the rest, and is a personal gmail/yahoo for 15/67 staff. It is also (likely) the credential for FACTS Family Portal login.
- **Login identity** — the school-issued `tbs.org` Google Workspace account. FACTS has no field for it.

Any design must record "this Google account = that FACTS person" somewhere.

## Decision

A portal-owned table:

```
identity_link: google_email ↔ facts_person_id
```

1. **The link table is the allowlist.** Row exists = account exists. No self-registration. A `tbs.org` login with no row lands on a holding page ("contact the office").
2. **Sources of truth split by domain.** Google Workspace answers *"can this person log in?"* (IT disabling the account revokes access). FACTS answers *"who is this person in the school?"* (role, grade, enrollment) — synced read-only, FACTS always wins. The link table holds the one fact neither system stores.
3. **FACTS is never written.** Its email field stays untouched (it's their FACTS-portal credential). Contact email plays no role in portal auth — for anyone.
4. **The gate is enforced by link-table lookup**; the `tbs.org` domain restriction is a *policy layered on top* (OAuth `hd` hint + server-side check), not the invariant.
5. **Seeding:** one-time script name-matches the Workspace export against FACTS people (contact-email equality as a bonus signal); fuzzy cases get a human eyeball. Throwaway migration, not production code.
6. **Ongoing:** sync surfaces FACTS records with no link row on an admin "unlinked people" screen with name-match suggestions; admin confirms in one click (~60–80 people/yr, clustered at fall enrollment). Login-time matching does not exist — logins only look up the table.

## Consequences

- Logins cost one table lookup; a failed sync can never break login.
- Non-person Workspace accounts (`office@`, class accounts, devices — ~57 exist) can authenticate but hit the holding page: harmless by construction.
- Future flexibility is a policy tweak, never a schema change:
  - **Parents** (out of scope for MVP): add magic-link as a second auth provider; their link rows auto-seed from FACTS contact email, which for parents *is* their own address (735/884 present).
  - **Non-`tbs.org` staff exception:** admin creates a link row; domain policy becomes "tbs.org OR has-link-row".
- Cost: one small table + one admin screen, plus the one-time seeding eyeball work.

## Alternatives rejected

- **FACTS contact email as login identifier / allowlist** — no identifier exists for ~74% of students; identifies the wrong person (a parent) where present; forces personal emails into school auth for 15 staff. The data disqualifies it. (This resurfaced repeatedly during design — if you're re-deriving it, stop here.)
- **Write school Gmails into FACTS** (`PUT/PATCH /People/{personId}` — API supports it) — risks breaking FACTS-portal logins for every touched person; creates a second system writing FACTS; still needs the same matching work first.
- **Local override of FACTS fields with provenance** — reconciliation logic and drift UI for a problem the link table dissolves; FACTS stays sole owner of its data instead.
