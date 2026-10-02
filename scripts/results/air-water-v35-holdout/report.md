# Air and Water — fresh-seed field check

4544 unique fresh matches; 2304 games per subject; zero failures.
Same v35 cards, ordered decks, policies, tiers, rotation and seats as the original GUAP-free ranking. Only the seed labels changed.

| Deck | All opponents | Shared field | Head-to-head | W/L/D (all) |
|---|---:|---:|---:|---|
| Air | 72.70% | 73.46% | 46.09% | 1603/557/144 |
| Water | 73.70% | 74.26% | 53.91% | 1627/535/142 |

Air minus Water: -1.00 percentage points.
Seed leads: Air 4; Water 4; tied 0.

## Per-seed score

| Seed | Air | Water | Air minus Water (points) |
|---|---:|---:|---:|
| air-water-v35-holdout-01 | 73.26% | 65.97% | 7.29 |
| air-water-v35-holdout-02 | 68.23% | 72.40% | -4.17 |
| air-water-v35-holdout-03 | 75.87% | 72.92% | 2.95 |
| air-water-v35-holdout-04 | 70.66% | 80.73% | -10.07 |
| air-water-v35-holdout-05 | 73.26% | 62.50% | 10.76 |
| air-water-v35-holdout-06 | 73.78% | 84.72% | -10.94 |
| air-water-v35-holdout-07 | 76.91% | 81.94% | -5.03 |
| air-water-v35-holdout-08 | 69.62% | 68.40% | 1.22 |

## Scope and limitations

- Fixed-deck bot comparison on eight predeclared fresh seed labels; no gameplay or roster changes and no tuning between seeds.
- Only Air and Water are tested against the field. This does not rerank all 37 decks or establish an overall best deck.
- Score is (wins + half draws) / games, not a player win rate. Repeated policy/tier/seat cases are not independent human samples.
- Seed labels change districts, deck shuffles and seeded-policy choices. New labels need not yield unique district layouts; observed ordered layouts are recorded per seed.
- The 35 shared opponents are also reported separately from the Air–Water head-to-head; the shared match is simulated only once.
- GUAP is excluded. These frozen rosters contain no Barber Bro, so Normal’s hand bonus is not measured.
- Bot movement choices are not optimized; ability-driven movement still runs.

Engine source hash: 2f2060093f84c46998ed52ff3e06e3c9a70ade5415254c348b3b0aa6d6c0dc05
Harness hash: 5a784d72c46f54dbbbdb33f470720f66f4d3dc7cb940887a87eae1431ceb5dc1
Plan hash: 9dbaf385d334745ea6f233bb55b951a915821dd196eee8b5a52e7beb86676ac1

The plan binds all original baseline file hashes. Workers and reporting reject any source, plan, roster or baseline change.
Policy, tier and seat splits are in summary.csv; all 36 opponent records for each subject are in matchups.csv.
