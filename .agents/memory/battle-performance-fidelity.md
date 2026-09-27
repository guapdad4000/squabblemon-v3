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