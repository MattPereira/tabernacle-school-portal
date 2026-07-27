# Is FACTS contact email the Family Portal login credential?

Resolves [issue #37](https://github.com/MattPereira/tabernacle-school-portal/issues/37).

**Answer: contact email is plausibly *a* credential, but never the *only* one — and changing it cannot lock anyone out.**

FACTS stores `username` as a field distinct from `email`, and the two are independent: `username` is seeded from `email` at account creation and thereafter does not follow it. The FACTS Family Portal sign-in accepts an email *or* a username, so rewriting `PersonVM.email` changes which email opens the door while leaving the username path untouched.

ADR-0001's parenthetical — contact email "is (likely) the credential" — is therefore half right, and the §3 rationale built on it ("risks breaking FACTS-portal logins") does **not** follow. A changed door is not a lost key.

Evidence tier: Swagger spec + a **read-only** live probe of the school's own FACTS data (2026-07-27). No writes were made. No live login test was performed (see [Residual risk](#residual-risk)).

## TL;DR

| Finding | Consequence |
|---|---|
| `PersonVM.username` exists, distinct from `email`/`email2` | FACTS models a credential separately from a contact address |
| Of **324** enrolled students whose contact email is `@tbs.org`, **zero** have `username == email` | The school already rewrote these emails by hand and **no username followed**. `username` does not track `email`. |
| **3 active staff have a username that is an email address differing from their current contact email** | Direct evidence of an email change leaving the username intact |
| 37 of 67 active staff with a populated username have a **non-email handle** | Majority of staff credentials are not email-shaped at all |
| Of the 9 staff on personal emails (#36's manual-fix cohort), **none** has `username == email` | "Ask the office to update your FACTS email" cannot disturb their username |
| **211 of 535 enrolled students have an empty contact email; 324 are already `@tbs.org`; none holds any other address** | The student-email migration writes **only into empty fields** — nothing to overwrite, regardless of how login works |

The load-bearing result is **independence**, not uniqueness. `username` survives an `email` change; that is shown directly by the 3 staff whose username is a stale address, and by the 324 students whose rewritten emails left their usernames alone.

**A uniqueness argument was considered and rejected.** Across all 9176 person records, `email` has 403 collisions on 368 shared addresses while `username` has none — which looks like proof that email cannot be a login identifier. It is not. Those collisions are concentrated in historical records (alumni, old parent rows). Among the **605 active people, 391 have an email and zero are shared**, so email is unique exactly where a login would need it to be. Do not revive this argument.

## What the spec says

`reference/facts/api-definitions.json` (Swagger 2.0, 369 paths, 1091 definitions):

- **No login resource exists anywhere in the API.** Zero paths matching user/login/credential/account/password in the authentication sense. `/Email/EmailAuthentication` is SPF/DKIM/DMARC domain configuration, not login. FACTS Family Portal accounts are simply not exposed by the SIS API.
- `CreatePersonBaseDto` (the body of `POST /People`, `PUT /People/{personId}`) carries three separate fields:
  - `email` — "The person's email address"
  - `email2` — "The person's alternate email address"
  - `username` — "The person's username"
- None is marked read-only, so all three are writable via `PUT`/`PATCH /People/{personId}`.

The spec establishes that FACTS distinguishes the concepts. It cannot, on its own, establish which one the Family Portal authenticates against — there is no Family Portal endpoint to inspect.

## What the live data says

Read-only pull of `/People` (9176 rows), `/people/Staff`, `/Students`, `/People/ParentStudent`. Reproduce with:

```
node --env-file=.env scripts/facts/probe-username-fetch.mjs   # hits the API once, caches to gitignored scripts/data/
node scripts/facts/probe-username.mjs                         # offline analysis, repeatable
```

### Enrolled students (535)

| Contact email | n | username blank | non-email handle | `username == email` |
|---|---|---|---|---|
| `@tbs.org` | 324 | 200 | 124 | **0** |
| none | 211 | 211 | — | — |

**This is the decisive cohort.** The school hand-entered `@tbs.org` addresses into 324 student contact-email fields. If contact email were the credential, those 324 records would now show `username` equal to the `@tbs.org` address. Not one does. 124 retain an unrelated non-email handle; 200 have no username at all.

### Active staff (70)

| Contact email | n | non-email handle | `username == email` | other email | blank |
|---|---|---|---|---|---|
| `@tbs.org` | 58 | 29 | 27 | 1 | 1 |
| personal | 9 | 6 | 0 | 2 | 1 |
| none | 3 | 2 | 0 | 0 | 1 |

The 27 staff where `username == email` are the only population where the two fields coincide — and they coincide because the username was *seeded from* the email at account creation, not because they are the same field. Changing `email` leaves the stored `username` untouched.

### Parents of enrolled students (1605)

| | n |
|---|---|
| username blank | 1173 |
| non-email handle | 324 |
| `username == email` | 99 |
| some other email | 9 |

Only 432 of 1605 parents have a Family Portal username at all, which independently suggests most families do not use the Family Portal.

### The suffix tell

Among the wider population, usernames of the form `someone@example.com-1`, `someone@example.com-2` appear — an email-shaped username with a numeric disambiguator appended. That pattern only makes sense if FACTS seeds `username` from `email` at account creation and then must break ties. It is direct evidence of the two fields being related-at-creation but independent thereafter.

## Consequences for the open decisions

**For [#38](https://github.com/MattPereira/tabernacle-school-portal/issues/38) (may FACTS be written?):** ADR-0001's first objection to writing school Gmails into FACTS — *"risks breaking FACTS-portal logins for every touched person"* — does not hold, for two independent reasons:

1. Writing `email` never invalidates a `username`, so the username sign-in path survives any email change.
2. **The student migration writes only into empty fields.** 211 enrolled students have no contact email; 324 already hold `@tbs.org`; none holds any other address. There is nothing to overwrite, so no email sign-in path and no reset flow can be disturbed — regardless of how FACTS authenticates.

The other two objections (a second system writing FACTS; the write still needs a Workspace→FACTS match first) are untouched by this research and remain live.

**For [#36](https://github.com/MattPereira/tabernacle-school-portal/issues/36) (the manual fix):** "ask the office to update your FACTS email" is cheap. It affects 9 staff, none of whom has `username == email`, so each keeps a working username sign-in. Their new `@tbs.org` address is their own mailbox, so email sign-in and password reset follow them rather than going astray.

**For ADR-0001 §3:** the stated rationale does not support the rule. Whether FACTS should nonetheless stay read-only is a separate judgement for #38 — this document removes one argument, it does not decide the question.

## Residual risk

Not disproven by this research, and worth naming rather than dismissing:

1. **Email sign-in is a real path, and rewriting an address moves it.** Where a person already has a contact email and signs in with it, changing that field changes which address works. This is not a lockout — their username still works — but for anyone who only ever knew the email path it is a support call. It does not arise in the student migration (empty fields only); it would arise in any future write that *overwrites* a populated address.
2. **Password reset and account creation are keyed on email.** Those flows mail a link to the address on file, so they follow the new address. For staff moving to `@tbs.org` that is their own mailbox and therefore fine. For any future student write into a *populated* field, a parent's reset could land in the child's inbox.
3. **No live login test was performed.** This is tier (b) evidence — spec plus read-only data — by explicit choice. A tier (c) test (change one email, attempt a Family Portal sign-in) is the only thing that would settle the email-vs-username question outright; it was not judged necessary once the migration turned out to touch only empty fields.
4. **`username` semantics are inferred, not documented.** FACTS' own documentation is behind their partner portal and was not reachable publicly (same limitation recorded in `facts-api-sync.md`). The claim that `username` is an independent credential rests on the seeding-and-suffix pattern, the 3 staff carrying stale-email usernames, and the negative result on the 324 rewritten student records — not on a FACTS statement.
5. **`email2` remains an untouched escape hatch.** If a future write must target a populated `email`, the address can go to `email2` instead, leaving `email` — and therefore every sign-in and reset flow — exactly as it is today. That is #38's call.

## Correction made to existing docs

`docs/research/facts-api-sync.md` claimed `/People.personId` "matches `personStudentId` for some records and `studentId` for others (legacy vs new)" and that `fetch-students.mjs` queries the union and falls back. That is wrong, and it cost real time here — joining the union inflated the enrolled-student cohort from 535 to 998 rows and produced a wrong count (48 instead of 324) before it was caught.

Measured on all 535 enrolled students, 2026-07-27:

| | resolves against `/People` |
|---|---|
| `studentId` | **535 / 535** |
| `personStudentId` | 463 / 535 — and **all 463 return a different person's name** |

`personStudentId` is a separate id space that happens to overlap the `personId` range. Joining on it does not fail; it silently attaches the wrong person. `fetch-students.mjs` already had this right. Both the field table and the bulk-migration note in `facts-api-sync.md` have been corrected.
