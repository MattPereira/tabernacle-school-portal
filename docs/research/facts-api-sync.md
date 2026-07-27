# FACTS SIS API: students + staff sync research

Resolves [issue #7](https://github.com/MattPereira/tabernacle-school-portal/issues/7).

Primary sources, in trust order:

1. `reference/facts/api-definitions.json` — Swagger 2.0 spec of the FACTS SIS API (host `api.factsmgt.com`, 369 paths, 1091 definitions)
2. `scripts/facts/facts-client.mjs`, `scripts/facts/fetch-students.mjs`, `scripts/facts/fetch-staff.mjs`, `scripts/facts/probe-username-fetch.mjs` — working client code already run against the live API
3. Public web — searched; FACTS API docs are behind a partner portal, nothing citable found

## TL;DR

- **Sync reads:** `GET /Students` (ids, grade level, enrolled status) + `GET /People` (names, emails, modifiedDate) + `GET /People/Staff` (staff list, active flag). Two-step join required because neither `/Students` nor `/People/Staff` returns email.
- **Auth:** two static keys per request (Azure APIM subscription key + FACTS key). No OAuth, no token refresh.
- **Rate limit:** ~10 requests/minute (empirical, enforced with 429 + `Retry-After`). This dominates sync design.
- **Change detection:** no webhooks anywhere in the spec. `PersonVM.modifiedDate` exists on `/People` output; server-side `modifiedDate` Sieve filtering is plausible but unverified.
- **Student email write: YES** — `PUT /People/{personId}` (body `PersonVM`, has `email`/`email2`) or `PATCH /People/{personId}` (JSON Patch). Email lives on the person record, not the student record.

## Endpoints + fields for the sync

### Students

`GET /Students` — "Gets Students with Sieve filtering". Params: `includes`, `Filters`, `Sorts`, `Page`, `PageSize`, `api-version`. Returns `PagedResultOfStudentModelV1_3` (`results`, `currentPage`, `pageCount`, `pageSize`, `rowCount`, `nextPage`).

`StudentModelV1_3` key fields (spec):

| Field | Notes |
|---|---|
| `personStudentId`, `studentId` | both required; **join on `studentId` only** — `/People.personId == studentId`. `personStudentId` is a *different id space*: it also resolves against `/People`, but to an unrelated person. Verified 2026-07-27 on all 535 enrolled students — `studentId` resolved for 535/535, `personStudentId` resolved for 463 and returned a different person's name in 463/463 cases. Joining the union silently attaches wrong names and inflates the cohort to 998 rows. |
| `school.gradeLevel` | grade level (string, e.g. `"08"`) |
| `school.status` / `school.substatus` | enrolled status; filterable server-side: `Filters=school.status==Enrolled` (proven in `fetch-students.mjs`) |
| `school.enrollDate`, `school.withdrawDate`, `school.withdrawReason`, `school.graduationDate`, `school.nextStatus`, `school.nextGradeLevel` | lifecycle fields |
| `classYear`, `gender`, `birthdate`, `homeroom`, `advisorId`, `schoolCode`, `studentUDID` | misc |

**No name or email on the student model** — join to `/People`.

### People (names + emails for everyone)

`GET /People` — returns `PagedResultOfPersonVM`. `PersonVM` = `personId` + `hasProfilePicture` + `CreatePersonBaseDto` fields:

`firstName`, `lastName`, `middleName`, `nickName`, `email`, `email2`, `cellPhone`, `homePhone`, `username`, `birthdate`, `gender`, `deceased`, `addressID`, `legacyPersonId`, **`modifiedDate`** ("Last time Person was modified", date-time).

Proven batching pattern (from all three fetch scripts): `Filters=personId==id1|id2|...` (Sieve OR), ~200 ids per request to keep URL length sane.

### Staff

`GET /People/Staff` — returns `PagedResultOfStaffVmOutV1_1`. Fields (`StaffVmIn` + `StaffVmOut` + V1_1): `staffId`, `firstName`, `lastName`, `middleName`, `name`, **`active`**, `faculty`, `administrator`, `substitute`, `department`, `occupation`, `workPhone`, `startDate`/`endDate`, `fullTime`/`fte`, school-level booleans (`preschool`/`elementary`/`middleSchool`/`highSchool`), `schools`, `demographics` (V1_1).

**No email on staff output.** Proven join (`fetch-staff.mjs`): `staffId == personId` in `/People`, so fetch emails via one chunked `/People` request. Filter `active` client-side (no proven server-side filter in the scripts, though Sieve on `active` likely works).

### Parents (bonus, proven)

`GET /People/ParentStudent` gives parent-student links (`parentID`, `studentID`, `relationship`, `grandparent` flag); resolve names/emails via `/People` on `parentID`. Filterable `studentID==...|...`, or pull unfiltered — proven 2026-07-27 by `probe-username-fetch.mjs`: 10,021 links across 11 pages at `PageSize=1000`, resolving to 1,605 distinct parents of the 535 enrolled students.

An earlier revision of this doc cited a `fetch-parents.mjs`; no such script exists in this repo or its history.

## Auth model

From `securityDefinitions` in the spec + `facts-client.mjs`:

- `Ocp-Apim-Subscription-Key` header (or `subscription-key` query param) — Azure API Management subscription key
- `Facts-Api-Key` header — school-specific key (used by the client; not in the spec's securityDefinitions but required in practice)
- HTTPS only, host `api.factsmgt.com`, `api-version=1` query param

Static keys; no OAuth flow, no expiry handling needed.

## Rate limits

Not stated in the spec. Empirical, from `facts-client.mjs` (working code): **10 requests per rolling 60s window**; server returns `429` with a `Retry-After` header when exceeded. The client serializes all requests through a sliding-window limiter.

Consequence for sync design: a full students+staff sync is ~10–15 requests (1–2 pages of `/Students` + ~4 chunked `/People` calls + `/People/Staff` + staff `/People` chunks) ≈ **1–2 minutes minimum**. Fine for nightly sync; too slow for anything interactive.

## Change detection

- **Webhooks: none.** Zero matches for "webhook" in the 4MB spec; no eventing/subscription endpoints among all 369 paths.
- **No modified-since query parameter** on any endpoint — only generic Sieve `Filters`.
- `PersonVM.modifiedDate` exists on `/People` output, so incremental person sync is possible at worst client-side (fetch, compare). A server-side Sieve filter like `Filters=modifiedDate>2026-07-01` *may* work (Sieve supports `>`/`>=` on filterable fields) but is **unverified** — needs one live test. Note: `StudentModelV1_3` has **no** `modifiedDate`, so enrollment-status changes have no timestamp; detect those by diffing full `/Students` pulls (cheap: 1–2 requests).
- Practical design: scheduled full pull + local diff. Volume is small (hundreds of records), so this is not a problem at 10 req/min.

## Student email write support — YES

Email is a **person** attribute (`CreatePersonBaseDto.email` / `email2`), not a student attribute, so writes go through People endpoints:

- **`PUT /People/{personId}`** — "Updates a person". Body param `personVM`, schema `#/definitions/PersonVM`, which includes `email` ("The person's email address") and `email2`. Neither is marked read-only; `CreatePersonBaseDto` has no required fields, and `POST /People` uses the same DTO. Responses: 200/400/404/422/500.
- **`PATCH /People/{personId}`** — "Updates a person based on the json patch document". Takes a JSON Patch document (e.g. `[{"op":"replace","path":"/email","value":"new@school.org"}]`). Same response codes.

There is no email-bearing write endpoint under `/Students` — the only student writes are `PUT`/`PATCH /Students/{personStudentId}` and `/Students/{personStudentId}/School` (enrollment data, no email).

**Bulk migration plan:** for N students, N PATCH calls at 10/min ⇒ ~6s per student. E.g. 400 students ≈ 40 minutes, one-time. Recommend PATCH over PUT to avoid needing to round-trip the full `PersonVM`. **Target `personId == studentId`** — using `personStudentId` would write to a different, unrelated person (see the Students table above).

## Caveats

- Rate-limit figure and the `Facts-Api-Key` header are empirical (working client), not from official docs; official docs are behind FACTS' partner portal and were not reachable publicly.
- Server-side `modifiedDate` filtering and PATCH email writes are spec-supported but untested against the live API; each needs a single smoke-test call before being relied on.
