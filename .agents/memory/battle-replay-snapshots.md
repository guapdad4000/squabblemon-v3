---
name: Battle replay snapshots
description: Why historical battle replay must use complete immutable engine state rather than reconstructing only changed participants.
---

Replay a historical event from complete immutable before/after frames captured by the authoritative engine. Do not reconstruct an old board by reversing only the event source and targets.

**Why:** Later unrelated cards, source-less story effects, reinforcements, timed effects, lane bonuses, and locks otherwise remain visible in an older replay, producing a hybrid board that contradicts the historical score.

**How to apply:** Any new match state that affects what players see or how districts score must be included in the engine’s replay frame. Keep the live UI frame separate and restore it unchanged when replay closes.

Nested reactions must produce chronological, non-overlapping replay transitions. An outer ability event must not replay state changes already captured by its counter or trap reaction.

**Why:** A trap consumed before a reactive counter could reappear in the outer event's older snapshot, and the same counter bonus could animate twice even though the final live board was correct.

**How to apply:** Record consumption before the reaction, then start any wrapper event from the settled reaction state. Test adjacent before/after frames and count actual state transitions, not only the final board.