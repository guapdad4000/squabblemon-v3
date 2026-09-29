---
name: Balance evidence
description: Keep engine balance comparisons separate from deck-composition experiments and player win-rate claims.
---

Treat the element audit as evidence about hand-picked crews under two limited bot policies, not optimized element strength or live player win rates. Preserve the same decks, seats, district seeds, rotations, upgrade tiers, and policy when comparing mechanics; evaluate replacement decks separately.

**Why:** The audit crews were assembled for broad element coverage, not supplied or endorsed as optimal decks. A small single-seed subset gave substantially different rankings from the full schedule, and replacing cards changes curve and synergy as well as the individual ability being investigated.

**How to apply:** Keep versioned baselines, state the per-crew sample size and policy, disclose that draws count as half a point, and report failed simulations explicitly. Do not use a stronger replacement deck to claim the engine patch improved the original crew, or infer a card's causal strength from an unmatched replacement.

For paired one-card deck replacements, hold the seeded draw-order key fixed across the original and candidate decks.

**Why:** A deck's ID can also seed its card order. Changing both the card and that order makes a same-schedule bot comparison less informative; different filler swaps can reverse the apparent result even when the new card's rules are unchanged.

**How to apply:** Use a shared order key as well as identical seeds, rotations, tiers, seats, and bot policy. Compare the same opponent schedule, and describe outcomes as deck-composition samples rather than isolated card strength.

Treat a fixed bot matchup target as a hypothesis, not a number to tune by repeatedly increasing card power. The policy reacts to changed board values and can choose worse placements; score may fall after an apparent buff, and one seed schedule can pass while a fresh mirrored schedule fails.

**Why:** In Wonderland-versus-Oz return experiments, larger next-play Hands and several stronger-looking synergies worsened results. One setup met the target on a holdout but missed badly on the original schedule, with large player/CPU seat differences.

**How to apply:** Report each seat separately, preserve the opponent and policy, and require a fresh schedule before calling a balance target met. Once a schedule is used to select a card or deck change, treat it as tuning data and reserve another untouched schedule for the final choice. Rerun the comparison after engine corrections that affect upgraded-tier behavior. Prefer retaining a correct printed-rule fix over shipping unrelated buffs selected solely to clear one sample.

Inspect finalized runtime cards and their actual trigger eligibility before diagnosing an ability; an original expansion row is not necessarily the playable kit.

**Why:** Balance investigations repeatedly attributed strength to hand bonds already removed by creative reworks, and to older abilities that the loaded catalog no longer used.

**How to apply:** Query the assembled card data for the exact audit crew, then inspect the corresponding live engine branch. Verify that a proposed target is actually in the fixed comparison crew before predicting its effect on that crew's results.