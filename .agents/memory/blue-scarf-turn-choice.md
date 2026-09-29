---
name: Blue Scarf turn choice
description: Why Blue Scarf crashout uses a shared turn-level random choice for moved allies.
---

Blue Scarf crashout's give-or-steal option is a random 50/50 choice **each turn**, shared by the allies it moves that turn.

**Why:** The user explicitly clarified “Random 50/50 each turn” when the original move wording left the choice unspecified. Independent per-ally rolls or a fixed alternation would change the agreed behavior.

**How to apply:** Preserve one deterministic, replay-safe choice for each trigger. On a three-district street, “one district over” means an adjacent district, not wrapping directly between the two outer districts.