# Battle performance budget

Run `pnpm --filter @workspace/squabblemon run test:performance`. The command creates
an optimized, performance-only build, serves it locally, runs the measurements, and
shuts the preview down. `BATTLE_PERF_ORIGIN` may point it at an already running
performance build when debugging.

The check uses a 390×844 mobile viewport and Chromium's 4× CPU slowdown. It uses the
production game engine to play a deterministic legal card for both players in each of
six rounds. Each engine event is presented from its authoritative before/after state
with staged travel cards, effect sources and targets, score snapshots, and the same
`LayoutGroup` plus `MotionConfig reducedMotion="user"` hierarchy as the real app.
The run ends with twelve cards across all three districts. Standard-motion and
reduced-motion are measured separately and each event frame uses the same shared
before/after dwell durations as `PlayLoop`.

The release budget covers:

- browser long-task count and total duration;
- requestAnimationFrame p95 interval and the ratio of intervals over 34 ms;
- React Profiler commit count and total render duration;
- the final board occupancy, card count, and viewport contract.

Budgets live beside the assertions in `scripts/battle-performance.mjs`. Update them
only after comparing repeat runs on the same runner and documenting why a deliberate
visual change needs more main-thread work. Do not loosen a budget to hide a noisy or
slower implementation.

For foil comparisons, `BATTLE_PERF_SCREENSHOTS=1` captures the final standard and
reduced-motion boards in `screenshots/foil`. `BATTLE_PERF_FORCE_CSS=1` runs the
same presentation with the foil GPU layer disabled, to separate existing battle
animation cost from finish rendering. Compare both runs on the same machine before
attributing a budget failure to WebGL. Neither flag changes the release budgets.

The harness entry is enabled only by `VITE_BATTLE_PERF=1`; the normal production
build tree-shakes it out completely.

## Shared GPU quality budget

`public/scenes/shared/gpu-quality.js` is the single detector for the web app and
standalone scene documents. It samples device memory, hardware concurrency,
Save-Data, WebGL2 texture/renderbuffer limits and a bounded (12 ms) JS
throughput probe. The result is cached in sessionStorage; the parent passes its
tier in the scene iframe URL before the iframe starts allocating GPU resources.
The renderer never benchmarks independently inside an embedded scene.
Reduced-motion OS or account settings override every tier to **static**.
For deterministic browser proof use `?gpuTier=low|medium|high|static`; this
test-only override is ignored when reduced motion is active. Do not use it as
a user-facing setting.

| Tier | DPR cap | Shadows | Post-process/mesh outlines | Particles | Scene target |
| --- | ---: | --- | --- | ---: | ---: |
| high | 2 | on | on | 100% | 60 fps |
| medium | 1.4 | on | off | 50% | 30 fps |
| low | 1 | off | off | 20% | 24 fps |
| static | — | off | off | 0% | no WebGL |

Safehouse uses a single color pass instead of the extra normal and composite
passes below high. Gym omits glove/bag outline meshes and scales hit sparks;
Safehouse scales dust particles. Deck-box tilt and the shared foil atlas's
per-card presentation canvases use the same DPR/fps caps; the single atlas
keeps a fixed, bounded tile size regardless of visible card count. Reduced motion and unsupported WebGL2 show the
Safehouse poster, the gym's illustrated background, the deck-box print and the
CSS card finish without allocating scene contexts. A genuine render/context
failure still exposes the venue reload button, while the deck print and CSS
finish remain visible.

At static quality (or a scene error) Safehouse replaces camera-positioned
station markers with a visible, keyboard-accessible two-column station menu;
returning players can still open every destination without iframe anchors.
Standalone Safehouse and gym documents also use the shared loader to present
their static equivalents without importing the WebGL scene.

Run `node e2e/verify-gpu-quality.mjs` from this artifact to save 390×844
mobile screenshots of all four surfaces at each tier to
`../../screenshots/gpu-quality/`. The script also visits the actual returning-player
Safehouse route under reduced motion and unsupported WebGL2, opens a station,
returns to the room, and checks both standalone static documents. On headless Chromium at device scale 2,
measured Safehouse and gym drawing-buffer widths were **390 / 546 / 780 px**
for low / medium / high respectively (at 390 CSS px). That is approximately
**25% / 49% / 100%** of high-tier pixel area; the Safehouse also avoids two
full-scene extra render passes below high. These are buffer/pipeline measures,
not physical-device frame-time claims. Keep the separate battle performance
budget above unchanged.
