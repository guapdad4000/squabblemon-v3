---
name: Reward-verified battles
description: Why rewarded Squabblemon results must be replayed through one shared gameplay authority.
---

Rewarded matches must submit the player's exact six-move transcript. The server replays it with the same deterministic engine as the browser and derives the outcome, districts, and reward from that replay.

**Why:** Trusting a client-reported win lets authenticated callers forge progression. Maintaining separate browser and server rules also creates drift that can reject legitimate matches or credit the wrong result.

For data-driven matches, snapshot every mutable content input that affects completion when the match starts, including encounter rules, player card identities, progression identity, and rewards. Never resolve an active match against the current content registry.

**Why:** A content deployment between match start and completion can otherwise verify one issued encounter but grant rewards or progression from a newer definition.

**How to apply:** Keep gameplay rule changes in the shared engine. Return the exact server-issued match snapshot to the browser and initialize the local engine from it; persisting it only for server verification creates client/server drift. Any new move, random seed, card behavior, or match mode that can grant account rewards must remain replayable and validated server-side before profile currency or mission progress changes. Treat missing legacy snapshots as stale sessions that must restart rather than silently falling back to current content.