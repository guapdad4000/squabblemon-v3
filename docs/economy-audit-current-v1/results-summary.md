# Generated numeric results

Model economy-current-v1; seed 408686590; 10,000 independent pack trials per collection/type; 100 journey trials per scenario. See simulation.json for every quantile and balance. No telemetry.

## Rarity mathematics

Per-pack/ten probabilities mean at least one result of that rarity, including duplicates. Effective ten includes guarantee replacement; it is not a new-card guarantee.

| Tier | Cards | Base slot | Single pack | Natural ten | Effective ten | Sole missing card p50/p95 packs |
| --- | --- | --- | --- | --- | --- | --- |
| SuperCommon | 9 | 40.0000% | 92.2240% | 100.0000% | 100.0000% | 1/3 |
| Common | 43 | 20.0000% | 67.2320% | 99.9986% | 99.9986% | 2/7 |
| Uncommon | 28 | 25.0000% | 76.2695% | 99.9999% | 99.9999% | 2/5 |
| Rare | 49 | 12.0000% | 47.2268% | 99.8325% | 99.8561% | 3/12 |
| Epic | 29 | 2.0000% | 9.6079% | 63.5830% | 63.5875% | 17/71 |
| Legendary | 24 | 0.8000% | 3.9365% | 33.0757% | 33.0769% | 41/176 |
| Mythical | 20 | 0.2000% | 0.9960% | 9.5253% | 9.5256% | 162/697 |

## Independent current pack outcomes

Start with zero pity/styles. A ten advances ownership and pity across its ten packs. Means are not guaranteed outcomes.

| Collection | Opening | New cards mean [p05,p50,p95] | Universal mean | Clout mean | Rare+ probability |
| --- | --- | --- | --- | --- | --- |
| new | single | 3.91 [3, 4, 5] | 3.01 | 24.46 | 55.5200% |
| new | ten | 28.85 [24, 29, 34] | 28.04 | 229.05 | 100.0000% |
| mid | single | 3.34 [2, 3, 5] | 3.10 | 24.00 | 56.2300% |
| mid | ten | 23.29 [18, 23, 28] | 28.17 | 228.45 | 100.0000% |
| near | single | 0.01 [0, 0, 0] | 2.94 | 24.52 | 56.3000% |
| near | ten | 0.04 [0, 0, 0] | 28.14 | 228.40 | 100.0000% |
| complete | single | 0.00 [0, 0, 0] | 3.01 | 24.16 | 55.1100% |
| complete | ten | 0.00 [0, 0, 0] | 28.36 | 227.53 | 100.0000% |

## Bonus and finite style supply

| State | Style probability / expected count | Universal EV | Clout EV |
| --- | --- | --- | --- |
| Nominal / first pack at pity 0 | 5.0000% | 3.0000 | 24.3750 |
| Ten packs from pity 0, eligible pool | 1.0987 styles; at least one guaranteed | 28.1093 | 228.3877 |
| Steady eligible single-pack average | 12.4607% | 2.7644 | 22.4608 |
| After pool exhausted | 0% | 3.0000 | 25.6250 |

615 styles; no crafting or paid acquisition. Exhaustion packs mean [p05,p50,p95]: **4935.16 [4812, 4936, 5058]**; analytic mean 4935.54. Maximum 6150 packs, minimum 615; random named gameplay cards have no analogous finite guarantee. Crafting can exhaust styles earlier. Catalog growth changes this boundary.

## Coupled wallet journeys

Save Clout, but open earned tickets. All numbers below are means except the explicit quantiles. New includes finite account/onboarding/Road claims; mature states start zero incremental wallet/XP with those claims already consumed. Casual misses Wednesday/Saturday; engaged logs in daily. 'Online' means no match progression but independent login/shop claims remain.

