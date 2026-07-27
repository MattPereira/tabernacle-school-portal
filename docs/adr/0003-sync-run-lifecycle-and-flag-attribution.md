# ADR-0003: A sync run is a lifecycle, and every flag is attributed to the run that set it

**Status:** Accepted in part (2026-07-24); flag attribution superseded by [ADR-0005](0005-facts-derived-identity.md) (2026-07-27)

The sync-run lifecycle remains accepted. ADR-0005 removes flag clearing and `flagged_by_run_id`: without an admin queue, attribution has no consumer. Inactive flags remain, clear automatically when rows reappear, and never affect access.
**Issue:** [#20](https://github.com/MattPereira/tabernacle-school-portal/issues/20) (admin screen), realising the "clear a run's flags" escape hatch that makes [ADR-0001](0001-identity-link-table.md)'s no-`<50%`-guard sync safe rather than a gamble.

## Context

Sync uses **flag-don't-revoke**: a record that leaves the FACTS active set is marked `inactive`, never deleted (ADR-0001, `sync()`). Sync ships without a sanity guard, so a bad FACTS pull (a truncated page, a bad filter) can flag a large number of people at once. That is only cheap if the admin can undo a bad run's flags **wholesale** — "this run obviously misfired, clear what *it* flagged" — rather than one row at a time (#20).

To clear "*that* run's flags" the model has to know **which run flagged each row**, and it didn't: `flagMissing` set `inactive:true` and nothing else, and `sync_run` stored only counts. Worse, the run id wasn't available when flagging happened — the `sync_run` row was minted *after* the mirror transaction committed, deliberately, so that a failed run still left evidence behind.

## Decision

1. **A flagged mirror row records the run that flagged it.** Every mirrored table carries `flagged_by_run_id` (nullable) alongside `inactive`/`last_seen_at`. `flagMissing` stamps it with the current run's id; the "seen again" path clears it back to null with `inactive`. Clearing a run's flags is then one predicate — `flagged_by_run_id = :runId` — across all three mirror tables.

2. **The run id is minted at the *start* of the run, not after.** `sync_run` is inserted when the run begins, so its id exists inside the mirror transaction where flagging happens — attribution is **atomic**: a flagged row provably carries its run, never best-effort. The row is finalized (outcome, `finished_at`, counts) when the run ends. This **reverses** the previous "insert after the committed transaction" stance.

3. **A run therefore has a lifecycle, and `outcome`/`finished_at` are nullable.** Null = started but not yet finished — including a run that **crashed mid-flight**. `latestSyncRun` still orders by monotonic `id`, so an in-flight/crashed run is legibly the latest one. This reopens ADR/​schema's "there are exactly two outcomes" note: the two *terminal* outcomes (`applied` | `failed`) are unchanged; "in flight" is the absence of one, not a third enum value.

4. **No foreign key on `flagged_by_run_id`.** Consistent with the mirror's deliberate no-FK philosophy (a FACTS data wart must never abort a sync) and with `identity_link.facts_person_id` — a plain nullable int, not a DB-level FK.

## Consequences

- The admin screen can list flagged people **with the run that flagged them**, and clear a run's flags in one action — the escape hatch ADR-0001 leaned on.
- A crash now leaves a **visible half-run** (`outcome` null) instead of no record at all — strictly more evidence than before, at the cost of readers having to treat null outcome as "unfinished/crashed."
- Rows flagged before this change (migration backfill) have `flagged_by_run_id = null`: unattributed, so the per-run clear can't cover them until a fresh run re-flags them. Harmless — they're still visible as `inactive`, and any healthy re-run un-flags them automatically.

## Alternatives rejected

- **Stamp the run id *after* the transaction commits** (keep `sync_run` exactly as-is, insert post-tx, then a second update stamps the flagged rows). Attribution becomes best-effort: a crash in the window between commit and stamp leaves an orphan flagged row with no run id. Within the flag-don't-revoke safety envelope, but it makes "with the run that flagged them" a promise the model can't always keep — so we paid the larger change for the guarantee.
- **Discriminate flags by timestamp** instead of run id. Rejected for the same reason `latestSyncRun` already distrusts timestamps: only `id` is monotonic; two runs in the same second would collide.
