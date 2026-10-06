# Second pass: layout measurements and video pipeline

Implemented locally after the first refinement pass. No commit, push, or deployment.

## Retained changes

- Battle hands now give Framer Motion a layout dependency based on visible card IDs/order and selection. Effect text, timer, and unrelated status updates do not independently request a hand layout snapshot. Membership changes, staging, selection, and removal still trigger the normal animation path. Both battle render paths use this dependency; other CardView uses retain their previous behavior.
- BattleAttack still measures synchronously at each beat and measures again on actual arena resize. It no longer schedules a duplicate next-frame measurement or reacts to the ResizeObserver's initial same-size notification.
- Vite now deduplicates `@tanstack/react-query`. The production bundle previously contained QueryClientProvider modules from both the workspace and an existing `/tmp/squabblemon-main-push-20260926` dependency installation. That caused the actual offline practice route to throw `No QueryClient set`. The rebuilt bundle contains one provider module.

## Video experiments rejected

The existing chroma renderer was restored byte-for-byte after both experiments. Shader, source media, resolution, and current playback scheduling are unchanged.

1. Direct full-video texture upload: measured roughly 3.7–4.7ms per repeated draw versus 0.3–0.5ms for the existing resized staging path. It also changed edge pixels: mean composite error 1.3–3.1 on a 0–255 scale, with about 2–8% of pixels exceeding a 12-level average channel difference. Rejected for this path.
2. Canvas `copy` compositing instead of clear plus draw: also slower in the sample and not pixel-identical (mean composite error roughly 0.3–0.6). Rejected.

These are paused-frame microbenchmarks using Barber Bro and GUAP clips at three timestamps, drawing to 288px-wide surfaces and synchronizing at the end of each sample. They do not establish universal hardware performance. The image differences and lack of a measured speed benefit were sufficient reasons not to adopt either experiment. Raw data: `direct-pipeline.json`, `copy-pipeline.json`.

## Measurements: no additional FPS gain claimed

Same six-round production harness, 390×844, DPR 2, 4× CPU throttling. All completed runs retained 12 visible board cards across all three districts.

| Run | Standard React commits | Long-task time | p95 frame interval |
| --- | ---: | ---: | ---: |
| Fresh pre-pass baseline (`before.json`) | 241 | 8,694ms | 50ms |
| Hand dependency only, profiled (`after.json`) | 241 | 10,514ms | 50ms |
| Dependency + duplicate-measurement removal (`final.json`) | 178 | 9,014ms | 50ms |
| Final build including provider dedupe (`verified.json`) | 176 | 13,138ms | 66.7ms |

Removing duplicate measurement consistently reduced commit count by approximately one quarter. Timings did **not** demonstrate a further FPS improvement and the original performance budgets still fail. At the final check, unrelated browser processes were heavily active, host load average was 6.40, and all 8GB of swap was in use. This shared-machine evidence is insufficient to attribute the timing regression to a particular code change or to claim a speedup. Do not compare these numbers as controlled hardware results.

## Verification

- Typecheck passed; production application and isolated battle fixture builds passed.
- 22 focused choreography, visibility, feedback, and timeline tests passed.
- Production battle fixture checks at 390px and 1280px: select/deselect, drag-to-play, seven-to-six card hand rearrangement, visible distinct card positions, and viewport resize passed with no runtime exceptions. `hand-results.json` and `hand-after-resize.png` record these checks.
- The real `/play/guest` route now loads the deck-selection screen after provider deduplication. Offline start/play/inspection verification is recorded in `practice.json`.
- The local test authentication configuration can still emit a Clerk script-loading warning for `clerk.127.0.0.1`; authenticated account flows were not validated. This is distinct from the fixed query-provider crash.
- Final effect checks passed at phone and desktop sizes with light/dark root settings: 1.5px outer rings, 1px inner highlights, visible geometry, and no runtime exceptions. Native/fallback video scheduling, replay, and hide/resume checks also passed. See `visual.json`; the phone impact capture was visually inspected.
- No speculative video optimization, resolution reduction, effect removal, or change to game rules/timing was retained.
