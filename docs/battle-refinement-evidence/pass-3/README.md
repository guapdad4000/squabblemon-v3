# Third pass: quieter baseline and card-filter experiment

The temporary CSS experiment was rejected and reverted. The first two passes remain intact. No new runtime optimization, commit, push, or deployment was retained in this pass.

## Experiment

Prepared currently animating board cards with `will-change: transform, filter`, scoped to entry-burst, windup, and impact classes. The hint disappears when those classes clear. All original brightness, shadow, timing, art, and status treatments remained unchanged.

This tested a less invasive alternative before replacing whole-card filters with an overlay. A simple rectangular glow or white overlay is not equivalent to filtering the complete illustrated card and its status badges; such a replacement still needs its own visual and performance evidence.

## Visual verification

18 comparisons covered entry, source windup, and target impact at 0, 140, and 300ms, at viewport widths 390 and 1440. An actual rendered card was cloned into an isolated battle container, its images decoded, and animations paused at each time. Before/after PNG buffers were identical in all 18 cases. See `visual.json` and the representative entry images. These are isolated-card checks, not full-game visual coverage or every roster variant.

## Performance

Fresh production builds, existing six-round harness, Chrome headless, 390x844, DPR 2, 4x CPU throttling. The host's initial load average was 0.80/0.74/0.62, substantially quieter than the previous pass; swap remained full. Other applications were left running. Chrome's renderer reported disabled GPU compositing and its GPU process used SwiftShader. These measurements cannot establish real-phone GPU behavior.

| Standard-motion run | React commits | Long tasks | Long-task time | p95 frame interval | Frames over 34ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Original (`before.json`) | 178 | 95 | 7,521ms | 33.4ms | 4.43% |
| Temporary hint (`after.json`) | 178 | 100 | 8,066ms | 49.9ms | 5.11% |
| Restored original (`restored.json`) | 178 | 99 | 7,711ms | 33.4ms | 4.96% |

Both modes in all three runs completed with twelve nonzero-sized cards and all three districts occupied. Reduced motion also failed its long-task budget. The candidate showed no benefit sufficient to justify keeping it; a single pair does not prove a universal regression. The restored-original repeat returned close to the baseline, supporting rejection of this candidate on this machine. Production builds passed; benchmark commands exited nonzero because the long-task budgets still fail. The two inspected CSS files match their pre-experiment backups byte-for-byte.

## Remaining work

- Real GPU and phone traces are needed before selecting a card-filter or layer strategy. Do not infer compositor gains from this software-rendered browser.
- A smaller glow-layer prototype must preserve the silhouette, brightness response, foil, and status treatment before acceptance.
- Layout measurement and video draw costs identified in earlier profiles remain candidates; this experiment did not address them.
- Existing battle performance budgets still fail. Earlier outstanding full-suite failures remain unresolved; this pass does not claim a full test-suite pass.
