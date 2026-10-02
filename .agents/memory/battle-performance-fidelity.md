---
name: Battle performance fidelity
description: Durable rules for meaningful browser performance gates around animated battle rendering.
---

Performance fixtures must use authoritative before/after event states, staged travel
elements, effect metadata, production animation wrappers, and the full user-visible
dwell duration. Measuring fabricated final snapshots or only the first two animation
frames can miss sustained rendering regressions.

**Why:** A synthetic crowded board produced plausible metrics but omitted the costly
presentation lifecycle. Production React also disables Profiler callbacks unless the
profiling renderer is used, which can otherwise create misleading zero-work passes.

**How to apply:** Run performance gates from an optimized, isolated build that uses
React's profiling renderer, assert profiler metrics are nonzero, and share timing
constants with the production presenter so benchmark behavior cannot drift.

When a crowded-board budget fails after a presentation change, compare against
the same benchmark with that presentation layer forced to its CSS fallback on
the same runner before assigning blame or adjusting thresholds.

**Why:** In a throttled headless run, both the GPU finish and the CSS-only
baseline exceeded the existing long-task and commit budgets by a wide margin.
The absolute failure alone did not isolate the new renderer's contribution.

**How to apply:** Keep the fixed release budget; collect paired runs and final
board evidence. Do not claim the new layer meets budget just because its baseline
also fails, and do not widen thresholds to make one noisy runner pass.
Failed approaches on the headless 4x runner (Sep 2026; baseline ~213 long tasks / ~30 s,
commits ~210 vs a budget of 18 / 1.8 s / 105): replacing the chroma 2D staging with
`createImageBitmap(video, crop, resize)` ran synchronously on the main thread there and
doubled the cost (~9.5 s vs ~5 s). Adding `layoutDependency` to hand cards did not reduce
framer `measureScroll` time. So the forced layouts come from other layout nodes.
**Why:** The runner has no GPU, so video frame readback costs CPU on any upload path.
**How to apply:** Do not retry these. Getting within budget needs structural changes
(fewer commits per presentation frame, removing projection from the battle tree),
or a decision about the budget from the owner.
Commit rule: transient battle markers (score/Motion/district change markers, special-move
playback status, attack overlay geometry) must never use effect-then-setState or a
timer-clear setState — each re-renders the whole battle. Derive change state during render
and expire or position nodes directly in the DOM.
**Why:** These extra commits were the bulk of the commit-budget overrun.
**How to apply:** Any new battle overlay or marker; check the Profiler commit count.
