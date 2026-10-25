# Phone battle performance — October 25, 2026

The reported problem is a hot, lagging phone on the live site with about **10 board cards**. Phone model/browser were not supplied. This pass preserves artwork, visible motion, complete formations, card inspection, rules and polling cadence. It is a local implementation and verification pass; nothing was published.

## Changes

- **Online snapshots:** retain a per-battle projection and unchanged card identities across clock-only responses. Compare every authoritative field except `serverTime` and `deadline`, which the actual clock still consumes directly. Same-revision changes to forms, statuses, private costs, scores, events and results remain live. A room/game/private-seat change resets the cache.
- **Lane previews:** copy current public state without serializing the entire accumulated replay history three times on selection. Retain immutable historical entries, sequence/seed inputs and the hidden-hand boundary. Engine-generated histories and frozen snapshots exercise paid, Squabble, seeded and reactive cases.
- **Idle motion:** remove the unconditional transform promotion that overrode the coarse-phone rule. The existing shared visibility/preference observer now pauses fully clipped board-card breathing, resumes it on reentry and stops it in hidden tabs. Visible breathing and finite entry/stance/impact/reveal animations remain intact. No card is removed, no per-card RAF/timer is introduced, and visibility does not commit React updates.
- **Finite dust:** release animated movement-dust playback when its direct parent's authored fade ends. Keep the still fallback; ignore unrelated/descendant/cancelled animations and late loader completion. Both departure and arrival placements remain.

The conflicting CSS rules were confirmed by an unauthenticated GET of the live site's linked stylesheet. The retained URL/hash/time is in `live-css.json`. This establishes that specific rule was deployed; it does not identify the deployed commit or prove a single cause of phone heat.

## Evidence and boundaries

The adjacent [evidence directory](../../artifacts/deliverables/phone-battle-performance-20261025/) contains JSON, logs, source/build fingerprints and representative screenshots.

| Check | Result |
| --- | --- |
| Real online query hook → MultiplayerBattle → CardView, 10 cards, three 800 ms clock-only polls | Old projection: 30 board-card commits. Updated projection: 0. The visible clock still decreases. |
| Same-revision online updates | A corrected form/status commits only that card; a selected district's private cost updates its hand card; completion renders the result screen. No room command was sent. |
| Engine-generated 12-card / 36-event preview microprobe | Three lane previews: median 19.48 ms → 3.25 ms, identical outputs. |
| Engine-generated 36-card / 108-event preview microprobe | Three lane previews: median 177.76 ms → 9.95 ms, identical outputs. |
| Phone-size production rendering, 10 cards | Compositing layers: 49 → 43; all ten cards and five authored idle animations retained. |
| Phone-size production rendering, 72 cards | Running infinite animations: 73 → 25. All 72 cards remain mounted; 48 clipped cards pause. Layer count remains 114, so this is not a claimed layer-memory reduction for the crowded case. |
| Responsive actual rendering | 390×844, 320×568, 844×390, 1440×1000: all six crowded stacks scroll; all 72 cards remain; the complete 24-fighter district and final fighter inspector open; focus returns; the primary action is reachable; no horizontal overflow. |
| Artwork/preferences | Portraits, foil, grain, glare and authored frame clipping retained. OS and app reduced-motion changes restore correctly. |
| Source/build | 53 focused runtime/preview/projection/Subway tests; full frontend TypeScript; required production build with 238 tests, bundle/style budgets; diff whitespace check. |
| Existing deck evidence | Matrix, stress and confirmation remain current against rules/source fingerprint `dfbfacef31b2fe22c0cfb012f0b0013b8b32fb66c4df325c138f320b25956a5b`. No balance values changed. |

Microprobe medians use 12 alternating trials after warmup, with every trial retained. Timings are Node diagnostics on synthetic stress histories, not phone timings or whole-game speed multipliers. The online comparison uses a dedicated development fixture with actual components and mocked loopback responses. Its old version is loaded from the recorded Git base; only CardView render/commit counters are instrumented. It does not prove real-network or two-player behavior.

Production comparison uses the same static thermal harness, actual Battle/CardView renderer, 390×844, DPR 3, coarse touch, 4× CPU throttle, separate fresh browser contexts and 12-second passive-idle windows. Browser workloads run sequentially. The frozen pre-change build had two incorrect test-only roster spellings corrected in its single harness roster literal; that correction is recorded separately. No production component or stylesheet was changed in that frozen build.

Passive idle CPU time is low in both builds and did **not** establish a ten-card CPU-time improvement. Tap-to-two-frames samples are noisy and are not presented as an improvement. Earlier exploratory runs continuously sampled RAF; this woke main-thread style work, so those values were excluded from the passive-idle comparison. Perspective removal, image-layer promotion, and disabling visible motion were diagnostic probes and were **not adopted**.

The unchanged six-round production performance gate remains authoritative for its own scripted workload; the final report is `sequence-after.json`: standard 93 commits, 16.8 ms p95 frame interval, 10 long tasks / 673 ms total; reduced 86 commits, 33.3 ms p95, 7 long tasks / 399 ms total. Both retain 12 cards across three districts and pass the unchanged 105-commit and timing budgets. Neither browser emulation nor these tests measure physical phone temperature, sustained battery use, Safari GPU behavior, or the updated live deployment. The prior hardening/native-database evidence remains separate and was not rerun or relabeled by this client-rendering pass.

## Reproduction

From `artifacts/squabblemon`, use the installed Node runtime and dependencies:

```sh
NODE_ENV=production VITE_BATTLE_PERF=1 VITE_E2E_AUTH=false PORT=4339 BASE_PATH=/ node node_modules/vite/bin/vite.js build --config vite.config.ts --outDir /tmp/squabblemon-thermal-after
NODE_ENV=production VITE_BATTLE_PERF=1 VITE_E2E_AUTH=false PORT=4339 BASE_PATH=/ node node_modules/vite/bin/vite.js preview --config vite.config.ts --host 127.0.0.1 --port 4339 --strictPort --outDir /tmp/squabblemon-thermal-after
THERMAL_ORIGIN=http://127.0.0.1:4339 THERMAL_OUTPUT=/tmp/battle-thermal-passive-after node e2e/verify-battle-thermal.mjs
BATTLE_IDLE_ORIGIN=http://127.0.0.1:4339 node e2e/verify-battle-idle-lifecycle.mjs
BATTLE_PERF_ORIGIN=http://127.0.0.1:4339 CHROMIUM_PATH=/usr/bin/google-chrome node scripts/battle-performance.mjs
node e2e/verify-online-projection.mjs
node --import tsx ../deliverables/phone-battle-performance-20261025/preview-microprobe.ts
pnpm run test:battle-runtime
pnpm run typecheck
```

The online fixture owns and closes its own local server/browser. `ONLINE_PROJECTION_BASELINE=1` selects the old projector from `HEAD` for the heartbeat comparison; retain its recorded source hash, since `HEAD` will change after a commit. `THERMAL_SAMPLE_FRAMES=1` enables an explicitly separate RAF diagnostic and must not be compared with passive-idle counters.

The production build does not include either diagnostic harness. The new 29-test battle lifecycle suite is required by the shared release gate. It explicitly uses React's test runtime for `act` even when the build host has `NODE_ENV=production`; the bundle and browser profiling remain production builds.

Before a live thermal claim, publish an authorized verified candidate, confirm the hosting revision, then repeat the same ten-card battle on the affected phone for a sustained session. Record device, browser, card/status workload and trace alongside the player's observation.
