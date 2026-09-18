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