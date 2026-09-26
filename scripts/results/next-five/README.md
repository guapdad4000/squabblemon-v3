# Five-card follow-up audit

Current card rules tested at `083b3570b91785d3490ff6112a47b8c8e95166c9` (rules/balance version 10). No new card buffs were applied. Hooper and BBL Demon remain unchanged and were excluded as candidates at the user's request.

## Method

960 deterministic bot games: five subjects × two variants × three opponents × two seeds × two deck rotations × two training tiers × two seats × two policies. Each subject and its same-cost replacement occupy the same slot in a fixed nine-card shell. Shared `orderKey` preserves index shuffle between variants. Each policy/variant has 48 games per subject.

Opponents: `focus-fire-guap`, `focus-air-bond`, and `focus-counterplay-coherent`. Seeds: `next-five-a-20260926` and `next-five-b-20260926`; rotations 0 and 5; tiers 0 and 3; both seats; SQUABBLE enabled. Policies: greedy and seeded-legal. Full deck lists and per-match results are in [greedy.json](greedy.json) and [seeded.json](seeded.json).

Reproduce from the repository root:

```sh
pnpm run typecheck:libs
pnpm --filter @workspace/scripts exec tsx src/next-five-audit.ts
pnpm --filter @workspace/scripts exec tsx src/next-five-audit.ts --seeded
```

## Deck scores

Score counts a draw as half a win. These are small, policy-dependent bot samples, not live win rates or isolated estimates of an ability's strength.

| Candidate | Same-cost replacement | Greedy candidate | Greedy replacement | Seeded candidate | Seeded replacement |
| --- | --- | ---: | ---: | ---: | ---: |
| Failed Rapper | Mural Apprentice | 40.6% | 43.8% | 41.7% | 38.5% |
| Dance Circle Captain | Promoter | 22.9% | 20.8% | 42.7% | 38.5% |
| Ahki | Nail Tech | 28.1% | 25.0% | 32.3% | 31.2% |
| Chess Regular | Red Pill | 34.4% | 34.4% | 40.6% | 38.5% |
| Rent-a-Cop | Sugarfoot | 36.5% | 34.4% | 50.0% | 51.0% |

## Untrained ability use

Tier 0 only, combined across policies. Setups count unique created marks; Captain counts armed source/round pairs instead. Resolution is distinct from an observed beneficial replay delta.

| Candidate | Deployments | Setups / armed rounds | Resolutions | Observed benefit events |
| --- | ---: | ---: | ---: | ---: |
| Failed Rapper | 36 | 36 | 16 | 16 |
| Dance Circle Captain | 48 | 18 | 1 | 1 |
| Ahki | 48 | 32 | 1 | 1 |
| Chess Regular | 27 | 20 | 18 | 14 |
| Rent-a-Cop | 45 | 45 | 6 | 5 |

The observer reads settled match events, including the final round. Benefit counts inspect friendly positive power changes or enemy negative power/removal in the resolution replay, excluding upgrade events. Nested reactions can obscure attribution, particularly with training; these counts are diagnostic, not comprehensive ability-value measurements. A resolution can be shielded: one inspected greedy Chess fork hit Honest Thot's Watch protection rather than reducing enemy Hands. Movement denial also has value without a warning firing.

## Decisions

- **Dance Circle Captain: prototype a more usable combo.** Only one payout in 18 armed rounds. Let a different non-dancer ally follow the first dancer to earn the existing once-per-round +2. Its deck outperformed the replacement in these samples, so this is an identity/accessibility issue rather than evidence for more stats.
- **Ahki: prototype a less demanding loyalty route.** Only one completed return from 32 setups. Test a bounded first-departure benefit or easier return condition before raising the final reward. Deck scores do not demonstrate weakness against Nail Tech.
- **Failed Rapper: hold numbers.** Verse paid in 16 of 36 setups and swap results changed direction between policies. Movement collection can remain a later experiment.
- **Chess Regular: hold damage.** Most armed forks resolved. Early setup and blocked hits explain more than insufficient damage; no consistent deck-score deficit appeared.
- **Rent-a-Cop: hold pending matchup-specific evidence.** Warnings mostly resolve against movement. Across all tiers, the greedy Air matchup produced two resolutions versus zero against Fire; seeded Air produced seven versus one against Fire. Low trigger counts against stationary decks alone do not justify a blanket buff.

## Verification

202 focused creative-rework and balance tests passed, including ten new owner-symmetric restriction checks and a completed-match observer parity test. Library and scripts TypeScript checks passed. No card definitions, gameplay effect implementations, or rules versions changed.
