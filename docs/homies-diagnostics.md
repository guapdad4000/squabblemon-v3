# Homies runtime diagnostics

These opt-in, server-side measurements help distinguish a busy connection pool
from time spent waiting for or holding the global social lock. They do not create
traffic, open an observer connection, query PostgreSQL statistics, or change a
request's transaction or lock sequence.

## Enable and disable

Set **`HOMIES_DIAGNOSTICS_SAMPLE_RATE`** on the **server runtime**:

| Value | Behavior |
|---|---|
| Unset, blank, `0`, invalid, or outside `0`–`1` | Disabled; the pool's checkout method is not wrapped. |
| `0.05` | Randomly select 5% of service operations before their first checkout. A useful starting point. |
| `1` | Measure every covered operation, still subject to the log limits below. Useful for a short investigation. |

The value is read once at process startup. Restart the local API after changing
it. For the existing Netlify deployment, use a function-runtime environment
variable and a new deployment; a `netlify.toml` build variable is not sufficient.
Nothing in this change enables or deploys diagnostics in production.

Filter structured API logs by **`event = "homies_diagnostic"`**. Keep `LOG_LEVEL`
at `info` to see both normal and warning samples, or `warn` for warnings only.
`error`/`silent` hide these records. No metrics endpoint, external collector, or
alert delivery service is added.

## What is measured

Each selected operation produces at most one completion record, using a
monotonic clock. Records contain only fixed labels, a sampling rate, numeric
timings/counts, and fixed warning names. The singleton logger deliberately avoids
request-bound properties. There are **no player IDs, friend/room codes, request
IDs, URLs, credentials, SQL, error messages, or request/response payloads** in
diagnostic records. Existing general-purpose HTTP logging is separate.

| Category | Covered service work |
|---|---|
| `menu_refresh` | `getSocialState`, including identity allocation and receipt synchronization. |
| `social_read` | Exact friend lookup and invitation reads. |
| `social_write` | Relationship mutations, invitation sends, and invitation responses. |
| `social_throttle` | The existing separately committed lookup/mutation throttle transaction. |
| `joined_room` | Room reads, rejoining, and commands that bypass social after rechecking both seats under the room row lock. |
| `unclaimed_room` | Room access requiring social-first locking, including a stale-hint retry. |
| `room_access` | Room operations that fail before the lock path can be confirmed, such as a checkout failure. |

`operation` is also a fixed allowlist: menu refresh, lookup, lookup/mutation
throttle, relationship write, invitation send/read/write, and room read/join/command.
It never contains the dynamic action, code, identifier, or command payload.

| Fields | Meaning |
|---|---|
| `operationMs` | Service entry through return/rejection, **including connection checkout**, transaction completion, and any existing stale-hint retry. Excludes HTTP/authentication/response serialization. |
| `transactions`, `retries` | Existing transaction attempts and stale-hint retries. An ordinary covered call uses one transaction; a stale hint can use two. No additional transaction is opened for measurement. |
| `checkoutCount`, `checkoutErrors` | Checkout attempts and failed checkouts, including timeouts. |
| `checkoutTotalMs`, `checkoutMaxMs` | Time from calling the pool's original `connect` to receiving a client/error. Includes pool queueing and connection establishment, but **not `BEGIN`**. |
| `poolWaitingPeak` | Maximum queue depth observed just before/after enqueue and at checkout completion. Not a continuous gauge or a promise to capture the true queue peak. |
| `socialLockAttempts`, `socialLockAcquired` | Advisory lock query attempts and successful acknowledgements. Both remain zero for the joined-room fast path. |
| `socialLockWaitTotalMs`, `socialLockWaitMaxMs` | Client-observed duration of the existing advisory lock SQL, including a failed attempt. Includes network/query overhead, not solely PostgreSQL's internal lock wait. |
| `socialLockHoldTotalMs`, `socialLockHoldMaxMs` | Successful lock acknowledgement through settlement of the **whole** transaction, including `COMMIT`/`ROLLBACK` and client release. Not just the transaction callback. Failed acquisition contributes no hold time. |
| `outcome` | `ok`, `rejected` (an application 4xx), or `error`. No thrown value is serialized. A rejected command may intentionally commit lifecycle updates, as before. |

The throttle and subsequent social operation are **separate samples** because
they are separate service calls and transactions. Their `operationMs` is not a
whole-route latency; do not add independent samples or their percentiles.
Other services sharing the pool (including room creation/listing, reactions,
ranked lobby searches, and unrelated profile/payment operations) are not
individually sampled. Their pool pressure still appears in covered checkout time.