| Days / cadence / collection | Settlement | Sessions / matches | Clout mean [p05,p50,p95] | Random packs | Owned cards | Account XP | Tracked card XP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 / casual / new | Solo | 1/3 | 1412.05 [1190, 1435, 1525] | 6.00 | 46.01 | 216.65 | 45.75 |
| 1 / casual / new | Online | 1/3 | 698.00 [650, 700, 750] | 4.00 | 40.84 | 0.00 | 0.00 |
| 1 / engaged / new | Solo | 1/3 | 1512.05 [1290, 1535, 1625] | 6.00 | 46.01 | 216.65 | 62.90 |
| 1 / engaged / new | Online | 1/3 | 698.00 [650, 700, 750] | 4.00 | 40.84 | 0.00 | 0.00 |
| 7 / casual / new | Solo | 5/10 | 3181.65 [2785, 3185, 3465] | 8.00 | 51.17 | 484.45 | 156.50 |
| 7 / casual / new | Online | 5/10 | 1148.00 [1100, 1150, 1200] | 4.00 | 40.84 | 0.00 | 0.00 |
| 7 / casual / mid | Solo | 5/10 | 2286.95 [1925, 2310, 2550] | 2.00 | 109.31 | 385.95 | 155.90 |
| 7 / casual / mid | Online | 5/10 | 550.00 [550, 550, 550] | 0.00 | 103.00 | 0.00 | 0.00 |
| 7 / casual / near | Solo | 5/10 | 2286.95 [1925, 2310, 2550] | 2.00 | 201.03 | 385.95 | 155.90 |
| 7 / casual / near | Online | 5/10 | 550.00 [550, 550, 550] | 0.00 | 201.00 | 0.00 | 0.00 |
| 7 / casual / complete | Solo | 5/10 | 2286.95 [1925, 2310, 2550] | 2.00 | 202.00 | 385.95 | 155.90 |
| 7 / casual / complete | Online | 5/10 | 550.00 [550, 550, 550] | 0.00 | 202.00 | 0.00 | 0.00 |
| 7 / engaged / new | Solo | 7/42 | 7279.90 [6630, 7340, 7585] | 10.86 | 57.94 | 1718.60 | 857.30 |
| 7 / engaged / new | Online | 7/42 | 1995.25 [1925, 2000, 2075] | 6.00 | 46.03 | 0.00 | 0.00 |
| 7 / engaged / mid | Solo | 7/42 | 6379.05 [5740, 6455, 6680] | 4.86 | 116.38 | 1603.00 | 854.50 |
| 7 / engaged / mid | Online | 7/42 | 1398.25 [1350, 1400, 1450] | 2.00 | 109.33 | 0.00 | 0.00 |
| 7 / engaged / near | Solo | 7/42 | 6379.05 [5740, 6455, 6680] | 4.86 | 201.04 | 1603.00 | 854.50 |
| 7 / engaged / near | Online | 7/42 | 1398.25 [1350, 1400, 1450] | 2.00 | 201.01 | 0.00 | 0.00 |
| 7 / engaged / complete | Solo | 7/42 | 6379.05 [5740, 6455, 6680] | 4.86 | 202.00 | 1603.00 | 854.50 |
| 7 / engaged / complete | Online | 7/42 | 1398.25 [1350, 1400, 1450] | 2.00 | 202.00 | 0.00 | 0.00 |
| 30 / casual / new | Solo | 22/44 | 11717.80 [10535, 11760, 12350] | 15.90 | 68.49 | 1779.45 | 687.45 |
| 30 / casual / new | Online | 22/44 | 3223.00 [3175, 3225, 3275] | 4.00 | 40.84 | 0.00 | 0.00 |
| 30 / casual / mid | Solo | 22/44 | 10941.10 [9785, 10960, 11790] | 9.95 | 125.92 | 1697.50 | 676.50 |
| 30 / casual / mid | Online | 22/44 | 2625.00 [2625, 2625, 2625] | 0.00 | 103.00 | 0.00 | 0.00 |
| 30 / casual / near | Solo | 22/44 | 10941.10 [9785, 10960, 11790] | 9.95 | 201.03 | 1697.50 | 676.50 |
| 30 / casual / near | Online | 22/44 | 2625.00 [2625, 2625, 2625] | 0.00 | 201.00 | 0.00 | 0.00 |
| 30 / casual / complete | Solo | 22/44 | 10941.10 [9785, 10960, 11790] | 9.95 | 202.00 | 1697.50 | 676.50 |
| 30 / casual / complete | Online | 22/44 | 2625.00 [2625, 2625, 2625] | 0.00 | 202.00 | 0.00 | 0.00 |
| 30 / engaged / new | Solo | 30/180 | 28916.90 [28230, 28895, 29580] | 30.06 | 94.47 | 7021.35 | 3652.80 |
| 30 / engaged / new | Online | 30/180 | 6406.75 [6300, 6400, 6500] | 12.00 | 60.62 | 0.00 | 0.00 |
| 30 / engaged / mid | Solo | 30/180 | 28070.95 [27420, 28100, 28545] | 24.01 | 146.45 | 6933.75 | 3681.05 |
| 30 / engaged / mid | Online | 30/180 | 5818.00 [5725, 5800, 5900] | 8.00 | 122.55 | 0.00 | 0.00 |
| 30 / engaged / near | Solo | 30/180 | 28070.95 [27420, 28100, 28545] | 24.01 | 201.16 | 6933.75 | 3681.05 |
| 30 / engaged / near | Online | 30/180 | 5818.00 [5725, 5800, 5900] | 8.00 | 201.05 | 0.00 | 0.00 |
| 30 / engaged / complete | Solo | 30/180 | 28070.95 [27420, 28100, 28545] | 24.01 | 202.00 | 6933.75 | 3681.05 |
| 30 / engaged / complete | Online | 30/180 | 5818.00 [5725, 5800, 5900] | 8.00 | 202.00 | 0.00 | 0.00 |

