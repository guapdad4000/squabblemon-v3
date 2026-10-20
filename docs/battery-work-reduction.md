# Battery-focused duplicate-work reduction

Base: `56f48cd253185c79f85499950ea4a5cdc692263e` (main, 2026-10-20).

This draft removes repeated CPU/driver work without trading away visible
quality. It is independent of drafts #14–17. It is not a claim that every source
of battery use is fixed, and it has not been merged or deployed.

## Accepted changes and measured work

1. **Gym dent recovery:** track the vertex indexes written by punches and visit
   only that set during recovery. Keep the original Float32 values, threshold,
   order of arithmetic, final residual, per-frame position updates and normal
   recomputation. Do not snap the bag to a new shape or skip a required normals
   update. The set is bounded by the geometry's vertex count and reset when the
   geometry is built.
   - 600 undented frames: **1,557,000 dent reads → 0**.
   - 800-frame repeated-punch/recovery trace: **2,436,080 → 541,240 dent reads**.
   - Every frame's positions, normals, dent bytes, position upload version and
     normal-update count match the frozen main implementation. All **193**
     required normal recalculations remain in the repeated-punch trace.

2. **Safehouse static batches:** only the newly generated, permanently
   identity-local merged meshes set `matrixAutoUpdate=false`. Their world
   matrices still follow moving parents. Original interactive objects and
   dynamic groups retain their normal update behavior.
   - Three-batch fixture over 240 animated frames: **720 local compositions → 0**.
   - World matrices, positions/normals, bounds, shadow flags, visibility and
     real Three.js raycast points/distances/face indexes remain exact.

3. **Safehouse station anchors:** after the color render has updated the scene,
   project with each object's existing `matrixWorld` instead of calling
   `localToWorld`, which recomposes its ancestors again.
   - 180 anchor publications in the nested fixture: **7,020 ancestor
     compositions → 0**, for both outlined and non-outlined rendering.
   - Same projected coordinates, visibility, 100 ms throttle, message-change
     threshold, reset behavior and first-frame readiness ordering.

4. **Lobby particles:** read the layout width and assign the common fill color
   once per drawn frame rather than once per mote.
   - Full quality, 600 frames: each operation **25,200 → 600**.
   - Lite quality, 600 frames: each operation **9,600 → 600**.
   - Exact draw geometry, alpha/color, random-call sequence, CSS parallax output,
     frame scheduling, pointer/gyro behavior, resize, hidden/resume, quality
     changes and cleanup match the complete frozen main effect.

