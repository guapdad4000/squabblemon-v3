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

The harness entry is enabled only by `VITE_BATTLE_PERF=1`; the normal production
build tree-shakes it out completely.