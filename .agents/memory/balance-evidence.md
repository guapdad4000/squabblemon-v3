---
name: Balance evidence
description: Keep engine balance comparisons separate from deck-composition experiments and player win-rate claims.
---

Treat the element audit as evidence about hand-picked crews under two limited bot policies, not optimized element strength or live player win rates. Preserve the same decks, seats, district seeds, rotations, upgrade tiers, and policy when comparing mechanics; evaluate replacement decks separately.

**Why:** The audit crews were assembled for broad element coverage, not supplied or endorsed as optimal decks. A small single-seed subset gave substantially different rankings from the full schedule, and replacing cards changes curve and synergy as well as the individual ability being investigated.

**How to apply:** Keep versioned baselines, state the per-crew sample size and policy, disclose that draws count as half a point, and report failed simulations explicitly. Do not use a stronger replacement deck to claim the engine patch improved the original crew, or infer a card's causal strength from an unmatched replacement.

Inspect finalized runtime cards and their actual trigger eligibility before diagnosing an ability; an original expansion row is not necessarily the playable kit.

**Why:** Balance investigations repeatedly attributed strength to hand bonds already removed by creative reworks, and to older abilities that the loaded catalog no longer used.

**How to apply:** Query the assembled card data for the exact audit crew, then inspect the corresponding live engine branch. Verify that a proposed target is actually in the fixed comparison crew before predicting its effect on that crew's results.