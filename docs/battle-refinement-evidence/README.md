# Battle refinement validation — October 2, 2026

Implemented locally, not published. This records the first measured implementation from the larger audit, not completion of every conditional optimization.

## Changes

- Normal impact rings: 3px → 1.5px; white highlight: 5px → 1px; fire: 8px → 2px; Squabble: 7px → 2.5px; CSS shockwave: 3px → 1.5px.
- Each impact now animates a small HTML wrapper around its own SVG, instead of scaling an SVG group inside the full-arena surface. Ring radius, shields, colors, glow, and duration remain.
- Geometry reads skip unrelated board cards while retaining sources, targets, and chain predecessors.
- Bursts keep all 12 particles and release their invisible DOM after 950ms (the longest fragment ends at 872ms). Persistent status artwork stays.
- SpecialMove schedules using decoded video frames, with RAF fallback, duplicate-frame avoidance, cadence carry, and cancellation/resumption when hidden. Shader, canvas resolution, clip selection, audio, and battle timing stay unchanged.
- Safehouse now immediately constrains the camera on viewport resize, preventing a one-frame portrait-to-landscape escape above the closed roof. The exact boundary violation was reproduced with the pre-edit scene.
- Safehouse avoids recalculating the camera projection when its view offset and viewport have not changed. No changes to scene geometry, shadows, render resolution, or ambient animation.

## Production benchmark

Chrome headless, 390×844, DPR 2, 4× CPU throttling, existing six-round harness. `before.json` is the pre-edit working tree; `after.json` is the final unprofiled build. `after-profiled.json` is a separate final-build run with a CPU profile enabled. Same script and viewport; shared workstation, not controlled physical-phone hardware. One pre-edit baseline and two final runs establish an encouraging result, not a universal FPS guarantee.

| Standard-motion metric | Before | Final unprofiled |
| --- | ---: | ---: |
| Long tasks | 137 | 94 |
| Total long-task time | 12,503ms | 7,291ms |
| p95 frame interval | 66.6ms | 33.4ms |
| Frames over 34ms | 7.79% | 4.79% |
| Recorded React render time | 1,493ms | 1,076ms |
| Recorded React commits | 231 | 242 |
| Visible board cards after six rounds | 12 | 12 |

Long-task time improved about 42%; commit count increased slightly due to transient-effect cleanup. The profiled final run recorded 7,432ms long-task time and the same 33.4ms p95.

Reduced-motion long-task time improved from 5,522ms to 4,706ms, but p95 remained 100ms. Do not present the normal-motion improvement as resolving every mode.

**Performance budget still fails:** standard has 94 long tasks against a limit of 18. Profiling still finds substantial time in video draw work and Framer Motion scroll measurement. Full filter/asset/video pipeline and 3D pass changes remain measured follow-up work. No quality-reducing shortcuts were applied.

## Correctness and visual checks

- Typecheck passed; production performance build passed.
- Battle test suite: 195/198 passed. Two failures report duplicate React/context resolution through the existing `/tmp/squabblemon-main-push-20260926` dependency path when rendering CardInspector. One roster expectation reports 23 versus 19. These failure sites are outside the changed code; the pre-edit suite was not rerun, so they are not claimed as a verified pre-existing baseline.
- Safehouse static/camera unit tests: 8/8 passed. Browser camera checks passed on desktop before the resize correction; the phone check reproduced the pre-edit resize violation, then passed after the correction, including rotation, drag, tilt, zoom, pinch, 13 presets, resize, and reset. See `safehouse-phone.json`. Landscape/tablet cases of the full camera suite were not completed.
- Browser checked actual impact rings at 390px and 1440px, with light/dark root settings. Computed outer stroke was 1.5px and inner stroke 1px; no runtime exceptions. Screenshots were visually inspected. The battle artwork itself retains its authored dark palette.
- Special-move browser checks: initial playback, two replays, hidden-page upload suspension, and resume passed with native video-frame callbacks and simulated RAF fallback; GPU renderer active, no runtime exceptions.
- Screenshots: `phone-impact.png`, `desktop-impact.png`; raw browser results: `browser.json`.

No commit, push, or deployment was performed. Existing unrelated working-tree edits were preserved.

## Reproduce

From `artifacts/squabblemon`, run `CHROMIUM_PATH=/usr/bin/google-chrome BATTLE_PERF_REPORT=/tmp/battle-performance.json pnpm run test:performance`. This builds the production performance harness and checks the original budgets; it currently exits nonzero for the long-task budget.

To run the visual/playback checks against a production performance preview, serve it with `PORT=4198 BASE_PATH=/ VITE_BATTLE_PERF=1 pnpm exec vite preview --host 127.0.0.1 --port 4198`, then run `node scripts/verify-battle-refinement.cjs`. Override `BATTLE_PERF_ORIGIN`, `CHROMIUM_PATH`, or `REVIEW_OUTPUT` as needed.

## Subsequent work

[Second pass: layout measurements and video experiments](pass-2/README.md) records the next implementation, rejected renderer experiments, actual practice-route provider fix, and the limits of further performance measurements under shared-machine load.

Third-pass baseline and rejected card-filter experiment: [pass-3/README.md](pass-3/README.md).
