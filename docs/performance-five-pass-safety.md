# Five bounded performance passes: preserve player pacing

This main-based draft covers five areas. It accepts four runtime improvements
and adds loading/readiness regression coverage rather than forcing a fifth
runtime change. It is not an exhaustive claim that all possible optimizations
are found or a guarantee about untested devices.

No merge or deployment is included. No artwork bytes, visible quality, audio,
input timing, animation durations, preload policy, game rules, rewards, schema,
locks, durable patch delivery, private-data caching, or production settings are
changed by this draft.

## Pass 1: loading and navigation orchestration

**Decision: retain the existing behavior.** Image warming already shares
requests, limits active/pending work, waits for decoding, retries failures, and
changes its concurrency for active battles. Optional modules already share
in-flight requests and recover from failures. Navigation is synchronous except
for the intentional dirty-deck confirmation.

New lifecycle tests protect immediate warmup, the exact 8,000 ms timeout,
decode-before-ready, retry, one active battle warmup, the 64-job pending bound,
and immediate queued-work resumption on battle exit. Existing import/retry,
navigation, and scroll-memory tests are included in the focused command.

No new lazy loading, moved download, spinner, reduced preload, idle delay, or
different readiness gate was accepted.

## Pass 2: static catalog and card work

`elementalStandins` lazily retains the exact generated data URL for each of its
16 authored elemental portraits. The first request performs the same SVG
construction and encoding; subsequent calls reuse that string.

- All 16 complete data URLs are byte-identical to a frozen main reference.
- Importing the module generates nothing eagerly.
- 4,000 repeated requests: **4,000 SVG encodes → 0 after first use**.
- The cache is bounded to 16 public strings, 47,365 ASCII characters in total.
- The production `getCardImage` path and variant behavior remain identical.

No image file, compression, derivative, dimensions, or artwork content changes.

## Pass 3: battle presentation lifecycle

`BattleTargetLine` resolves its fixed SVG descendants once per selection effect
instead of querying them repeatedly on every frame. Geometry reads, DOM writes,
the 450 ms settling condition, clipping, listener order, and cleanup are
unchanged.

- Initial controlled settling: **145 selector queries → 3**.
- Both versions produce the same 29 sampled frames, ending at 464 ms in the
  16 ms fixture clock. The production duration was not changed to 464 ms.
- Complete repeated lifecycle: **605 selector queries → 9**.
- Path NodeList creation: **121 → 3**.
- At both 390 and 1440 fixture widths, 129 output snapshots and complete
  geometry/write/frame/event/observer traces match the frozen reference.
- Hidden, clipped, missing-source, selection replacement, remount, and unmount
  paths are checked.

These are deterministic React/host-fixture measurements, not real browser FPS.
An optional real-browser harness is included but did not run successfully here.

## Pass 4: API and database-adjacent work

`getSocialRecords` still issues the same queries with the same SQL, parameters,
ordering, visibility rules, and fresh request data. Request-local totals avoid
revisiting the entire room history separately for every visible player.

- 5,000 rooms / 100 players: **2,005,000 membership field reads → 10,000**.
- Zero visible players retain the original single self tally.
- One- and two-player fixtures also reduce membership reads.
- Complete JSON, 401/403 errors, no-store headers, two-way blocks, missing
  identities, legacy/malformed record arithmetic, host-seat precedence,
  freshness after room/block changes, and unchanged economy data are checked.
- Seven focused tests pass against an owned disposable PGlite database, with no
  skipped tests. No production database or load test is used.

## Pass 5: integration, regression, and safe residual work

The notification provider repeatedly searched the static catalog while building
fresh ownership notices. It now uses the existing exact card-ID index and
lazily reuses successful variant lookups.

Variant first-use performs the original search, without building an index for
unrelated variants. Unknown IDs are not cached. At most the 912 authored
variants can be retained. Notices and all player ownership remain live and are
rebuilt on each call.

- Exact ordered output across 165 ownership/cosmetic profiles, including
  duplicates, unknown/prototype-like IDs, reverse ordering, and empty data.
