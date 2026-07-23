# ADR-0002: Codebase conventions & architecture for the walking skeleton

**Status:** Accepted (2026-07-23), amended (2026-07-23 — see Amendment)
**Wayfinder:** [map #6](https://github.com/MattPereira/tabernacle-school-portal/issues/6), decided in [#14](https://github.com/MattPereira/tabernacle-school-portal/issues/14). Builds on the stack choice ([#3](https://github.com/MattPereira/tabernacle-school-portal/issues/3): Next.js + TS + Neon/Drizzle + better-auth + Vercel).

## Context

The walking skeleton needs its structure and patterns settled *before* the first line ships, so a build can start cold. Two audiences read this codebase: **AI agents** driving `/implement`, and **students/staff** maintaining the portal. Both are served by the same thing — a small number of legible, checkable rules — so teachability and agent-navigability are one goal, not two.

The repo is currently greenfield: no `package.json`, no app. The only tracked non-doc file is one seed script; the `db/`, `facts/`, and `google/` directories are throwaway exploratory prototypes (data-shape spikes) — not go-forward code.

Standing preference for the whole map: **bias to the simplest thing.** Several tempting structures were rejected for being ahead of need.

## Decision

### 1. Single App-Router app at the repo root, with `src/`

No monorepo, no `packages/`. One Next.js app. Code lives under `src/`; config, data, scripts, and docs sit at the root.

The `src/` line is a **runtime barrier**, not a "framework vs not" line: *if the deployed app imports it at runtime, it lives in `src/`.* This is why the framework-free logic modules still live in `src/`, and why migrations/seed scripts/data do not. `src/` earns its keep here specifically because real non-app siblings exist at root (`reference/`, `scripts/`, `docs/`); without them a root `app/` would be preferred.

### 2. `app/` is plumbing; logic lives in deep modules under `src/lib/`

The one hard rule: **`app/` holds no business logic.** Routes, server actions, RSC, and better-auth wiring call *into* `src/lib/`; they never contain the rules themselves.

The two behaviors with real logic — **sync** and **access resolution** — are **deep modules** (`src/lib/sync`, `src/lib/identity`): a lot of behavior behind a small interface. They **accept their dependencies** (db handle, FACTS client) rather than importing them, and **never import `next/*`**, so they are testable without booting Next.

There is **no separate `server/` folder.** It was considered and rejected: a dedicated folder buys legibility (a "rules live here" signpost) but *no* depth or testability — depth is a property of a module's interface, not its directory. At two modules the folder was ahead of need. The rules-vs-wiring distinction is therefore carried by **module shape**, not by directory:

- **rule modules** (`lib/sync`, `lib/identity`) — accept deps, return results, hold the branching logic, no `next/*`.
- **wiring modules** (`lib/db`, `lib/auth`) — thin glue over drizzle / better-auth.

(Note: "keep `lib/` free of logic" is *not* a rule — `lib/` holds both rules and wiring. There is no universal meaning for `lib/`; here it means "the app's non-UI, non-route code.")

### 3. Drizzle schema split by ownership

`src/lib/db/schema/` splits into `mirror.ts` (the read-only FACTS copy — students/people/staff) and `portal.ts` (portal-owned tables — `identity_link`, `sync_run`), re-exported from `index.ts`. The split encodes the system's core invariant in the file layout: **mirror is never authoritative; portal is.** The db client (`client.ts`) sits alongside. `drizzle.config.ts` and the generated `drizzle/` migrations stay at root (config + ops artifacts, not runtime-imported).

### 4. External-system reference lives in `reference/`

`reference/facts/` holds the FACTS API contract (`api-definitions.json` — a 3.8 MB Swagger 2.0 spec, consulted while writing the fetcher, imported by nothing) as durable **reference**, not code. It's named `reference/` rather than `integrations/` deliberately: no integration *code* lives here — the runtime FACTS *client* (sync's dependency) lives in `src/lib/`. `reference/` can later hold Google Workspace reference material too.

### 5. Prototype directories are deleted in the first build

`db/`, `facts/`, and `google/` are exploratory prototypes. Keep the *answers*, delete the *code*:
- FACTS contract → `reference/facts/api-definitions.json`.
- Seed script + its data → `scripts/` (ops-time, run once; not runtime-imported).
- The Google service-account key stays gitignored and out of the repo.

⚠️ The seed data (`identity-links.json`, 340 pairs) is **student PII** — whether it is ever committed vs. regenerated from FACTS at seed time is deferred to the seed/sync build, not decided here.

> **Superseded in part** by the Amendment below: the fetchers are kept, not deleted.

### 6. Testing: Vitest, through the module interface, on PGlite; no E2E

- **Vitest** — TS-native, fast, approachable.
- **Test the deep modules through their interfaces** — `sync(deps)`, `resolveAccess(email, deps)`: the all-or-nothing apply, the <50% guard, flag-don't-revoke, linked/unlinked/role resolution. `app/` and components get little-to-no test.
- **PGlite** — embedded in-process Postgres, Drizzle-supported. Real SQL/transaction semantics (the transaction *is* the behavior in sync), no Docker, no network. Chosen over a Neon test branch (network + lifecycle cost) and an in-memory fake (stops testing real SQL).
- **No E2E / no Playwright, and not planned.** The one flow worth E2E-ing (OAuth) is the worst to E2E, and the MVP has no complex client-side UI. Adopt E2E only if a concrete flow later proves un-coverable by cheaper tests — a real trigger, not a scheduled milestone.
- **Convention:** every ticket ships with a test; `/implement` drives `/tdd` red-green.

## Amendment (2026-07-23, [#17](https://github.com/MattPereira/tabernacle-school-portal/issues/17))

The **fetchers are kept**, not deleted, in `scripts/facts/` and `scripts/google/` (layout in [conventions](../conventions.md)). They're the only executable record of how the external APIs are actually called — FACTS' 10 req/min ceiling and Sieve filter syntax, Workspace JWT impersonation — and are ops-time, which is what `scripts/` is for. The runtime FACTS client under `src/lib/` is still to be written, *from* these. Service-account key now lives in gitignored `secrets/`.

⚠️ Being gitignored, these were unrecoverable when deleted; `fetch-parents.mjs` was lost for good. Commit prototype code before a cleanup ticket touches it.

## Consequences

- One legible barrier (`src/` = ships) and one hard rule (`app/` holds no logic) — both grep-checkable, both teachable in a sentence.
- `sync`/`identity` are unit-testable against real Postgres without Next, so auth/sync confidence comes from module tests + manual click-through, not a browser harness.
- The rules-vs-wiring line is advisory (module shape), not folder-enforced — a business rule *could* be misfiled next to the db client; code review catches it rather than the directory structure.
- Living conventions are duplicated in two places by design: this ADR (frozen rationale) and `docs/conventions.md` (the living folder map, linked from `AGENTS.md`). If the quick-reference drifts stale, delete it — this ADR still holds the rationale.

## Alternatives rejected

- **Root `app/` (no `src/`)** — the framework default and the modal shape in training data, but it mixes app code with the real non-app root siblings this repo has. `src/` draws the ships/doesn't-ship line.
- **Separate `src/server/` for logic** — bought a legibility signpost but no depth or testability; ahead of need at two modules. Module shape carries the distinction instead.
- **Neon test branch / in-memory fake for tests** — fidelity-vs-cost on one side, loss of real SQL on the other; PGlite is the middle that keeps transaction semantics cheaply.
- **Playwright E2E now or scheduled** — real overhead and flakiness, weakest exactly where wanted (OAuth), unjustified by a feature-free skeleton.