## Thirty-day spending tradeoffs: new collection

| Cadence / settlement | Priority | Clout left | Random packs | Owned cards | Training/coaching spent | Card XP / move tier |
| --- | --- | --- | --- | --- | --- | --- |
| casual / Solo | save | 11717.80 | 15.90 | 68.49 | 0.00 | 687.45/0.00 |
| casual / Online | save | 3223.00 | 4.00 | 40.84 | 0.00 | 0.00/0.00 |
| casual / Solo | packs | 105.40 | 81.93 | 137.90 | 0.00 | 662.45/0.00 |
| casual / Online | packs | 102.50 | 21.59 | 80.41 | 0.00 | 0.00/0.00 |
| casual / Solo | training | 7021.02 | 15.90 | 68.49 | 4696.78 | 4500.00/3.00 |
| casual / Online | training | 121.50 | 4.00 | 40.84 | 3101.50 | 3335.00/1.00 |
| engaged / Solo | save | 28916.90 | 30.06 | 94.47 | 0.00 | 3652.80/0.00 |
| engaged / Online | save | 6406.75 | 12.00 | 60.62 | 0.00 | 0.00/0.00 |
| engaged / Solo | packs | 109.55 | 193.69 | 159.47 | 0.00 | 3658.15/0.00 |
| engaged / Online | packs | 99.25 | 47.50 | 115.50 | 0.00 | 0.00/0.00 |
| engaged / Solo | training | 24463.73 | 30.06 | 94.47 | 4453.17 | 4500.00/3.00 |
| engaged / Online | training | 1506.75 | 12.00 | 60.62 | 4900.00 | 4500.00/3.00 |

Training priority deliberately buys Intensive Training aggressively before coaching; it is a spending choice, not an optimum. All three priorities still open earned tickets. Reactions are affordability goals, not automatic purchases in this grid.

## Thirty-day shard balances with Clout saved

Mean balances; **columns cannot be pooled**. 'Other tiers' means unavailable for a Mythical target, not globally useless.

| Cadence / collection / mode | Universal | Common | Uncommon | Rare | Epic | Legendary | Mythical | Other tiers |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| casual/new/Solo | 147.65 | 157.65 | 42.16 | 12.00 | 3.20 | 1.60 | 0.80 | 216.61 |
| casual/new/Online | 66.70 | 26.90 | 4.56 | 1.80 | 1.20 | 0.00 | 0.00 | 34.46 |
| casual/mid/Solo | 77.55 | 96.40 | 40.16 | 24.36 | 7.20 | 4.00 | 3.20 | 172.12 |
| casual/mid/Online | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| casual/near/Solo | 77.55 | 147.85 | 100.72 | 72.48 | 21.00 | 14.00 | 9.60 | 356.05 |
| casual/near/Online | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| casual/complete/Solo | 77.55 | 147.85 | 100.72 | 72.48 | 21.00 | 14.00 | 12.00 | 356.05 |
| casual/complete/Online | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| engaged/new/Solo | 444.60 | 321.40 | 123.84 | 33.48 | 4.00 | 3.20 | 0.00 | 485.92 |
| engaged/new/Online | 186.85 | 110.65 | 26.56 | 9.48 | 2.60 | 0.40 | 0.00 | 149.69 |
| engaged/mid/Solo | 367.60 | 268.65 | 132.88 | 60.48 | 17.40 | 10.80 | 6.40 | 490.21 |
| engaged/mid/Online | 123.70 | 72.15 | 31.52 | 21.00 | 5.40 | 1.60 | 1.60 | 131.67 |
| engaged/near/Solo | 367.60 | 361.70 | 240.48 | 164.40 | 52.00 | 41.60 | 12.00 | 860.18 |
| engaged/near/Online | 123.70 | 118.25 | 81.36 | 59.88 | 17.60 | 9.60 | 1.60 | 286.69 |
| engaged/complete/Solo | 367.60 | 361.70 | 240.48 | 164.40 | 52.00 | 41.60 | 24.80 | 860.18 |
| engaged/complete/Online | 123.70 | 118.25 | 81.36 | 59.88 | 17.60 | 9.60 | 5.60 | 286.69 |

