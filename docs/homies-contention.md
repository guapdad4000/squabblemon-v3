# Homies contention: isolated native PostgreSQL comparison

Recorded 2026-09-29 UTC. **No production load test, production database change, or deployment was performed.**

## Result

The original global-lock path caused material contention during a simultaneous menu reconnect, including delays to unrelated matches. At 250 simulated accounts:

- Homies reconnect latency p95: **3,933 ms → 584 ms** (85% lower).
- Normal, staggered Homies refresh p95: **35.45 ms → 5.64 ms**.
- Unrelated active-room polling p95: **2,657 ms → 8.18 ms**.
- Connection checkout p95: **2,500 ms → 255 ms**.
- No unexpected service errors in either run.

These are local service/database measurements, **not hosted HTTP latency or a promise that production supports 250 concurrent players**. The global social lock remains in place for social state and mutations; joined room access no longer needs it.

## Reproduce

From the repository root, with native PostgreSQL tools available:

```sh
env -u DATABASE_URL LOG_LEVEL=silent pnpm exec node scripts/test-payments-database.mjs \
  --social-load --label optimized --output scripts/results/homies-contention-optimized.json

env -u DATABASE_URL LOG_LEVEL=silent pnpm exec node scripts/test-api-database.mjs social
node --test scripts/homies-load-safety.test.mjs
pnpm --filter @workspace/api-server run typecheck
```

The load runner accepts `--players 25,100,250` and `--duration-seconds 35` (the defaults). `--label` labels evidence; it does **not** switch implementations. The checked-in baseline was captured **before** the runtime optimization, using the same workload and default arguments.

Evidence:

- [`../scripts/results/homies-contention-baseline.json`](../scripts/results/homies-contention-baseline.json)
- [`../scripts/results/homies-contention-optimized.json`](../scripts/results/homies-contention-optimized.json)

The wrapper refuses any caller-provided `DATABASE_URL`, even an empty or loopback URL. It initializes a fresh native PostgreSQL cluster on an ephemeral loopback port, pushes the schema only there, passes the owned URL to its child, and stops/removes the owned cluster afterward. No existing database, managed application workflow, or production service is a load target. Five safety tests verify refusal before PostgreSQL discovery and reject mixed test modes.

## Workload and measurement

- PostgreSQL **16.10**, Node **24.13.0**, 8 logical CPUs, approximately 16.8 GB host memory.
- One Node process, a pool of **50** native PostgreSQL connections, and `max_connections=100` on the disposable cluster. One pool lease is reserved for observation, leaving up to 49 service connections. This does not change the application's configured/default pool size.
- Three simultaneously leased connections must return distinct `pg_backend_pid()` values. The load and held-lock regressions use native `node-postgres`, not PGlite or a serialized database mock.
- Each seeded account starts with **20 homies and 10 terminal invitation receipts** (five outgoing and five incoming). Fixtures use real tables and legal decks.
- A synchronized menu reconnect occurs at the start. Subsequent menu refreshes use the real **10-second** visible-menu cadence with deterministic phase staggering. Battle accounts do not also poll Homies.
- Unrelated ordinary rooms poll at the client's actual **800 ms** active / **2 seconds** waiting cadences.
- The same 35-second scheduling window also exercises invitation creation/retries, accept vs remove, direct-code join vs block, accept vs direct join, crossed requests, and accept vs cancel. Social mutations include their separate committed throttle transaction. Other accounts exercise both durable throttle buckets.
- Operations call the actual service functions. Authentication middleware, HTTP transport, cold starts, browser rendering, and Internet/database network latency are not measured here.
- Latency starts at the **scheduled** request time and includes event-loop delay and pool checkout; work is scheduled independently of previous request completion. This avoids hiding backlog by reducing the offered rate when the server slows down.
- Connection checkout is timed separately. A dedicated connection samples `pg_stat_activity` and `pg_locks` every **100 ms**. The reported waiting-query ages include SQL execution time: they are **not exact per-request lock-acquisition durations**. Peaks can miss waits shorter than the sampling interval.
- Expected 404/409/429 outcomes and unexpected errors are reported separately. The race assertions verify receipt/member agreement, reserved-seat denial, idempotent retries, and persisted blocking. A differing race winner may cause one extra denial-verification request.

### Population and sample counts

“Accounts” includes the spare would-be guests for waiting rooms; it is not a count of simultaneous database connections.

| Accounts | Menu pollers | Active-room pollers | Waiting-room hosts | Spare guests | Calls before / after |
|---:|---:|---:|---:|---:|---:|
| 25 | 21 | 2 | 1 | 1 | 210 / 210 |
| 100 | 80 | 10 | 5 | 5 | 872 / 871 |
| 250 | 202 | 24 | 12 | 12 | 2,112 / 2,112 |

Observed completion rates were approximately **6.1 / 24.9 / 60.4 calls per second** at the three populations in both versions. Those are offered workload rates, not maximum throughput measurements.

## Latency results

All values below are **before → after**, in milliseconds.

| Accounts | Menu reconnect p50 / p95 / p99 | Staggered menu p95 | Active-room p95 / p99 | Waiting-room p95 |
|---:|---|---:|---|---:|
| 25 | 330 / 569 / 591 → 72 / 130 / 135 | 32.35 → 10.18 | 19.93 / 500.63 → 12.52 / 190.07 | 407.38 → 9.06 |
| 100 | 967 / 1,705 / 1,778 → 214 / 323 / 332 | 30.60 → 7.06 | 241.28 / 1,506.99 → 7.65 / 14.18 | 525.74 → 8.21 |
| 250 | 2,203 / 3,933 / 4,073 → 363 / 584 / 602 | 35.45 → 5.64 | 2,657.04 / 3,814.86 → 8.18 / 174.17 | 3,036.45 → 8.73 |