5. **GPU chroma renderer:** set its invariant full-staging-canvas crop uniform
   once. Update the viewport only when output dimensions change, alongside the
   existing texture-storage resize. The [WebGL specification](https://registry.khronos.org/webgl/specs/latest/1.0/#WEBGL_VIEWPORT)
   states canvas resizing does not reset viewport state.
   - Fixed-size 60-frame fixture: **60 crop-uniform calls → 1** and
     **60 viewport calls → 1**.
   - All **60** staging draws, uploads and GPU draws remain. Both actual-size
     changes and same-size assignments are covered, together with video/canvas
     crop arguments, context loss, idempotent disposal and the unchanged CPU
     clear/crop/read/key/write fallback.

These are deterministic operation counts, not measurements of elapsed time,
frame rate, GPU energy, temperature or battery percentage on a player's phone.
Safehouse's visible multipass rendering and video decoding still cost energy.

## Explicitly preserved

- No lower FPS, resolution, device-pixel ratio, quality tier, particle count,
  outline, lighting, shadow, shader, artwork or animation setting.
- No changed frame/physics delta, punch timing, hit stop, input handling,
  camera easing, station visibility, battle rules, reward or economy logic.
- No media-file, audio, preload, lazy-load boundary, download-start,
  readiness/fallback timeout or visible-loading change.
- No added production import/request or runtime dependency. Main lockfile and
  supply-chain policy remain unchanged.
- Existing hidden-page and reduced-motion protections remain. This draft does
  not present them as new optimizations.

## Audit decisions

Kept normal-motion Safehouse rendering, its extra LobbyDepth layer, and all
outline/color/normal-depth passes. They contain visible motion; stopping or
throttling them without device evidence would violate the pacing constraint.
Broader scene freezing would endanger moving groups and picking. Bag normal
recalculation remains whenever the original code updates vertices.

Kept chroma staging/resampling and per-frame uploads: direct video uploads or
different resize paths can change pixels, particularly on mobile. SpecialMove
already uses video-frame callbacks and media-time deduplication. No new
decoder/preload gates, delayed readiness or playback lifecycle changes were
introduced. Left LayeredVenue's ambient loop and AlleyAvatar's cadence intact.
Additional KeyedVideo crop memoization/readiness-write cleanup was not needed
for these bounded fixes and would widen the media lifecycle surface.

## Verification

- Clean frozen-lockfile dependency installation passed the repository's
  minimum-release-age/supply-chain checks.
- **17 new battery regressions pass**, with zero skips. An independent review
  reran them, checked frozen fixtures against main, and found no blocking issue.
- **21 existing Safehouse camera/geometry/batching/table/art tests pass**,
  including visible RGB and alpha checks for all seven lossless artwork pairs.
  Missing sparse-checkout assets were fetched unchanged from main for these
  checks; artwork was not modified.
- Shared-library, frontend and API typechecks pass. Frontend, API and Netlify
  function builds pass; bundled health, anonymous-access and configuration
  smoke checks pass. These smoke checks use their test stubs, not production
  database changes or an actual checkout transaction.
- Unchanged frontend budgets pass: public entry **212.6 / 475 KiB**,
  GameApp **894.7 / 900 KiB**, Home **969.3 / 1200 KiB**.
- Broad battle test command: **254 / 257 pass**. Two sparse media/reference
  cases and the existing Earth-count assertion (34 vs 33) fail. The associated
  tests/catalog/media code are unchanged. No budget or expectation was relaxed.
- Aggregate scripts typecheck retains the existing errors in
  `rivalry-online-audit.ts:19` and `rivalry-online-model.test.ts:36`.

### Combined drafts

Local compatibility was checked against draft #14 at `b9d1ad9`, #15 at
`5bc75f9`, #16 at `376e64f`, and #17 at `e1201e2`, plus this draft's exact
production edits. Only overlapping package-script additions required unioning;
no runtime conflict resolution was necessary. PR #14's media changes remain
reverted. This temporary combination is not published or merged.

Combined tests pass with zero skips: **148 client tests** (17 battery, 35
render-work, 23 work-reuse, 25 safe-passes and 48 online) and **73 database
tests** covering bootstrap/rewards/collection races plus archive, campaign,
social records, immutable story rewards and puzzle transactions. Database
checks used owned disposable PGlite, not production or a native PostgreSQL
load test. The second database run used a temporary copy of the existing
guarded runner with only its selected test-file list changed; all ownership,
local-target and readiness checks were retained.

Combined shared/frontend/API types, frontend/API/function builds and bundled
smoke checks pass. Combined unchanged budgets: public **212.7 / 475 KiB**,
GameApp **894.9 / 900 KiB**, Home **969.5 / 1200 KiB**.

## Repeat commands

```sh
pnpm --filter @workspace/squabblemon test:battery
pnpm --filter @workspace/squabblemon test:safehouse
cd artifacts/squabblemon
node --test e2e/safehouse-geometry.test.mjs e2e/safehouse-table.test.mjs
cd ../..
pnpm run typecheck:libs
pnpm --filter @workspace/squabblemon typecheck
pnpm --filter @workspace/api-server typecheck
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/squabblemon build
pnpm --filter @workspace/api-server build
node scripts/build-netlify-function.mjs
node scripts/check-netlify-function.mjs
```

## Remaining release gates

Real-browser screenshots, frame pacing, touch/keyboard feel, audio onset,
cold/warm playback and phone battery/thermal measurements remain unverified.
The installed Chromium aborted before any page opened because socket creation
was prohibited. The official Playwright browser download also returned an
invalid archive. No permission restriction was bypassed. Deterministic host
and Three.js tests cannot establish hardware energy use or mobile pixel parity.

Before merging, compare main and the combined preview on the affected phone:
Safehouse idle/camera/stations, gym idle/repeated punches/reveal, battle idle and
effects, orientation changes, background/resume and repeated route changes.
Keep brightness, audio, connection and starting thermal state comparable;
record CPU/GPU work, frame times and energy/temperature where supported. Check
first-ready time, sound onset, input timing and screenshots alongside energy.
Do not claim battery savings, or remove the draft release gate, based only on
the operation-count reductions above. Full media-integrity and authenticated
release playthroughs are not established by this sparse checkout.
