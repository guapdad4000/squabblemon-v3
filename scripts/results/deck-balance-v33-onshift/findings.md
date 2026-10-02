# Squabblemon v33 deck balance findings

**Full audit: BLOCKED.** 3392 unique cases attempted; 3374 completed and 18 engine failures.
**Accepted primary sample:** 2,112 round-robin matches plus 192 dedicated diner-counter matches, with zero failures and complete case sets.
All nine saved ten-card decks plus three benchmark crews; six additional counter crews for the diner.
Two deterministic bots (greedy one-play-ahead / seeded legal), both seats, base / fully upgraded cards.
Primary schedule: two district seeds × two draw rotations. Diner confirmation: four separate district seeds × two different rotations; no tuning between phases.
**Score % means wins plus half draws. These are bot samples, not live player win rates or isolated card-strength estimates.**

## Complete twelve-crew round robin

| Crew | Games | Wins / losses / draws | Score % | Greedy | Seeded legal | Base | Upgraded |
|---|---:|---|---:|---:|---:|---:|---:|
| Wonderland Return | 352 | 289 / 47 / 16 | 84.4% | 87.8% | 81.0% | 86.6% | 82.1% |
| SQUABBLEHOUSE SHIFT | 352 | 238 / 92 / 22 | 70.7% | 76.4% | 65.1% | 76.1% | 65.3% |
| The Wiz | 352 | 233 / 94 / 25 | 69.7% | 75.3% | 64.2% | 72.2% | 67.3% |
| VOLTAGE IN MOTION | 352 | 206 / 118 / 28 | 62.5% | 59.4% | 65.6% | 59.7% | 65.3% |
| Fire and GUAP | 352 | 200 / 129 / 23 | 60.1% | 65.6% | 54.5% | 72.2% | 48.0% |
| RECEIPTS | 352 | 142 / 173 / 37 | 45.6% | 48.3% | 42.9% | 43.8% | 47.4% |
| GOOD VIBES ONLY | 352 | 125 / 188 / 39 | 41.1% | 40.6% | 41.5% | 38.6% | 43.5% |
| SLIDE THRU | 352 | 119 / 195 / 38 | 39.2% | 33.0% | 45.5% | 34.9% | 43.5% |
| THE BLOCK IS HOT | 352 | 113 / 205 / 34 | 36.9% | 39.8% | 34.1% | 38.6% | 35.2% |
| CRASHOUT SEASON | 352 | 113 / 215 / 24 | 35.5% | 34.9% | 36.1% | 35.8% | 35.2% |
| COMPOUND INTEREST | 352 | 84 / 239 / 29 | 28.0% | 21.9% | 34.1% | 20.5% | 35.5% |
| WHO YOU KNOW | 352 | 74 / 241 / 37 | 26.3% | 17.0% | 35.5% | 21.0% | 31.5% |

First-seat score 42.6%; second-seat score 57.4% across 2112 games. This is a policy/rules interaction to review, not proof of a live player advantage.

## Diner against seventeen opponents

Every primary row below is a complete 32-game block. Combined rates use 96 games only where all 64 fresh confirmation cases also completed successfully. Incomplete confirmation blocks have no accepted rate.

| Opponent | Primary score (32 games) | Combined score (96 games) | Fresh score (64 games) | Failures |
|---|---:|---:|---:|---:|
| Wonderland Return | 34.4% | 33.3% | 32.8% | 0 |
| Counterplay — Dark Control | 62.5% | 57.8% | 55.5% | 0 |
| Fire and GUAP | 51.6% | 59.4% | 63.3% | 0 |
| GOOD VIBES ONLY | 78.1% | BLOCKED | BLOCKED | 1 |
| The Wiz | 59.4% | 61.5% | 62.5% | 0 |
| VOLTAGE IN MOTION | 68.8% | 62.5% | 59.4% | 0 |
| Cellblock Lane Sequence | 70.3% | 66.7% | 64.8% | 0 |
| RECEIPTS | 65.6% | BLOCKED | BLOCKED | 3 |
| Sherlock and Watson | 62.5% | BLOCKED | BLOCKED | 1 |
| Earth Tax and Finishers | 62.5% | BLOCKED | BLOCKED | 3 |
| Poison Entry Punishment | 78.1% | BLOCKED | BLOCKED | 1 |
| SLIDE THRU | 82.8% | BLOCKED | BLOCKED | 2 |
| WHO YOU KNOW | 89.1% | BLOCKED | BLOCKED | 2 |
| THE BLOCK IS HOT | 81.3% | BLOCKED | BLOCKED | 3 |
| CRASHOUT SEASON | 81.3% | BLOCKED | BLOCKED | 2 |
| Late Scaling | 81.3% | 85.4% | 87.5% | 0 |
| COMPOUND INTEREST | 85.9% | 87.0% | 87.5% | 0 |

## Rework priorities

1. **Fix the Subway ride crash before balance changes.** All failures use the fresh-04 district set (Underground Ring / Waff-L House / The Subway). The shared play-resolution path reads the rider after movement even when it has been removed. Failed cases are not wins, losses, or draws.
2. **Review Wonderland Return before nerfing the diner.** It scored 84.4% across the same 352-game league schedule and beat the diner consistently on both primary and fresh schedules. Inspect return/payoff/finisher interactions with isolated tests before choosing a specific card change.
3. **Rework the Who You Know and Compound Interest recipes/payoffs.** They scored 26.3% and 28.0% respectively in this field, with low scores under both policies. Distinguish advanced recipe improvements from changes to tutorial-owned starter cards.
4. **Monitor Manager scaling, not a blanket diner nerf.** The diner is strong versus starter recipes but remains countered by Wonderland. Peak Hands include all buffs, not just its staff aura; no individual-card ablation was performed.

