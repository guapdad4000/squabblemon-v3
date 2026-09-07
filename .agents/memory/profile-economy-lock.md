---
name: Profile economy lock
description: Why all inventory reads that normalize data and all reward mutations serialize on the player profile row.
---

Any operation that normalizes or mutates owned cards, discovered cards, variants, currencies, pity, collection progress, or saved decks must hold the same player-profile row lock for its read-modify-write sequence.

**Why:** A write-on-read normalization can otherwise read stale inventory, race a pack or milestone transaction, and commit afterward—silently erasing a legitimately granted reward.

**How to apply:** When adding a new profile-backed economy or collection operation, serialize it on the profile row and include a concurrent regression test when it can overlap bootstrap reads or another reward flow.