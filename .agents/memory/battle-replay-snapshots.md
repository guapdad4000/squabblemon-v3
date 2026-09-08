---
name: Battle replay snapshots
description: Why historical battle replay must use complete immutable engine state rather than reconstructing only changed participants.
---

Replay a historical event from complete immutable before/after frames captured by the authoritative engine. Do not reconstruct an old board by reversing only the event source and targets.

**Why:** Later unrelated cards, source-less story effects, reinforcements, timed effects, lane bonuses, and locks otherwise remain visible in an older replay, producing a hybrid board that contradicts the historical score.

**How to apply:** Any new match state that affects what players see or how districts score must be included in the engine’s replay frame. Keep the live UI frame separate and restore it unchanged when replay closes.