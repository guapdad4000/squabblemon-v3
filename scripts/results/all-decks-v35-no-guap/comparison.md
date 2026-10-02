# GUAP-free rankings after elemental hand bonuses

Rules 35; previous comparison rules 34.
37 unchanged ten-card decks; 10,656 fresh matches; 576 games per deck; 16 games per pair; zero simulation failures or reused results.
Two bot policies, two fixed seeds, base and fully upgraded tiers, and both seats. All ordered rosters, case inputs and SQUABBLE settings match the prior GUAP-free run.

## Full before-and-after ranking

| Rank | Deck | Previous rank | Score | Previous score | Change | W/L/D |
|---:|---|---:|---:|---:|---:|---|
| 1 | Air | 10 | 77.95% | 58.94% | +19.01 pp | 433/111/32 |
| 2 | Water | 1 | 77.60% | 80.56% | -2.95 pp | 433/115/28 |
| 3 | Mushroom Garden | 2 | 75.69% | 77.26% | -1.56 pp | 413/117/46 |
| 4 | SQUABBLEHOUSE SHIFT | 3 | 74.31% | 76.91% | -2.60 pp | 411/131/34 |
| 5 | Wonderland Return | 4 | 73.00% | 76.22% | -3.21 pp | 394/129/53 |
| 6 | Cellblock Pressure | 5 | 69.53% | 71.96% | -2.43 pp | 373/148/55 |
| 7 | Dark | 13 | 68.32% | 56.60% | +11.72 pp | 368/157/51 |
| 8 | Electric | 6 | 67.19% | 70.05% | -2.86 pp | 364/166/46 |
| 9 | Light | 11 | 65.63% | 58.42% | +7.20 pp | 351/171/54 |
| 10 | Blood / Red Set | 8 | 63.02% | 64.41% | -1.39 pp | 337/187/52 |
| 11 | The Wiz | 7 | 62.59% | 66.58% | -3.99 pp | 336/191/49 |
| 12 | Earth | 18 | 62.24% | 52.52% | +9.72 pp | 337/196/43 |
| 13 | Counterplay — Dark Control | 12 | 61.02% | 57.99% | +3.04 pp | 324/197/55 |
| 14 | Wave 7 Legends | 9 | 56.60% | 59.64% | -3.04 pp | 290/214/72 |
| 15 | Earth Tax and Finishers | 19 | 56.42% | 52.17% | +4.25 pp | 299/225/52 |
| 16 | Air Bond | 15 | 52.69% | 54.77% | -2.08 pp | 276/245/55 |
| 17 | Sherlock and Watson | 17 | 52.52% | 53.91% | -1.39 pp | 273/244/59 |
| 18 | VOLTAGE IN MOTION | 16 | 52.00% | 54.34% | -2.34 pp | 273/250/53 |
| 19 | Cellblock Lane Sequence | 14 | 51.56% | 55.64% | -4.08 pp | 271/253/52 |
| 20 | Plant | 20 | 50.00% | 50.17% | -0.17 pp | 262/262/52 |
| 21 | Poison Entry Punishment | 21 | 47.57% | 46.96% | +0.61 pp | 241/269/66 |
| 22 | Fire | 23 | 45.23% | 46.18% | -0.95 pp | 234/289/53 |
| 23 | Cellblock — No Kingpin | 21 | 44.62% | 46.96% | -2.34 pp | 228/290/58 |
| 24 | Poison | 25 | 43.14% | 41.49% | +1.65 pp | 219/298/59 |
| 25 | Fire Pressure | 24 | 42.36% | 45.05% | -2.69 pp | 215/303/58 |
| 26 | THE BLOCK IS HOT | 26 | 38.80% | 41.32% | -2.52 pp | 188/317/71 |
| 27 | Crip / Blue Set | 27 | 38.11% | 39.41% | -1.30 pp | 197/334/45 |
| 28 | RECEIPTS | 29 | 35.76% | 36.89% | -1.13 pp | 174/338/64 |
| 29 | Demario and Luigion | 28 | 35.33% | 37.24% | -1.91 pp | 180/349/47 |
| 30 | GOOD VIBES ONLY | 30 | 32.99% | 33.42% | -0.43 pp | 164/360/52 |
| 31 | Counterplay | 31 | 31.25% | 33.25% | -2.00 pp | 150/366/60 |
| 32 | CRASHOUT SEASON | 32 | 30.03% | 31.68% | -1.65 pp | 145/375/56 |
| 33 | Late Scaling | 33 | 27.17% | 28.91% | -1.74 pp | 128/391/57 |
| 34 | SLIDE THRU | 34 | 23.87% | 25.26% | -1.39 pp | 116/417/43 |
| 35 | WHO YOU KNOW | 35 | 22.31% | 23.52% | -1.22 pp | 105/424/47 |
| 36 | Wave 7 Tempo | 36 | 21.27% | 22.40% | -1.13 pp | 101/432/43 |
| 37 | COMPOUND INTEREST | 37 | 20.31% | 21.01% | -0.69 pp | 91/433/52 |

## Interpretation

- Fixed-deck bot results, not player win rates or optimized deck strength.
- Score is (wins + half draws) / games.
- Two identical seeded schedules are reused for comparability; this is not a new holdout.
- All ten live types have a carrier, but these frozen rosters contain neither GUAP nor Barber Bro; Fire and Normal bonuses are not tested here.
- Carrier membership is not activation telemetry; changes do not isolate a single card effect.

## Hand-bonus roster coverage

- Fire: GUAP — Excluded from all test decks at the user’s request.
- Water: Gas Station Sushi Chef — Water
- Electric: Pirate Radio DJ — Electric
- Light: Abuela — Light
- Plant: Rooftop Gardener — Plant, Mushroom Garden
- Earth: Torta — Earth Tax and Finishers, Earth
- Air: The Flight Plug — Air
- Dark: Gamer — WHO YOU KNOW, COMPOUND INTEREST, Counterplay — Dark Control, Dark
- Poison: Nail Tech — Poison Entry Punishment, Poison
- Normal: Barber Bro — Normal bonus is live, but none of the frozen comparison decks contains Barber Bro.

## Seed check: overall top two

- all-decks-ranking-fresh-a:
  - Air: rank 5, 71.35% (194/71/23; 288 games).
  - Water: rank 1, 78.30% (218/55/15; 288 games).
- all-decks-ranking-fresh-b:
  - Air: rank 1, 84.55% (239/40/9; 288 games).
  - Water: rank 2, 76.91% (215/60/13; 288 games).

## Evidence checks

- All 16 baseline files retain their original hashes.
- Source hash stayed 2f2060093f84c46998ed52ff3e06e3c9a70ade5415254c348b3b0aa6d6c0dc05.
- 8 independently rerun cases exactly reproduce their saved outcomes.
- 756 match winners/draw outcomes differ from the baseline.
- 4800 cases contain no newly buffed carrier in either roster; 0 of those have changed result records.
- Raw workers, plan, engine/catalog snapshot, source fingerprints, carrier coverage, policy/tier/seat splits and complete matchups are saved alongside this report.