## Diner observations — complete primary sample only

| Card | Games played / 544 available | Present at end | Average final Hands if present |
|---|---:|---:|---:|
| squabble-house-manager | 541 / 544 | 539 | 10.61 |
| squabblehouse-bus-boy | 533 / 544 | 509 | 5.85 |
| squabblehouse-cashier | 431 / 544 | 427 | 6.63 |
| squabblehouse-security | 412 / 544 | 411 | 6.73 |
| squabblehouse-teknician | 399 / 544 | 398 | 7.12 |
| griddle-master | 405 / 544 | 394 | 5.42 |
| inmate-reformed | 413 / 544 | 409 | 6.80 |
| janitor | 290 / 544 | 290 | 5.25 |
| waffle-warlord | 392 / 544 | 392 | 6.39 |
| sideofhands | 393 / 544 | 2 | 0.00 |

Manager: played in 541 complete primary games; average peak 11.52 Hands, of which 5.61 were ongoing. Maxima 21 total / 7 ongoing. Descriptive observations, not causal contribution or ability reliability.

## Failed cases

- confirmation|seeded-legal|starter-squabblehouse-shift|starter-combo|deck-balance-v33-onshift-fresh-04|2|0|a-player: TypeError: Cannot read properties of undefined (reading 'lane')
- confirmation|greedy|starter-squabblehouse-shift|starter-combo|deck-balance-v33-onshift-fresh-04|2|0|b-player: TypeError: Cannot read properties of undefined (reading 'lane')
- confirmation|greedy|starter-squabblehouse-shift|starter-receipts|deck-balance-v33-onshift-fresh-04|2|0|b-player: TypeError: Cannot read properties of undefined (reading 'lane')
- confirmation|seeded-legal|starter-squabblehouse-shift|starter-crashout|deck-balance-v33-onshift-fresh-04|2|0|b-player: TypeError: Cannot read properties of undefined (reading 'lane')
- confirmation|seeded-legal|starter-squabblehouse-shift|starter-block|deck-balance-v33-onshift-fresh-04|2|3|a-player: TypeError: Cannot read properties of undefined (reading 'lane')
- confirmation|greedy|starter-squabblehouse-shift|starter-receipts|deck-balance-v33-onshift-fresh-04|2|3|a-player: TypeError: Cannot read properties of undefined (reading 'lane')
- confirmation|seeded-legal|starter-squabblehouse-shift|starter-crashout|deck-balance-v33-onshift-fresh-04|2|3|a-player: TypeError: Cannot read properties of undefined (reading 'lane')
- confirmation|seeded-legal|starter-squabblehouse-shift|starter-vibes|deck-balance-v33-onshift-fresh-04|2|3|a-player: TypeError: Cannot read properties of undefined (reading 'lane')
- confirmation|greedy|starter-squabblehouse-shift|focus-detective|deck-balance-v33-onshift-fresh-04|2|3|a-player: TypeError: Cannot read properties of undefined (reading 'lane')
- confirmation|greedy|starter-squabblehouse-shift|focus-poison-entry|deck-balance-v33-onshift-fresh-04|2|3|a-player: TypeError: Cannot read properties of undefined (reading 'lane')
- confirmation|greedy|starter-squabblehouse-shift|starter-block|deck-balance-v33-onshift-fresh-04|2|3|b-player: TypeError: Cannot read properties of undefined (reading 'lane')
- confirmation|seeded-legal|starter-squabblehouse-shift|starter-receipts|deck-balance-v33-onshift-fresh-04|2|3|b-player: TypeError: Cannot read properties of undefined (reading 'lane')
- confirmation|greedy|starter-squabblehouse-shift|focus-earth-tax|deck-balance-v33-onshift-fresh-04|7|0|a-player: TypeError: Cannot read properties of undefined (reading 'lane')
- confirmation|seeded-legal|starter-squabblehouse-shift|focus-earth-tax|deck-balance-v33-onshift-fresh-04|7|0|a-player: TypeError: Cannot read properties of undefined (reading 'lane')
- confirmation|greedy|starter-squabblehouse-shift|starter-slide|deck-balance-v33-onshift-fresh-04|7|0|b-player: TypeError: Cannot read properties of undefined (reading 'lane')
- confirmation|greedy|starter-squabblehouse-shift|starter-block|deck-balance-v33-onshift-fresh-04|7|3|a-player: TypeError: Cannot read properties of undefined (reading 'lane')
- confirmation|seeded-legal|starter-squabblehouse-shift|starter-slide|deck-balance-v33-onshift-fresh-04|7|3|a-player: TypeError: Cannot read properties of undefined (reading 'lane')
- confirmation|seeded-legal|starter-squabblehouse-shift|focus-earth-tax|deck-balance-v33-onshift-fresh-04|7|3|a-player: TypeError: Cannot read properties of undefined (reading 'lane')

## Evidence and limits

- Exact source fingerprint, rosters, planned axes and case keys are saved in plan.json.
- All eight worker files retain raw results and failures. Analysis verifies complete attempted coverage, unique keys and runtime axes.
- Any incomplete matchup confirmation is explicitly blocked; no failed cases are counted as losses or hidden.
- The bots enumerate card plays/SQUABBLE and ability-driven movement, not all deliberate movement strategy or human planning.
- No gameplay, balance values, saved recipes, starter cards, database, Git release or published app was changed.
- Source SHA-256: f9bfa32d48e5d06ed2fba8ba7193c58b243510794ab7c23b50958f4a78a117ab.
