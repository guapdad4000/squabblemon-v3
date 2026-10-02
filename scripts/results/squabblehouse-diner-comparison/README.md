# Squabblehouse diner crew: matched comparison

## Result

The new ten-card recipe is **not a consistent matchup improvement** over the old staff/utility recipe in these deterministic bot tests. It improves against Fire GUAP under the score-based greedy policy, but that advantage reverses under the alternate seeded-legal policy. Alice/Wonderland and Wiz are generally weaker in the primary tests.

All accepted results use card balance and online rules version 30. Card stats, gameplay rules, saved decks, player inventories, and publication state were not changed for this comparison.

## Outcomes

Each cell is **old crew → new diner crew**, measured as outright wins divided by completed cases. Draws are not counted as wins.

| Opponent | Primary greedy, 144 cases per crew | Primary seeded-legal, 144 cases per crew | Fresh greedy districts, 48 cases per crew |
| --- | --- | --- | --- |
| Alice / Wonderland | 14.6% → 11.8% | 19.4% → 13.2% | 22.9% → 27.1% |
| Fire GUAP | 20.8% → 30.6% | 36.8% → 27.8% | 29.2% → 27.1% |
| Wiz | 25.7% → 24.3% | 41.0% → 27.1% | 33.3% → 27.1% |

The win/draw score gives one point for a win, half for a draw, and zero for a loss:

| Opponent | Primary greedy score | Primary seeded-legal score | Fresh greedy score |
| --- | --- | --- | --- |
| Alice / Wonderland | 17.4% → 14.6% | 22.2% → 16.7% | 28.1% → 27.1% |
| Fire GUAP | 26.7% → 36.1% | 39.9% → 33.3% | 37.5% → 40.6% |
| Wiz | 29.5% → 27.1% | 45.8% → 31.3% | 38.5% → 31.3% |

Thus Alice's fresh-schedule increase in outright wins does not increase its win/draw score: the new crew turns some draws into wins but also has more losses. GUAP's fresh schedule has fewer outright wins but more draws and a slightly higher win/draw score.

## Controls and verification

- New crew: Manager, Bus Boy, Cashier, Security, Teknician, Griddle Master, Inmate Reformed, Janitor, Waffle Warlord, and A Side of Hands. Side remains support, not staff.
- Old crew: the frozen original six staff plus Plug, Waterboy, Laundry, and Nail.
- Both compositions share the engine deck ID and draw-order key; opponents, district seeds, rotations, policies, upgrade tiers 0/3, and mirrored player positions match.
- Each crew has 864 primary cases and 144 fresh-district cases: **1,008 per crew; 2,016 total accepted cases; zero simulation failures**.
- Another 2,016 engine executions validate matrix/raw concordance. They are duplicate validations, not additional independent samples.
- Merge and both standalone verification paths passed, with exact Cartesian case coverage, unique paired keys, matching fingerprints, complete captures, and no failures.
- Historical staff and mixed-shell report files remain byte-for-byte unchanged.

Primary schedules have 72 cases per position or upgrade tier; fresh schedules have 24. Outcomes vary substantially by position, tier, and policy. These are bot deck-composition samples, not human win rates, confidence estimates, or evidence of an individual card's causal strength.

## Test-bot correction

The initial attempt was rejected because the offline bot enumerated SQUABBLE for a support card. The engine correctly rejected that illegal action. Only the bot's legal-option enumeration was corrected: normal support plays remain available, characters retain SQUABBLE, and support cards do not gain it. Incomplete samples were never accepted as matchup results.

Rejected initial files are isolated under `history/rejected-support-squabble/`; do not use them for balance conclusions. Accepted reports are `current-baseline/current-rules.json` and `diner/current-rules.json`, with the final acceptance record in `verification/current-verification.json`.

## Reproduce

From the workspace root:

```sh
pnpm --filter @workspace/scripts exec tsx src/squabblehouse-diner-comparison.ts --preflight
pnpm --filter @workspace/scripts exec tsx src/squabblehouse-diner-comparison.ts --pilot
# Run each opponent's primary greedy, primary seeded-legal, and greedy holdout shards.
# Opponents: focus-wonderland, focus-fire-guap, focus-wiz.
pnpm --filter @workspace/scripts exec tsx src/squabblehouse-diner-comparison.ts --shard focus-wonderland:greedy:primary
pnpm --filter @workspace/scripts exec tsx src/squabblehouse-diner-comparison.ts --merge
pnpm --filter @workspace/scripts exec tsx src/squabblehouse-diner-verify.ts --merged
pnpm --filter @workspace/scripts exec tsx src/squabblehouse-diner-verify.ts --shards
```

Limit simultaneous shard processes to three. All nine paired shards are required for merge. Changed source, roster, or schedule fingerprints require new simulations; do not mix runs.