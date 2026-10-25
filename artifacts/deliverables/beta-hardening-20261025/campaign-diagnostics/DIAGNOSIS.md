# Campaign verification diagnosis

The initial broad and focused runs completed with failures; neither is a passing release result. They overlapped CPU-heavy matrix/stress/parity work and browser tests.

- Broad embedded database run: 373 passed,6 failed,1 skipped (513.0s). Failures: obsolete renamed native test path, native-ranked ownership guard, PGlite feedback late commandComplete event, two campaign solver wall-clock limits, and stale monthly ticket-balance assertion. The skipped case specifically requires native independent connections. This broad scanner is not the new required fast release gate and is not valid substitute evidence for dedicated native modes.
- Focused campaign + solver run:9 passed,2 failed (124.4s). Baby Momma's Truth exhausted10s at18,020 expansions; Dead Air Soundcheck exhausted10s at13,792 expansions. Both remained below the40,000 expansion ceiling. Contention is a candidate cause, not yet established; isolated rerun awaits the parent matrix quiet window. No budget or engine change was made.
- styleShardTransactions.test.ts was corrected for current separate monthly rewards. It explicitly checks60 normal pack slots,5/10 milestones (+100Clout,+1ticket), matching retry receipts, one opening/two claims, ticket debit20−10+1=11, and exact currency/shard balances. All4 cases passed on fresh owned native PostgreSQL (799ms test runtime). Temporary runner was a path-corrected copy of the guarded native harness selecting only this test; no production/release-manifest changes.

No production database or deployment was used.

## Uncontended confirmation

The isolated fresh PGlite campaign+solver run failed9/11 after83.1s. Baby Momma's Truth reached the unchanged10s limit at28,968 expansions. Dead Air Soundcheck exhausted all existing beam policies in8.1s without finding a win. Contention is therefore insufficient to explain these failures. This does not prove either encounter is unwinnable.

A temporary solver probe using canonical legal play intents (without increasing limits or changing the engine) found a verified Dead Air win in2.9s/5,528 expansions. Its early transformed Wifey line was excluded by the legacy strongest-base-power SQUABBLE filter. Baby Momma's Truth still needs bounded search work; no passing campaign result is claimed.

## Solver correction and scope

The QA-only helper now enumerates shared legal play intents (including exact investment/SQUABBLE), retains complete mutable rule state in deduplication, and reuses exact immutable transitions across bounded beam attempts. `nextEventSequence` remains in the key because current effects use it as a deterministic seed; only event-log payloads, presentation notes and immutable per-solve inputs are omitted. An independent source review caught and verified this distinction. A second generic district-control score uses diminishing returns to preserve alternatives against conditional comeback abilities.

All12 focused solver regressions passed in21.8s. Dead Air took3.55s and Baby Momma's Truth4.37s. The unchanged ceilings are10,000ms and40,000 actual simulated player transitions per node, shared across every policy attempt. The full account/campaign command is still pending at this update.

This is a bounded test search, not live CPU policy, an exhaustive solver, or a human-difficulty claim. Its existing four-action per-turn search and initially captured round-limit bounds remain; neither a failed search nor a passing fixed-roster campaign establishes all possible decks/After Party extension scenarios. Every returned victory is replayed through the normal transcript verifier.

## Broad-run failure classification

- Native-ranked ownership rejection and the native-only flexible-pull skip are dispatcher mismatches already present at the recorded HEAD (the baseline dispatcher included those files despite their native guards). They now map explicitly to maintained fresh-native commands.
- Feedback's PGlite late `commandComplete` failure is not labeled pre-existing or a production regression without equivalent baseline evidence. Its dedicated fresh-native suite must pass independently.
- The missing online-retirement filename was the broad scan racing our `.native.test.ts` rename. The current file exists and its native suite passed19/19; no missing runtime dependency remains.
- The stale monthly ticket assertion exists at HEAD; the corrected test verifies the exact additional milestone receipt, never a relaxed count. Native4/4 passed.
- The isolated campaign/Dead Air failures are real current-policy QA regressions exposed under v64, now addressed by the helper changes above; the original failed logs are retained. No old-engine campaign pass is inferred.

