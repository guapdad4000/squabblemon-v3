---
name: Reward-verified battles
description: Why rewarded Squabblemon results must be replayed through one shared gameplay authority.
---

Rewarded matches must submit the player's exact six-move transcript. The server replays it with the same deterministic engine as the browser and derives the outcome, districts, and reward from that replay.

**Why:** Trusting a client-reported win lets authenticated callers forge progression. Maintaining separate browser and server rules also creates drift that can reject legitimate matches or credit the wrong result.

**How to apply:** Keep gameplay rule changes in the shared engine. Any new move, random seed, card behavior, or match mode that can grant account rewards must remain replayable and validated server-side before profile currency or mission progress changes.