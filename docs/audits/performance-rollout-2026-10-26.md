# Performance rollout — 2026-10-26

Baseline: `9c3e3d48`, building on the replay-retention/compact decoder fixes.

## Changes

- Production `ONLINE_COMPACT_REPLAY=1` was deployed on `9c3e3d48`. Read-only
  inspection subsequently found 17 compact rooms and 140 pruned rooms. Rollback
  to a pre-decoder API requires expanding all compact archives first; disabling
  writes alone is not sufficient.
- Room-list and open-count reads prefer the small trigger-maintained live
  projection, with a legacy fallback. Authorization and response shapes remain.
- Settled bootstrap: 8 SQL statements, no transaction, lock or write (previous
  fixture: 12 statements and a profile lock). Semantic JSON comparison fixes
  repeated normalization writes caused by PostgreSQL jsonb object-key ordering.
  Drift still goes through locked recovery; pack receipts, missions and rewards
  retain their existing response contract. Bootstrap safety refresh is five
  minutes, with a stale-only foreground refresh.
- Functions are minified with names retained; unused database drivers and insert
  validators are tree-shaken. No runtime dependencies are externalized. Pool
  maximum stays five, with idle connections allowed to let the process exit.
- Active gameplay stays at 800 ms. Reaction refresh follows match-token changes,
  with a 10 s safety poll (2 s for legacy rooms without tokens). Queue heartbeat
  becomes 2 s; menu checks become 60 s. Hidden/offline behavior is retained.
- Service-worker art entries above 2 MiB and unsized GIF responses are not cached;
  media/range requests bypass it. Cache namespace advances to `sq-v4`.
- Home loads scene-only catalog/portraits when the scene is ready and voice code
  on use. Four independently scoped stylesheets remain owned by lazy components;
  shared/overlapping rules retain their established cascade order.
- Story/Move Studio check the existing authenticated admin endpoint before
  loading their editor modules. No public environment variable grants access.

## Media

Playback duration, frame cadence, aspect and encoded audio are preserved. No
artwork is substituted. H.264 CRF 21 special-move delivery sources are at most
540 px wide; battle derivatives are exact-even-aspect CRF 22, at most 320 px.
The saved quality reports measured 0.9795 minimum / 0.9868 mean SSIM for 219
special-move encodes against originals resized to the same delivery resolution.
This metric is not a claim of pixel identity or physical-device visual parity.
The other 24 film encodes measured minimum 0.9803 / mean 0.9827 SSIM.

135 PNGs are optimized losslessly: all decoded RGBA pixels and dimensions were
compared to Git originals. They save 38,139,695 bytes. Special moves save
207,603,315 bytes; films save 31,343,370 bytes. Replacing 215 superseded battle
derivatives saves 55,972,991 bytes. Total checked-in media reduction is
333,059,371 bytes (about 318 MiB). Superseded content-addressed derivatives were
removed only after checking current source/build/public references. Runtime
manifests and revisions select the new derivatives. The promotion video remains
conditional on visibility/motion preferences with metadata-only preload.

## Verification

- Integrated API/frontend typechecks passed.
- API bundle health/authentication/webhook/deploy-hook checks passed.
- Bootstrap/reward database suite: 49 passed.
- Native online/retention/reward-route database suite: 25 passed, compact writes on.
- Polling/notification tests: 23 passed. Service worker: 20 passed.
- Media/artwork tests: 32 passed; all 224 battle-media entries passed manifest,
  timing, frame/audio integrity checks (nine retain original geometry).
- Full Node 24 release build passed at `df04fc67`, including required suites,
  Vite, migration staging, CSS invalidation and bundle ceilings. Home static
  closure is 710.9 KiB (baseline about 956 KiB); GameApp CSS is 494,990 bytes
  (baseline 504,645). Shared CSS remains the large majority of that stylesheet.
- Function output bytes: API 3,388,853; Kumite 504,186; patch delivery 222,910;
  deploy check 219,305; replay retention 213,915. Previous output total was about
  12.8 MB; current total about 4.55 MB. These are raw bundle measurements.
- Chromium development-shell checks at 390×844 and 1440×960 loaded the lazy
  Safehouse crew/portraits without runtime errors or horizontal overflow, using
  disposable-auth fixtures and mocked API responses. Rejected Studio access
  showed NotFound without requesting either editor module. A sampled optimized
  battle clip decoded at 318×424 with duration 6.583333 s. This is not a live
  signed-in journey or physical-device quality check.

## Remaining boundaries

Database-owner access is required for physical space compaction. The available
connection is `netlifydb_readonly` and does not own `online_rooms`; `pg_repack` is
available but was not executed. Autovacuum can reuse pruned storage internally.
No production latency or cold-start improvement is claimed from bundle sizes
alone. This rollout keeps the compatible bootstrap contract, existing conditional
polling protocol, and shared CSS; it does not introduce SSE/WebSocket hosting or
a new lazy bootstrap API contract.
