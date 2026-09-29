---
name: Card buff constraints
description: Hidden limits to respect when buffing card stats.
---

Printed Hands must stay at or below cost+1 (cardBalance test; few named exceptions). Starter-deck cards (e.g. Snow Bunny) drive the recorded tutorial voice lines, so buffing them changes which card the guided match tells you to tap. Any authoritative card change must bump CARD_BALANCE_VERSION (and ONLINE_RULES_VERSION when abilities change).

**Why:** A buff pass hit all three: power-cap test failures, tutorial line mismatch, and review flagged reward replay under stale balance.

**How to apply:** Buff low-cost cards through ability numbers rather than Hands; leave starter cards alone; bump versions in the same change.