- Repeated full fixture: **348,148 linear catalog predicates → 0** for identical
  **2,170 notices** (301 cards, 912 variants, 829 cosmetic strings).
- A cold sparse variant lookup performs the same predicate count as baseline.
- Calls after in-place ownership changes immediately reflect current data.
- Returned arrays and notices remain fresh and independently mutable.

The complete draft is also checked in a temporary integration checkout with
drafts #14, #15, and #16. This is a local compatibility exercise only; this PR
does not include their production changes or depend on merging them first.
Both movie components in this combined check were restored byte-for-byte to main:
PR #14's click-deferred chapter download and decorative-video lifecycle changes
were excluded because they could change first-play or resume pacing. The correction
is handled on PR #14 itself, not counted as another optimization here.

## Verification

- New draft focused client command: **25 tests pass**.
- Independent review reran those 25 tests and four pure social parity tests;
  all frozen references were checked against main.
- Shared-library, frontend, and API typechecks pass.
- Frontend production build and unchanged entry budgets pass: public entry
  212.7 / 475 KiB, GameApp 894.9 / 900 KiB, Home 969.5 / 1200 KiB.
- API and Netlify-function builds and bundled health, anonymous-access, and
  configuration smoke checks pass.
- Combined draft fixture run: **77 client tests and 68 database tests pass**,
  with zero skips. Database coverage includes profile normalization, bootstrap,
  collection races, campaign progression, immutable rewards, idempotency, and
  concurrent catch-up. This is not a full campaign marathon.
- The broader battle suite remains **254 / 257 passing**. The same two absent
  sparse media/reference fixtures and unchanged Earth count assertion (34 vs
  33) fail. No expectations or budgets were weakened.
- The aggregate scripts typecheck still reports the existing errors in
  `scripts/src/rivalry-online-audit.ts:19` and
  `scripts/src/rivalry-online-model.test.ts:36`; both files are untouched.

## Repeat checks

With the repository's Node 24 and installed pnpm toolchain:

```sh
pnpm --filter @workspace/squabblemon test:safe-passes
pnpm test:campaign:db
pnpm run typecheck:libs
pnpm --filter @workspace/squabblemon typecheck
pnpm --filter @workspace/api-server typecheck
PORT=5173 BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/squabblemon build
pnpm --filter @workspace/api-server build
node scripts/build-netlify-function.mjs
node scripts/check-netlify-function.mjs
```

The guarded database runner discovers the new social-record suite
automatically. Leave `DATABASE_URL` unset for its owned disposable database.
Never point these seeded fixtures at production. The optional browser command
is `pnpm --filter @workspace/squabblemon test:target-line-browser`.

## Release gates and intentionally deferred work

- Actual browser/mobile visual smoothness, touch and keyboard play, audio
  onset, and cold/warm playback are **not verified**. Local Chromium launch
  failed with a socket permission error. The supported cloud browser could not
  reach the executor's loopback fixture server. No denied permission was
  bypassed. Deterministic host tests are not a substitute for device QA.
- The local pnpm wrapper attempted an automatic install and failed before
  running scripts. Checks were run with the already-installed Node binaries
  and the same arguments. The test-only renderer versions match drafts #15
  and #16. Frozen lockfile verification passed the cached supply-chain policy
  check. No clean dependency reinstall is claimed; no runtime dependency is added.
- Disposable database startup used a temporary harness with the existing
  ownership token/local-target guards, a longer startup allowance, and the
  Node tsx loader. The canonical safety guards were not weakened.
- Full media-integrity and authenticated release playthrough gates are not
  established by the sparse checkout. Previous full-campaign solver-budget
  failures are not declared fixed by this draft.
- Responsive art, persistent unversioned-media caching, new lazy-loading
  policies, social observer cadence changes, and durable delivery redesign
  remain excluded without their own evidence and failure-mode tests.
- Keep all drafts unmerged until review and preview/device QA establish the
  user's no-negative-gameplay and no-weird-loading requirement.
