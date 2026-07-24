# Codebase conventions

The living map of where things go and the rules to follow. Frozen rationale for every choice here lives in [ADR-0002](adr/0002-codebase-conventions.md); if this file and the ADR ever disagree, the ADR is the record of *why* and this file is the record of *what now*.

## Layout

```
src/                      everything the running app imports at runtime
├── app/                    Next.js plumbing — routes, server actions, RSC, better-auth wiring.
│                           NO business logic; calls into lib/.
├── lib/                    the app's non-UI, non-route code
│   ├── db/                   schema/ (auth.ts + mirror.ts + portal.ts) + client.ts   [wiring]
│   ├── auth/                 better-auth instance, browser client, getViewer()  [wiring]
│   ├── facts/                rate-limited read-only FACTS API client          [wiring]
│   ├── sync/                 read-only FACTS → DB sync + its admin reads   [rule module]
│   └── identity/             resolveAccess(email, deps) + link management  [rule module]
└── components/             presentational (admin/ = the admin screen's forms)

tests/                    Vitest suites — not runtime-imported, so outside src/
├── identity/                one file per behavior at the resolveAccess seam
├── sync/                    one file per behavior at the sync(deps) seam
└── support/                 db.ts — PGlite + migrations; facts.ts — the fake FACTS client

reference/                external-system REFERENCE material (read while building; not imported)
└── facts/                   api-definitions.json — the FACTS API Swagger spec

scripts/                  ops-time scripts, run once — not runtime-imported
├── build-identity-links.mjs  the seed matcher (Workspace account -> FACTS person)
├── seed-identity-links.ts    loads the matcher's verified pairs into identity_link
├── facts/                    FACTS fetchers + shared rate-limited client
├── google/                   Workspace Directory fetcher
└── data/                     shared I/O for all of the above [gitignored — student PII]

secrets/                  gitignored service-account keys (Google domain-wide delegation)
drizzle/                  generated migration SQL
drizzle.config.ts         points at src/lib/db/schema
docs/                     CONTEXT.md glossary, adr/ decision records, this file
```

## The rules

1. **The `src/` barrier is "does the running app import it?"** — not "is it Next.js?". Framework-free logic still ships, so it's in `src/`. Migrations, seed scripts, data, and external reference do not ship → root.
2. **`app/` holds no business logic.** Routes/actions/RSC call into `lib/`. If there's an `if` deciding a school rule inside `app/`, it's misfiled.
3. **Rule modules accept deps, return results, and never import `next/*`.** `lib/sync` and `lib/identity` take their db handle / FACTS client as arguments so they test without booting Next. Grep a rule module for `next` → should be zero hits. "May they?" is a dep too: the admin writes in `lib/identity` take the actor's `Access` and refuse a non-admin themselves, because a server action is a POST endpoint — the page guard in `lib/auth` protects rendering, not the mutation.
4. **Schema splits by ownership.** `db/schema/mirror.ts` = read-only FACTS copy (never authoritative); `db/schema/portal.ts` = portal-owned truth (`identity_link`, `sync_run`); `db/schema/auth.ts` = better-auth's own tables, shaped by its adapter and not ours to tune. `identity_link` deliberately holds no FK to `user` — the allowlist exists before anyone signs in.
5. **External API contracts live in `reference/`, not `docs/` and not `src/`.** Material you read while building (not imported code); the runtime client lives in `src/lib/`.

## Testing

- **Vitest**, all tests under `tests/` (settled while building #18 — tests aren't runtime-imported, so the `src/` barrier keeps them out). Mirror the module path: `tests/identity/` covers `src/lib/identity`.
- **Test the deep modules through their interfaces** — `sync(deps)`, `resolveAccess(email, deps)`. `app/` and components get little-to-no test.
- **Wiring gets no test, so behavior doesn't live in wiring.** If a requirement needs asserting and it sits in `lib/auth` or `app/`, that's the signal to move the decision into a rule module and inject what it needs (this is why `recordLoginAttempt` takes a `log`). Don't widen the no-test rule to cover logic — move the logic.
- **PGlite** for a real in-process Postgres — exercises real SQL/transactions, no Docker. `tests/support/db.ts` applies the real `drizzle/` migrations, so a migration that would fail in production fails in tests first.
- **No E2E / Playwright** unless a concrete flow later proves un-coverable more cheaply.
- Every ticket ships with a test.
