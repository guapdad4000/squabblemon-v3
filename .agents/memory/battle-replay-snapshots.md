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

A multi-step reveal that emits nested events partway through must resume its wrapper frame from the settled state of the last nested event, not from the pre-reveal state and not from the final state.

**Why:** Starting the wrapper at the final state collapses it to a no-op transition, so everything the reveal did after the nested move or interception never animates; starting it at the pre-reveal state replays the nested change twice.

**How to apply:** Track the state immediately after each nested emission inside the reveal and pass it as the wrapper's base. Assert adjacent frames chain — each frame's before-replay-state equals the previous frame's after-replay-state.

A reaction that fires upon movement needs its own move frame before the reaction frame. Silencing or countering the mover inside the movement helper can otherwise make the trap's "before" snapshot already show the mover in the new district, while the outer ability skips the move because the inner reaction emitted an event.

**Why:** Final board assertions can pass while replay appears to teleport the mover into an already-triggered trap.

**How to apply:** When a movement hook can emit a nested reaction, capture the move as a distinct event first. Assert that the move's after-board equals the reaction's before-board, and check post-move ability rewards against the mover's newly applied status.

Movement completion does not guarantee that the mover survives. Preserve the returned combat state when arrival damage or nested reactions remove the subject of a later presentation event.

**Why:** A legal one-Hand rider died to a destination arrival tax, but post-ride presentation assumed it still existed and crashed both committed play and legal-candidate preview. Treating the missing card as a blocked move would instead invent a false replay target.

**How to apply:** Gate post-action presentation on surviving participants without discarding committed tax, defeat, reaction, or neutral aura-loss records. Exercise both committed play and legal previews for both seats; never skip the legal candidate to hide an engine failure.