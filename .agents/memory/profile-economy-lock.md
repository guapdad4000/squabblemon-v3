---
name: Profile economy lock
description: Why all inventory reads that normalize data and all reward mutations serialize on the player profile row.
---

Any operation that normalizes or mutates owned cards, discovered cards, variants, currencies, pity, collection progress, saved decks, or cadence-based mission state must hold the same player-profile row lock for its read-modify-write sequence.

**Why:** A write-on-read normalization can otherwise erase a legitimately granted reward. Likewise, a mission reset outside the reward lock can reopen an old claim or erase progress earned after the cadence boundary.

**How to apply:** When adding a profile-backed economy, collection, mission reset, or reward operation, serialize it on the profile row and include a concurrent regression test when it can overlap bootstrap reads, cadence changes, or another reward flow.