Staggered menus have 51 / 199 / 504 samples; active-room polls have 88 / 438 / 1,051 samples. Reconnect samples equal the menu-poller counts above. Full outcome-specific p50/p95/p99, maximums, scheduling lag, and sample counts are in the JSON.

### Mutation/race observations

The race workload is a correctness probe under competing traffic, not a large enough sample for statistically meaningful mutation percentiles. At 250 accounts:

| Successful operation | Samples per version | Largest observed latency before → after |
|---|---:|---:|
| Send invitation | 4 | 3,369.01 → 15.29 ms |
| Remove homie | 1 | 36.96 → 23.38 ms |
| Block player | 1 | 36.96 → 18.10 ms |
| Accept invitation during races | 2 | 16.95 → 16.64 ms |
| Direct-code join during races | 2 | 12.78 → 9.88 ms |

The invite's first request lands during the reconnect burst. Subsequent dependent race steps happen later, so their results must not be interpreted as uniformly burst-loaded requests.

## Lock waits and pool backlog

| Accounts | Checkout p95 before → after | Peak queued checkouts | Peak actual advisory waiters | Largest sampled waiting-query age | Samples observing advisory waits / total, before → after |
|---:|---:|---:|---:|---:|---|
| 25 | 12.87 → 9.94 ms | 0 → 0 | 20 → 4 | 481.20 → 87.56 ms | 8 / 345 → 1 / 345 |
| 100 | 125.62 → 35.69 ms | 32 → 20 | 48 → 48 | 1,096.94 → 164.94 ms | 21 / 349 → 3 / 348 |
| 250 | 2,499.69 → 255.19 ms | 156 → 140 | 48 → 48 | 1,153.30 → 172.00 ms | 94 / 349 → 7 / 349 |

The instantaneous peak remains 48 at the larger synchronized bursts because menus still serialize; the backlog drains much sooner. Bypassing the advisory lock does not reserve a database connection for battle traffic. At 250 accounts, an active-room request still reached 492 ms maximum while waiting for pool capacity. This remaining shared-pool effect is included, not hidden, in request latency.

## Implementation and safety

1. **Joined rooms bypass only the social lock.** `accessFriendRoom` reads a joined-seat hint, then rechecks the room after acquiring its row lock. All existing target/member authorization, command receipts, revision checks, deck validation, settlement, and invitation synchronization still run.
2. **Stale hints cannot open seats or invert lock order.** If both seats are no longer present, the transaction ends before retrying social-lock-first. No path waits for social while retaining the room row lock.
3. **Menu identity reads are batched.** Public identity fields are loaded together; lazy code allocation remains protected by the global social lock.
4. **Terminal receipts avoid room-by-room locking.** Their immutable status and room code are read together. Pending and accepted invitations still synchronize under room locks.
5. **Account/pair invariants stay serialized.** Friendship/block mutations, pending-seat eligibility, throttles, list/invitation limits, cooldowns, and invitation idempotency retain the existing global social lock. The profile row lock still coordinates ordinary room creation with targeted invitations at the five-room cap.

Ordered account locking was not necessary for this measured improvement. Retaining the existing mutation lock avoids introducing a new multi-account lock graph while the narrower change removes the observed unnecessary work.

## Verification

- Native PostgreSQL social + ordinary multiplayer + ranked suite: **21 passed, zero failures/skips**.
- New native regressions hold actual locks on independent connections to prove joined ordinary/targeted read, rejoin, and ready operations proceed without the global lock; unclaimed joins and social mutations still wait.
- Joined commands still wait for their room row; terminal receipt menus do not, while pending receipts do.
- A controlled stale-hint race proves the retry releases its room lock before waiting for social and rejects the now-unavailable seat.
- Existing third-party denial, orphan `invite_only` reservation, remove/block/join races, joined reconnect, stale request IDs, throttle, limits, and idempotency tests remain passing.
- The normal-room vs invitation race cannot exceed the five-room hosting limit.
- API TypeScript check and the five load-runner safety checks passed.
- The API workflow restarted cleanly; the mobile-size application preview rendered normally with no application console errors.

## Limits

One before/after run per population is comparative evidence, not a sustained-capacity or soak test. It covers populated but not maximum-size social lists, a terminal-heavy receipt history, a relatively small active-battle fraction, and a limited set of contested social pairs. Larger live-invitation histories, many distinct pairs mutating the same account, cold starts, multi-instance pool pressure, and hosted database round-trip time can change the result.

Do not increase production capacity promises based only on this report. Further hosted testing needs an explicitly authorized isolated target; production load testing still requires approval.

## Runtime diagnostics

Normal operation now has separate, default-off [Homies runtime diagnostics](homies-diagnostics.md).
They measure sampled service/checkout latency and client-observed social lock wait/hold
without an observer lease, statistics queries, additional transactions, or sensitive labels.
The runbook defines the sampling flag, strict per-category log limits, warning thresholds,
actions, privacy boundary, and native verification commands. These capped samples are
investigation signals, not replacements for the benchmark's latency distributions.