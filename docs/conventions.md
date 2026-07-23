# Codebase conventions

The living map of where things go and the rules to follow. Frozen rationale for every choice here lives in [ADR-0002](adr/0002-codebase-conventions.md); if this file and the ADR ever disagree, the ADR is the record of *why* and this file is the record of *what now*.

## Layout

```
src/                      everything the running app imports at runtime
├── app/                    Next.js plumbing — routes, server actions, RSC, better-auth wiring.
│                           NO business logic; calls into lib/.
├── lib/                    the app's non-UI, non-route code
│   ├── db/                   schema/ (mirror.ts + portal.ts) + client.ts   [wiring]
│   ├── auth/                 better-auth instance                          [wiring]
│   ├── sync/                 read-only FACTS → DB sync                      [rule module]
│   └── identity/             resolveAccess(email, deps): linked? role?     [rule module]
└── components/             presentational

reference/                external-system REFERENCE material (read while building; not imported)
└── facts/                   api-definitions.json — the FACTS API Swagger spec

scripts/                  ops-time scripts run once (e.g. seed) + their data
drizzle/                  generated migration SQL
drizzle.config.ts         points at src/lib/db/schema
docs/                     CONTEXT.md glossary, adr/ decision records, this file
```

## The rules

1. **The `src/` barrier is "does the running app import it?"** — not "is it Next.js?". Framework-free logic still ships, so it's in `src/`. Migrations, seed scripts, data, and external reference do not ship → root.
2. **`app/` holds no business logic.** Routes/actions/RSC call into `lib/`. If there's an `if` deciding a school rule inside `app/`, it's misfiled.
3. **Rule modules accept deps, return results, and never import `next/*`.** `lib/sync` and `lib/identity` take their db handle / FACTS client as arguments so they test without booting Next. Grep a rule module for `next` → should be zero hits.
4. **Schema splits by ownership.** `db/schema/mirror.ts` = read-only FACTS copy (never authoritative); `db/schema/portal.ts` = portal-owned truth (`identity_link`, `sync_run`).
5. **External API contracts live in `reference/`, not `docs/` and not `src/`.** Material you read while building (not imported code); the runtime client lives in `src/lib/`.

## Testing

- **Vitest**, tests colocated or under `tests/` (TBD at first build).
- **Test the deep modules through their interfaces** — `sync(deps)`, `resolveAccess(email, deps)`. `app/` and components get little-to-no test.
- **PGlite** for a real in-process Postgres — exercises real SQL/transactions, no Docker.
- **No E2E / Playwright** unless a concrete flow later proves un-coverable more cheaply.
- Every ticket ships with a test.
