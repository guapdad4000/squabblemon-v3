# Two-card diner buff: focused paired comparison

## Changes

- Waffle Warlord gives the weakest **other friendly staff** in each staffed district +1 Hand with partial coverage. Full three-district coverage still gives +2; it still excludes itself.
- Griddle Master deals 3 damage, or 5 against an already-burning recipient, instead of 2/4. Protection stripping, 1 Burn, defensive counters, costs, and printed Hands are unchanged.
- Bus Boy, Manager, Security, the rest of the roster, and the canonical diner crew are unchanged.

## Matched results

| Opponent | Before score | Updated score | Change, percentage points | Updated W–L–D |
| --- | ---: | ---: | ---: | ---: |
| Air | 59.4% | 62.5% | +3.1 | 19–11–2 |
| Electric | 48.4% | 46.9% | −1.6 | 12–14–6 |
| Inmate | 59.4% | 54.7% | −4.7 | 14–11–7 |
| Blood / Red | 37.5% | 40.6% | +3.1 | 9–15–8 |
| Crip / Blue | 85.9% | 87.5% | +1.6 | 28–4–0 |

Each opponent has 32 completed matches and zero failures. Score counts a draw as half a win. Across all 160 matches, score changes from 58.1% to 58.4%.

This is a quick, mixed result, **not** evidence of a universal matchup improvement, player win rates, or separately measured causal strength for either card. The Red matchup remains unfavorable in this sample; the Blue matchup remains heavily favorable. Greedy and seeded-legal policies can make different decisions after a numerical buff. No additional changes were selected to chase these scores.

## Provenance and limits

- Controls: `../diner-focused-air-electric-sets/`; original raw evidence was not overwritten.
- The saved control engine/runner fingerprint matched the unmodified current source before either buff.
- The candidate uses balance/rules version 34. All five workers share one verified source fingerprint; each verifies the engine and runner stayed unchanged during simulation.
- Both arms use the exact same deck IDs, card lists/order, policy, seed, rotation, upgrade tier, and seat. Every paired scenario was compared for equality, with 32 unique cases per opponent.
- Schedule per opponent: two policies × two seeds × rotations 0/5 × tiers 0/3 × both seats.
- The runner's only harness change accepts a separate output directory; no schedule or simulation options changed.
- These are reused paired cases, **not a fresh holdout**. Deliberate player movement strategy is not covered; ability-driven movement still runs.
- `comparison.json` records both fingerprints and before/after breakdowns. The five opponent JSON files retain raw outcomes and diner event traces.