## Warning thresholds and response

Thresholds are inclusive, in milliseconds, and apply to each **selected**
completion. A record may list multiple warnings.

| Warning | Threshold | What to do |
|---|---:|---|
| `checkout` | Any checkout ≥ **100 ms** | Check shared-pool pressure, reconnect timing, and database connection limits across instances. Slow joined-room work with zero social lock attempts is a useful indicator. Do not blindly raise the per-process pool maximum. |
| `social_lock_wait` | Any social acquisition attempt ≥ **100 ms** | Compare lock-hold warnings. Long holds suggest expensive work inside the critical section; short holds with repeated waits suggest too many serialized refreshes/writes. Check polling/reconnect patterns before changing lock semantics. |
| `social_lock_hold` | Any social hold ≥ **100 ms** | Investigate the reported operation's database round trips, live invitation synchronization, and row/profile lock waits while it owns social. Preserve social-before-room/profile ordering when optimizing. |
| `operation` | Joined room ≥ **400 ms**; other categories ≥ **750 ms** | Compare checkout and social timings first. If they are low, investigate room-row contention, query latency, and server processing. |

The joined-room threshold is half the active-room client's 800 ms polling
cadence; other thresholds flag sub-second delays before they become multi-second
queues. These are initial investigation budgets, **not hosted performance
guarantees, timeouts, or automatic retry/scale triggers**. Repeated warnings in
successive process windows warrant investigation. One reconnect burst alone does
not establish sustained capacity failure.

## Bounded cost and failure behavior

- Sampling occurs **once**, at service entry. Disabled/unselected calls do not
  allocate a timing sample, call the clock, or open an async timing scope.
- Seven fixed categories each permit **two normal and two warning records per
  60-second rate-limit window** (at most 28 records per process per set of
  category windows). Healthy samples cannot spend the warning budget.
- Additional selected completions increment only scalar `suppressedNormal` or
  `suppressedWarnings` counters. The next emitted record in that category carries
  those counts since its preceding emitted record. There is no per-request buffer,
  timer, periodic SQL, log retry queue, or background flush.
- Logger/clock/sampler failures cannot replace an operation's result or error,
  prevent commit/rollback/release, or cause it to run again. A failed log write
  still spends its rate budget. Pool promise and callback overloads preserve the
  original clients, errors, and release functions.
- Logs are best-effort completion diagnostics. A stuck operation is not reported
  until it settles. Process restart loses suppression counters; a short-lived
  serverless instance may never report its suppressed tail. Limits are
  **per process**, not a deployment-wide cap.
- Sampling plus rate suppression biases the emitted records. **Do not compute
  production p95/p99, request/error rates, or player capacity from these logs.**
  Use the isolated benchmark for controlled comparisons, and a separately
  approved aggregate metrics/alerting system for continuous SLO monitoring.

## Verify without production traffic

```sh
pnpm --filter @workspace/api-server exec tsx --test \
  src/lib/homiesDiagnosticsReporter.test.ts \
  src/lib/homiesDiagnostics.test.ts \
  src/lib/homiesPoolDiagnostics.test.ts

env -u DATABASE_URL LOG_LEVEL=silent pnpm exec node scripts/test-api-database.mjs social
node --test scripts/homies-load-safety.test.mjs
pnpm run typecheck:libs
pnpm --filter @workspace/api-server run typecheck
```

The guarded social runner enables a sample rate of `1` in its child processes
and runs **all existing social, ordinary multiplayer, and ranked concurrency
tests unchanged**, plus native diagnostics regressions. It still requires its
own temporary native PostgreSQL cluster with independent connections, refuses
any inherited `DATABASE_URL`, and never targets production.

Unit tests exercise default-off/sampling, overlapping operation isolation,
callback/promise checkout behavior, commit/rollback timing, privacy, failures,
and warning/rate budgets. Native tests hold real pool/advisory locks and confirm
the observed waits, unchanged SQL/transaction boundaries, and joined-room bypass.
The original [contention benchmark](homies-contention.md) remains separate: its
unbounded sample arrays and reserved PostgreSQL observer are **not** used by
normal server diagnostics.

Verified locally on 2026-09-29: **21 diagnostic unit tests**, **25 native
social/multiplayer/ranked tests**, and **5 load-target safety tests** passed,
with no native failures or skips. The API TypeScript check and workflow startup
passed, and the mobile-size application preview rendered normally. No
production traffic, production settings change, or deployment was performed.