The dispatcher now reports each required native command; unknown `.native.test.ts` files fail closed. Generic mail tests remain in the embedded tier, while the complete owned-mail suite is separately inventoried. No blanket green release claim follows from this partition.

## Corrected campaign result

The full fresh-account campaign HTTP journey and all solver regressions passed13/13 with zero skips in201.5s. The complete account/campaign case took168.8s and retained every existing progression, server-issued snapshot, dialogue gating, cross-account isolation and idempotent reward assertion. Exact command: `env -u DATABASE_URL npm_execpath=<installed pnpm CLI> /usr/bin/node scripts/test-api-database.mjs campaign`. The suite created and removed its own local PGlite database. See `campaign-corrected.log`.

The broader embedded tier and full native event-feedback suite still await final execution; the campaign pass does not replace either.

## Changed QA files

- `artifacts/api-server/src/lib/storyMoveSolver.ts` — canonical legal intents, full mutable state identity including seeded event counter, exact immutable transition caches and generic alternative district-control scoring.
- `artifacts/api-server/src/lib/storyMoveSolver.test.ts` — exact investment replay, formerly pruned utility form, comeback-aware encounter and trap/seed identity coverage.
- `artifacts/api-server/src/lib/styleShardTransactions.test.ts` — exact ten-pull slots plus separately receipted monthly milestones.
- `scripts/database-test-tiers.mjs`, `scripts/database-test-tiers.test.mjs`, `scripts/require-db-tests.mjs` — explicit native tier mapping and fail-closed inventory. Partition tests passed2/2 and are included in the required release gate by the release agent.

No engine/rules/card-balance/simulation manifest changes were made for this campaign correction.

## Native feedback/patch result

The maintained full native runner passed12/12 with zero skips (23.2s test runtime). It also verified8 applied-history fixtures,9 forward migrations, rollback, retry and schema reconciliation preserving balances and identities. Exact command: `env -u DATABASE_URL npm_execpath=<installed pnpm CLI> /usr/bin/node scripts/test-events-feedback-database.mjs`. Its fresh owned PostgreSQL cluster was stopped and removed. See `event-feedback-native.log`.

The earlier late PGlite `commandComplete` error did not reproduce on the maintained native target. That original failure remains recorded as a harness/protocol failure, not retroactively marked passed or claimed to prove a production defect. The test is now explicitly routed to the native tier with its concurrent connection/migration requirements.

## Final embedded result

The complete embedded-compatible tier passed365/365, zero failures, cancellations or skips, in553.797s. This includes the full fresh-account campaign and all canonical solver regressions under the unchanged10s/40k per-node ceilings. Exact command: `env -u DATABASE_URL npm_execpath=<installed pnpm CLI> /usr/bin/node scripts/test-api-database.mjs`. The guarded runner created and removed its own local PGlite database. See `embedded-final.log`.

This result covers the explicitly enumerated embedded tier; the printed native requirements remain separate. The original failed broad run is preserved and is not retroactively called passed. Native social authorization/locking validation is running separately as the last applicable check.

## Final native social result and disposition

The fresh native social tier passed35/35 with zero failures, cancellations or skips in20.986s. Exact command: `env -u DATABASE_URL npm_execpath=<installed pnpm CLI> /usr/bin/node scripts/test-payments-database.mjs --social`. It covers the maintained social/online authorization and transaction tests plus authenticated native Homies routes, profile cascades and migration parity. Its owned PostgreSQL cluster was stopped and removed. See `social-native-final.log`.

All applicable corrected checks recorded here are complete: full embedded365/365, focused campaign+solver13/13, focused solver12/12, native feedback/patch12/12, native social35/35, native style shards4/4, partition2/2, and API TypeScript exit0. These counts overlap; they are not added into a unique total. Source hashes were reverified after completion. Unchanged mail was not rerun in this scope. Earlier failures and their exact classifications remain above and in preserved logs; none is relabeled as a pass. These are local isolated test results, not production, real-player or exhaustive strategy evidence.
