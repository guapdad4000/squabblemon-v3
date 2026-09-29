---
name: Story-passive timing
description: Ordering story phases around passive effects that change the board at match creation or round start
---

Evaluate story rules both before and after a passive summons cards at match creation or the start of a new round.

**Why:** New-round locks and reinforcements must resolve before choosing a summon district, but the resulting summon can itself cross a story total-power or districts-held threshold. Checking only once misses one side of that interaction and can allow a move before a newly triggered phase takes effect.

**How to apply:** When adding an automatic board-changing effect at these boundaries, settle scheduled/round-triggered story rules first, apply the effect, then settle board-triggered phases before giving either player control. Verify the sequence in deterministic story replay.