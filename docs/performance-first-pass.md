# Performance first pass

This change reduces repeated work without changing game rules, reward authority,
artwork, sound definitions, or the timing resolution of active arcade controls.
It is independent of PR #14 (multiplayer polling and deferred media loading).
No production configuration, database schema, scheduled delivery, or social-lock
changes are included.

## Implementation

- Arcade cabinet clocks are consumed only by the active Girl Fight timing
  controls and Waffle Run hopping controls, at the existing 120 ms and 150 ms
  resolutions. Server clock offsets and daily reset refreshes remain in effect.
  Active subscriptions keep the cabinet's original sampling grid after off-grid
  server responses. Reset refreshes use an independent deadline timer and
  visibility catch-up.
- Story dialogue is parsed once per authored text. Character state and its
  18 ms timer live below the scene, keeping the backdrop, portraits, environment
  props, and scene metadata out of character updates. The same formatter remains
  available to transcript views.
- Waffle Run owns one reusable audio context. Each sound still owns independent
  square-wave oscillators and a gain of 0.025, with the existing frequencies and
  note schedule. Gestures unlock/resume the context; ended or expired voices
  disconnect. Cabinet cleanup lets an already-started sound finish at its
  existing bounded cutoff, then closes its detached context.
- GET bootstrap initializes the player once, delivers late patch mail, then
  serializes freshly read state. The regular `getPlayerBootstrap` entry point
  still initializes for all existing callers. Profile PATCH and mission claims
  initialize before mutation without constructing a discarded response; their
  post-mutation bootstrap safeguards and profile locks remain.
- Collection-road status reads only exact canonical road milestone IDs from the
  receipt ledger. Account rewards project level, creation time, and the
  `growthDaily` JSON subtree rather than the full profile. The prior practice
  query keeps both fields actually consumed: rival deck ID and the previous
  player's engine-card IDs.

## Repeating focused checks

From the workspace root:

```sh
pnpm --filter @workspace/squabblemon test:render-work
pnpm test:performance:db
pnpm run typecheck:libs
pnpm --filter @workspace/squabblemon typecheck
pnpm --filter @workspace/api-server typecheck
PORT=5173 BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/squabblemon build
pnpm --filter @workspace/api-server build
node scripts/build-netlify-function.mjs
node scripts/check-netlify-function.mjs
```

The database command uses the existing guarded disposable-database runner when
`DATABASE_URL` is unset. It must not be pointed at production. The React tests use
real React components with controlled clocks and browser inputs; they do not
claim to exercise a browser's rendering pipeline or an actual audio device.

## Measured work

Paired deterministic StoryStage runs used the same 62-character dialogue and
18 ms clock. The before/after host-tree snapshots matched at the initial state
and every character step. Both versions performed 62 character commits:

| Work | Before | After |
| --- | ---: | ---: |
| Full-text tokenizer calls at mount | 3 | 1 |
| Full-text tokenizer calls during reveal | 124 | 0 |
| World/header/cast/location/speaker prop recreation, each | 62 | 0 |

Paired six-second arcade fixtures used the exact historical source and the same
fake clock. Their final host-tree snapshots matched:

| Work over six seconds | Before | After |
| --- | ---: | ---: |
| Girl Fight full-cabinet updates | 50 | 0 |
| Active Girl Fight timing-widget updates | 50 | 50 |
| Waffle Run full-cabinet updates | 40 | 0 |
| Active Waffle Run plate-control updates | 40 | 40 |

Real HTTP requests against equivalent seeded accounts in an owned disposable
PGlite database produced the following SQL counts. Counts include transaction
statements; they are fixture-specific, not production latency measurements.

| Work per request | Before | After |
| --- | ---: | ---: |
| GET bootstrap SQL statements | 27 | 16 |
| GET bootstrap transactions | 4 | 2 |
| GET bootstrap receipt-recovery passes | 2 | 1 |
| Profile PATCH SQL statements | 35 | 31 |
| Mission claim SQL statements | 37 | 33 |
| Account-reward profile fields selected | 37 | 3 |

The before/after seeded bootstrap payloads were deeply equal after excluding the
account ID and dynamic `lastActiveAt`/mission `resetAt` values. PATCH and mission
claim retain both recovery passes, but no longer serialize a discarded
pre-mutation response. A mixed ledger with 502 rows returned the one exact road
milestone rather than all 502 rows; unrelated and road-like suffix IDs remain
excluded, and receipt contents/idempotency are unchanged.

These measure React/parser and database work, not FPS, browser paint, battery,
hosting cost, or production latency. The tests also cover complete-line versus
advance behavior, rapid-input rejection, pending saves, navigation/replay,
callback replacement, and reduced motion.

## Local verification

- 35 focused client tests pass, including all existing StoryStage checks.
  Existing arcade, Waffle Run, and arcade-polish rule tests also pass.
- 52 database-backed tests pass with no skips, including seven new performance
  regressions and existing reward, collection, profile, cadence-race, activity,
  economy-rollout, and first-collection checks. The local runner used a longer
  disposable-PGlite startup allowance and Node's `--import tsx` loader because
  this executor blocks the tsx CLI's Unix IPC socket.
- Shared-library, frontend, and API TypeScript checks pass.
- Frontend Vite build and entry-bundle budgets pass. Public entry: 212.6 KiB /
  475 KiB; GameApp: 894.7 KiB / 900 KiB; Home: 969.2 KiB / 1200 KiB.
- API build and bundled function health/anonymous-access/configuration smoke
  checks pass. These smoke checks use fixture configuration, not a live checkout
  or production database.
- Independent code review found and verified fixes for sampling-phase parity,
  audio exit tails, and test teardown. No unresolved correctness finding remains.
- The broader battle command reports 254 passing tests and three failures:
  two require media/reference fixtures absent from the sparse checkout, and the
  unchanged Earth-card-count assertion expects 33 where main has 34.
- Aggregate workspace typechecking remains blocked by existing errors in
  `scripts/src/rivalry-online-audit.ts` and
  `scripts/src/rivalry-online-model.test.ts`; app/API checks pass independently.

## Release verification still required

Before merging or deploying, run a real preview playthrough on desktop and mobile:

- Girl Fight watch/input/deadline transitions, off-grid server responses, help
  overlays, hidden/resumed tabs, retry paths, and daily reset.
- Waffle hop lockout, watched plates, phase transitions, overlapping sounds,
  mute/unmute, first gesture, Safari interruption/resume, and leaving/reopening.
- Story formatting, character reveal, complete/next/skip, replay, reduced motion,
  and real keyboard/touch behavior.

No browser FPS improvement or financial savings is claimed. Do not merge or
deploy the draft solely on the deterministic checks.
