# Current deck balance audit — approved diner rules v33

- 3,392 unique successful matches; zero simulation failures.
- All nine authored ten-card saved recipes; Wonderland, The Wiz, Fire/GUAP round robin; six extra counter crews.
- Greedy one-play-ahead and seeded-legal bots; SQUABBLE enabled for legal character plays.
- Base and fully upgraded ability tiers; both seats. Primary: two new district seeds, rotations 0/5.
- Diner confirmation: four untouched district seeds, rotations 2/7. No tuning between phases.
- Score percentage = wins + half draws. These are bot samples, not live player win rates.
- Source SHA-256: 8c429a01fc75dbec7086da879b00ee837db90bebf9b0c899d86aa6d42ad8c732. No deck, database or balance values changed; corrected engine/harness source identity is bound above.

## Twelve-crew round robin

| Crew | Games | Win % | Score % | Greedy | Seeded legal | Base | Upgraded | First | Second |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Wonderland Return | 352 | 82.1% | 84.4% | 87.8% | 81.0% | 86.6% | 82.1% | 79.8% | 88.9% |
| SQUABBLEHOUSE SHIFT | 352 | 67.6% | 70.7% | 76.4% | 65.1% | 76.1% | 65.3% | 65.3% | 76.1% |
| The Wiz | 352 | 66.2% | 69.7% | 75.3% | 64.2% | 72.2% | 67.3% | 62.2% | 77.3% |
| VOLTAGE IN MOTION | 352 | 58.5% | 62.5% | 59.4% | 65.6% | 59.7% | 65.3% | 55.4% | 69.6% |
| Fire and GUAP | 352 | 56.8% | 60.1% | 65.6% | 54.5% | 72.2% | 48.0% | 53.1% | 67.0% |
| RECEIPTS | 352 | 40.3% | 45.6% | 48.3% | 42.9% | 43.8% | 47.4% | 35.2% | 56.0% |
| GOOD VIBES ONLY | 352 | 35.5% | 41.1% | 40.6% | 41.5% | 38.6% | 43.5% | 33.5% | 48.6% |
| SLIDE THRU | 352 | 33.8% | 39.2% | 33.0% | 45.5% | 34.9% | 43.5% | 31.8% | 46.6% |
| THE BLOCK IS HOT | 352 | 32.1% | 36.9% | 39.8% | 34.1% | 38.6% | 35.2% | 24.7% | 49.1% |
| CRASHOUT SEASON | 352 | 32.1% | 35.5% | 34.9% | 36.1% | 35.8% | 35.2% | 25.9% | 45.2% |
| COMPOUND INTEREST | 352 | 23.9% | 28.0% | 21.9% | 34.1% | 20.5% | 35.5% | 23.0% | 33.0% |
| WHO YOU KNOW | 352 | 21.0% | 26.3% | 17.0% | 35.5% | 21.0% | 31.5% | 21.3% | 31.3% |

## Diner versus seventeen opponents, primary plus fresh confirmation

| Opponent | Games | Wins / losses / draws | Score % | Primary | Fresh | Greedy base | Greedy upgraded | Seeded base | Seeded upgraded |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|
| Wonderland Return | 96 | 29 / 61 / 6 | 33.3% | 34.4% | 32.8% | 35.4% | 33.3% | 25.0% | 39.6% |
| Counterplay — Dark Control | 96 | 54 / 39 / 3 | 57.8% | 62.5% | 55.5% | 62.5% | 72.9% | 52.1% | 43.8% |
| Fire and GUAP | 96 | 52 / 34 / 10 | 59.4% | 51.6% | 63.3% | 45.8% | 72.9% | 47.9% | 70.8% |
| GOOD VIBES ONLY | 96 | 56 / 34 / 6 | 61.5% | 78.1% | 53.1% | 70.8% | 52.1% | 60.4% | 62.5% |
| The Wiz | 96 | 55 / 33 / 8 | 61.5% | 59.4% | 62.5% | 72.9% | 54.2% | 50.0% | 68.8% |
| VOLTAGE IN MOTION | 96 | 56 / 32 / 8 | 62.5% | 68.8% | 59.4% | 89.6% | 68.8% | 62.5% | 29.2% |
| RECEIPTS | 96 | 59 / 27 / 10 | 66.7% | 65.6% | 67.2% | 77.1% | 64.6% | 66.7% | 58.3% |
| Cellblock Lane Sequence | 96 | 61 / 29 / 6 | 66.7% | 70.3% | 64.8% | 75.0% | 60.4% | 68.8% | 62.5% |
| Sherlock and Watson | 96 | 63 / 28 / 5 | 68.2% | 62.5% | 71.1% | 87.5% | 72.9% | 52.1% | 60.4% |
| Earth Tax and Finishers | 96 | 66 / 22 / 8 | 72.9% | 62.5% | 78.1% | 68.8% | 79.2% | 64.6% | 79.2% |
| Poison Entry Punishment | 96 | 70 / 18 / 8 | 77.1% | 78.1% | 76.6% | 89.6% | 87.5% | 79.2% | 52.1% |
| SLIDE THRU | 96 | 72 / 18 / 6 | 78.1% | 82.8% | 75.8% | 91.7% | 79.2% | 87.5% | 54.2% |
| THE BLOCK IS HOT | 96 | 74 / 16 / 6 | 80.2% | 81.3% | 79.7% | 95.8% | 75.0% | 70.8% | 79.2% |
| WHO YOU KNOW | 96 | 75 / 16 / 5 | 80.7% | 89.1% | 76.6% | 100.0% | 87.5% | 89.6% | 45.8% |
| CRASHOUT SEASON | 96 | 78 / 11 / 7 | 84.9% | 81.3% | 86.7% | 93.8% | 77.1% | 81.3% | 87.5% |
| Late Scaling | 96 | 81 / 13 / 2 | 85.4% | 81.3% | 87.5% | 100.0% | 97.9% | 91.7% | 52.1% |
| COMPOUND INTEREST | 96 | 81 / 10 / 5 | 87.0% | 85.9% | 87.5% | 100.0% | 95.8% | 89.6% | 62.5% |

## Diner card observations (descriptive, not causal)

| Card | Games played / available | Play % | Games present at end | Average final Hands if present |
|---|---:|---:|---:|---:|
| squabble-house-manager | 1622 / 1632 | 99.4% | 1616 | 10.81 |
| squabblehouse-bus-boy | 1603 / 1632 | 98.2% | 1529 | 6.00 |
| squabblehouse-cashier | 1469 / 1632 | 90.0% | 1455 | 6.43 |
| squabblehouse-security | 1230 / 1632 | 75.4% | 1226 | 7.14 |
| squabblehouse-teknician | 1142 / 1632 | 70.0% | 1141 | 7.24 |
| griddle-master | 1281 / 1632 | 78.5% | 1252 | 5.81 |
| inmate-reformed | 1216 / 1632 | 74.5% | 1204 | 7.00 |
| janitor | 870 / 1632 | 53.3% | 870 | 5.49 |
| waffle-warlord | 1069 / 1632 | 65.5% | 1067 | 6.62 |
| sideofhands | 1312 / 1632 | 80.4% | 3 | 0.00 |

Manager: played in 1622 games; mean peak 11.82 Hands / 5.63 ongoing; maxima 25 Hands / 7 ongoing.

Raw worker files retain exact case keys, outcomes, per-card observations and diner event evidence. Full Cartesian completeness and source identity are checked when merging.