## Chosen finish craft affordability, complete collection

Sequential production packs, matching plus universal only; no competing shard spend. This measures affordability, not time to own: a bonus can grant the chosen finish earlier. Match/session equivalents use full-price packs, 62 Clout per mixed solo match, two matches/session; ignore rebates and claims.

| Tier | Cost | Packs mean [p05,p50,p95] | Matches p50/p95 | Sessions p50/p95 | Other-tier shards mean |
| --- | --- | --- | --- | --- | --- |
| Common | 80 | 4.87 [4, 5, 7] | 17/23 | 9/12 | 104.62 |
| Common | 140 | 8.22 [6, 8, 10] | 26/33 | 13/17 | 176.27 |
| Uncommon | 80 | 6.85 [4, 7, 10] | 23/33 | 12/17 | 181.54 |
| Uncommon | 140 | 11.51 [8, 11, 15] | 36/49 | 18/25 | 304.41 |
| Rare | 80 | 8.61 [5, 8, 14] | 26/46 | 13/23 | 249.89 |
| Rare | 140 | 14.68 [9, 14, 21] | 46/68 | 23/34 | 426.74 |
| Epic | 80 | 17.90 [8, 17, 31] | 55/100 | 28/50 | 619.62 |
| Epic | 140 | 30.70 [17, 30, 47] | 97/152 | 49/76 | 1063.78 |
| Legendary | 80 | 20.67 [7, 19, 38] | 62/123 | 31/62 | 723.41 |
| Legendary | 140 | 34.98 [16, 33, 59] | 107/191 | 54/96 | 1224.99 |
| Mythical | 80 | 25.82 [6, 26, 43] | 84/139 | 42/70 | 924.80 |
| Mythical | 140 | 42.16 [17, 43, 67] | 139/217 | 70/109 | 1508.90 |

## Repeat-only affordability

No missions, rebates or one-time grants; expected rate, not stopping-time guarantee. Online match-income equivalents are infinite/unreachable because match income is zero. Online players can still use independent claim income.

| Goal | Clout | Mixed solo matches | Two-match sessions | Six-match sessions |
| --- | --- | --- | --- | --- |
| reaction-pack | 300 | 4.84 | 2.42 | 0.81 |
| reaction-pack:big-city-pigeon:v1 | 400 | 6.45 | 3.23 | 1.08 |
| reaction-pack:dr-fade:v1 | 400 | 6.45 | 3.23 | 1.08 |
| reaction-pack:buddy:v1 | 400 | 6.45 | 3.23 | 1.08 |
| reaction-pack:ashlee:v1 | 400 | 6.45 | 3.23 | 1.08 |
| reaction-pack:buttahs:v1 | 400 | 6.45 | 3.23 | 1.08 |
| reaction-pack:guap:v1 | 400 | 6.45 | 3.23 | 1.08 |
| reaction-pack:cologne-criminal:v1 | 400 | 6.45 | 3.23 | 1.08 |
| reaction-pack:kyle:v1 | 400 | 6.45 | 3.23 | 1.08 |
| reaction-pack:church-auntie:v1 | 400 | 6.45 | 3.23 | 1.08 |
| training-intensive | 225 | 3.63 | 1.81 | 0.60 |
| ticket | 200 | 3.23 | 1.61 | 0.54 |
| common-recruit | 400 | 6.45 | 3.23 | 1.08 |
| ten-pull | 1800 | 29.03 | 14.52 | 4.84 |

Card move prerequisites and cap need both XP and coaching, not only Clout. Cadence is a modeling assumption. Available Intensive Training buys are discrete and only prorate at cap. The smaller 100-Clout session is sufficient for level 2; this table explicitly prices an Intensive-only strategy.

