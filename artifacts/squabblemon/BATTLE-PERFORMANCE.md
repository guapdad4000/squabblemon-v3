# Battle performance review — 2026-10-06

Battle now avoids extra renders for fresh draws and card-list presence bookkeeping that had no exit animations. Hand spring layout, hover/tap motion, staged card reveals, overlay exits, impact timing, artwork, particle effects, emblems, and card rules remain intact. Fresh draws keep their authored 800 ms animation; CSS releases the completed transform without a 900 ms state-reset render.

## Like-for-like measurement

The existing production profiling harness ran six legal rounds through the shared engine and presentation sequence at 390 × 844, DPR 2, with Chromium CPU throttled 4×. Each run used `/usr/bin/google-chrome`, the same standard/reduced modes, and all three flags: `BATTLE_PERF_SCREENSHOTS=1`, `BATTLE_PERF_PROFILE=<path>`, and `BATTLE_PERF_TRACE=<path>`. CPU profiling and DevTools timeline tracing surround the standard navigation/run/screenshot; reduced mode has React, frame, and long-task metrics without that CPU/trace capture. Native profile totals include startup and capture work; overlapping trace event durations must not be added together.

Both final runs retained 12 visibly rendered board cards across all 3 districts after the final transition. Their smallest cards measured at least 54.62 × 76.25 px. No forced CSS quality override was enabled. The settled board had 0 live foil canvases, consistent with its existing background-card policy.

| Mode / run | React commits | React duration (ms) | Long tasks | Long-task duration (ms) | p95 frame interval (ms) | Frames >34 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Standard baseline | 107 | 715.1 | 28 | 1,818 | 33.3 | 1.88% |
| Standard after, first | 89 | 563.3 | 24 | 1,706 | 33.3 | 1.75% |
| Standard after, repeat | 89 | 555.8 | 27 | 1,916 | 33.3 | 1.84% |
| Reduced baseline | 98 | 593.1 | 18 | 1,040 | 50.0 | 5.34% |
| Reduced after, first | 80 | 507.8 | 17 | 1,007 | 50.0 | 5.45% |
| Reduced after, repeat | 80 | 497.4 | 17 | 978 | 33.4 | 4.64% |

The repeated gain is lower React work: 18 fewer commits in each mode, with standard render duration down 21–22% and reduced render duration down 14–16%. Standard native long-task time varied from 1,706 to 1,916 ms; this does not establish a reliable native stall improvement. Profile hotspots still include chroma processing, Motion scroll measurement, layout, and painting. A renderer experiment failed pixel parity and was discarded; attack-anchor and intensity-selector experiments were also discarded. None of those changes remain.

## Budget result and limits

**Reduced mode meets every unchanged budget in both final runs. Standard mode still fails the 18-long-task limit (24–27). The repeat also exceeds the 1,800 ms total long-task limit (1,916 ms).** Standard passes the commit, React duration, p95 frame, and dropped-frame limits. Existing limits were not changed: 105 commits, 3,000 ms React duration, 18 long tasks, 1,800 ms long-task duration, p95 125 ms standard / 175 ms reduced, and 65% frames above 34 ms.

`pnpm run test:performance` consequently exits 1 for standard mode. These are controlled local headless-browser measurements with profiling overhead, not physical-phone or live-production FPS guarantees. Bundle/build success is not treated as gameplay proof.

## Regression checks

- **72/72 unit/source tests pass** in `Battle.test.tsx` and `battleChoreography.test.ts`.
- **2/2 browser journeys pass**, at phone 390 × 844 and desktop 1280 × 900, without browser runtime errors. Each covers a real new draw committing once, exact 800 ms draw timing, selection after completion, and released draw transform.
- Both journeys remove a hand card and sample the remaining card's intermediate spring transforms, then verify the gap closes, card size stays within 1 px, and selection still works. Existing `layoutId`, `layoutDependency`, LayoutGroup, and spring settings are preserved.
- Both verify a real impact target has positive geometry and stays anchored to its card, plus the existing 200 ms routine nudge and 180 ms takeover flash.

```sh
node --import ../../scripts/battle-test-css.mjs --import tsx --test src/components/Battle.test.tsx src/battleChoreography.test.ts
UI_ORIGIN=http://127.0.0.1:4195 node e2e/verify-battle-performance-regression.mjs
CHROMIUM_PATH=/usr/bin/google-chrome BATTLE_PERF_SCREENSHOTS=1 BATTLE_PERF_PROFILE=/tmp/battle-final-repeat.cpuprofile BATTLE_PERF_REPORT=/tmp/battle-final-repeat.json BATTLE_PERF_TRACE=/tmp/battle-final-repeat-trace.json pnpm run test:performance
```

All commands run from `artifacts/squabblemon`; the regression verifier expects the existing Vite fixture server on 4195. Saved evidence is in `screenshots/battle-performance`: `baseline.json`, `after-first.json`, `after-repeat.json`; `settled-standard.png`, `settled-reduced.png`; and `draw`, `projection`, and `impact` PNGs for both phone and desktop. Raw diagnostic files remain `/tmp/battle-before.{cpuprofile,json}`, `/tmp/battle-before-trace.json`, `/tmp/battle-hand-presence.{cpuprofile,json}`, `/tmp/battle-hand-presence-trace.json`, `/tmp/battle-final-repeat.{cpuprofile,json}`, and `/tmp/battle-final-repeat-trace.json`.