| Participation | Level / XP | Mixed matches | Two-match sessions | Six-match sessions | Intensive-only Clout from zero | Cumulative coaching Clout |
| --- | --- | --- | --- | --- | --- | --- |
| 60.0000% | 2/100 | 6.54 | 3.27 | 1.09 | 225 | 100 |
| 60.0000% | 5/1000 | 65.36 | 32.68 | 10.89 | 900 | 350 |
| 60.0000% | 8/2800 | 183.01 | 91.50 | 30.50 | 2700 | 850 |
| 60.0000% | 10/4500 | 294.12 | 147.06 | 49.02 | 4050 | 850 for all moves; 0 to level |
| 80.0000% | 2/100 | 4.90 | 2.45 | 0.82 | 225 | 100 |
| 80.0000% | 5/1000 | 49.02 | 24.51 | 8.17 | 900 | 350 |
| 80.0000% | 8/2800 | 137.25 | 68.63 | 22.88 | 2700 | 850 |
| 80.0000% | 10/4500 | 220.59 | 110.29 | 36.76 | 4050 | 850 for all moves; 0 to level |

## Finite campaign boundary

101 battles; 14450 authored account XP, 750 authored Clout, 219 authored plus perfect tickets. With the Chapter-5 starter Mythic and five milestones from authored XP alone: 3,000 Clout +227 tickets. Excludes match payouts, welcome, daily claims and Road. No campaign ticket spending is assumed in this boundary; use the independent pack and journey experiments for acquisition distributions, not an invented average campaign completion date.

| Starting collection | Direct new gameplay cards | Story/starter duplicate universal shards |
| --- | --- | --- |
| new | 9 | 25 |
| mid | 4 | 150 |
| near | 0 | 250 |
| complete | 0 | 250 |

### Spending the finite campaign tickets

Counterfactual order: all finite story/starter rewards first, then 22 ten-pulls and seven singles; no Road claims or Clout spending. This differs from opening packs between battles and is not an average completion forecast.

| Starting collection | Random new cards mean [p05,p50,p95] | Final owned | Clout including rebates | Universal |
| --- | --- | --- | --- | --- |
| new | 132.81 [127, 133, 139] | 165.81 [160, 166, 172] | 8089.50 [7625, 8050, 8575] | 902.00 [790, 900, 1020] |
| mid | 79.82 [75, 80, 84] | 186.82 [182, 187, 191] | 8089.50 [7625, 8050, 8575] | 1027.00 [915, 1025, 1145] |
| near | 0.68 [0, 1, 1] | 201.68 [201, 202, 202] | 8089.50 [7625, 8050, 8575] | 1127.00 [1015, 1125, 1245] |
| complete | 0.00 [0, 0, 0] | 202.00 [202, 202, 202] | 8089.50 [7625, 8050, 8575] | 1127.00 [1015, 1125, 1245] |

| Collection | Common | Uncommon | Rare | Epic | Legendary | Mythical |
| --- | --- | --- | --- | --- | --- | --- |
| new | 3188.15 | 2104.72 | 1119.12 | 131.20 | 58.00 | 16.00 |
| mid | 3268.15 | 2168.72 | 1371.12 | 241.40 | 133.20 | 64.00 |
| near | 3393.15 | 2280.72 | 1635.12 | 475.00 | 361.20 | 124.80 |
| complete | 3393.15 | 2280.72 | 1635.12 | 475.00 | 361.20 | 179.20 |

## Purchased and promotional overlays — never organic income

Separate source-rule counterfactuals overlay the new/casual first-session save wallet. No payment, redemption, provider access or live-account mutation occurred. Added Clout/tickets remain unspent; base prices exclude any tax and imply nothing about checkout availability.

| Configured USD base | Added Clout | Organic Clout mean | Final Clout mean [p05,p50,p95] | Extra full-price singles / tens affordable, no rebates |
| --- | --- | --- | --- | --- |
| $2.99 | 500 | 1412.05 | 1912.05 [1690, 1935, 2025] | 2/0 |
| $7.99 | 1500 | 1412.05 | 2912.05 [2690, 2935, 3025] | 7/0 |
| $19.99 | 4000 | 1412.05 | 5412.05 [5190, 5435, 5525] | 20/2 |

Production-eligible KYLE + CITYLEGENDS overlay: **60000 Clout +25 tickets**, union of eight card IDs, no duplicate compensation. Final Clout: 61412.05 [61190, 61435, 61525]; newly added promo cards: 7.94 [7, 8, 8]. This is eligibility in source, not actual redemption evidence. See the ledger for exact separate code contents and restrictions.
