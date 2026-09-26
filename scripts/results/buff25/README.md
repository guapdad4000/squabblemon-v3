# 25-card buff audit

Baseline: `7b886054ca42d7c89e67cb21e19397353c8da95b`, the shipped 51-card rework wave. Candidate: the 25-card buff commit accompanying these reports.

Reproduce with `pnpm --filter @workspace/scripts exec tsx src/buff25-audit.ts`, adding `--baseline`, `--seeded`, or both for the other reports. The baseline is extracted from its pinned Git commit.

There are **1,536 games** across four reports: baseline and candidate, each under greedy and seeded-legal policies. Each report runs eight fixed subject decks against Fire, Air, and coherent counterplay over two district seeds, two draw rotations, tiers 0 and 3, and both seats. Each table cell contains 48 games; a draw counts as half a win.

| Fixed deck | Greedy before | Greedy after | Seeded before | Seeded after |
| --- | ---: | ---: | ---: | ---: |
| Earth Rides | 58.3% | 56.2% | 50.0% | 54.2% |
| Electric Jobs | 52.1% | 52.1% | 57.3% | 57.3% |
| Club | 16.7% | 17.7% | 41.7% | 41.7% |
| Protect and Retaliate | 8.3% | 8.3% | 27.1% | 27.1% |
| Comeback | 17.7% | 19.8% | 28.1% | 29.2% |
| Plant Care | 24.0% | 18.8% | 42.7% | 43.8% |
| Air Routes | 56.2% | 49.0% | 55.2% | 55.2% |
| Public Contracts | 1.0% | 3.1% | 13.5% | 20.8% |

## Interpretation

These are small deterministic bot samples, not live win rates. Both sides use the corresponding engine version. Opponent decks also contain changed cards, and the greedy policy can choose different lines after small effect changes. This is a batch comparison, not 25 isolated causal estimates. Decks are held fixed; they were not rebuilt around the new contracts. The Public Contracts shell remains a weak collection of setup cards despite improved scores.

The clearest benefits of this batch are mechanically verified: rewards can activate sooner, some formerly blank plays have useful fallback branches, and timing/targeting bugs no longer block intended play. Match-score improvements are not universal. Comeback and Public Contracts improve under both sampled policies; some other results are flat or policy-dependent. Plant and Air still warrant coherent-deck testing and player feedback rather than another indiscriminate numeric increase.

## Verification

- 58 new scenario tests, both owners: Coach with presentation disabled, successful/failed retries, Cashier in six- and seven-round games, actual/deferred/blocked Trick statuses, partial contract progress, shield attribution, single payouts, damage prevention, and movement limits.
- Existing creative-registry determinism and immutability tests now include the four newly integrated kits. Online authority compares all 55 creative kits plus Nerd at tiers 0–3 for both owners (448 authority cases), including public-state serialization.
- Runtime registry comparison against the baseline: exactly 25 of 202 cards changed. Card IDs, printed costs, base Hands, types, kinds, and upgrade IDs/unlock levels/effect amounts remain equal.
- All 969 app tests pass after rebasing onto main. Library/app/scripts type checks and the production build pass; the entry bundle is 200.3 KiB against a 475 KiB budget. API progression/reward tests: 9 pass; entry-budget unit tests: 3 pass.
- The pre-existing story-content test expected version 7 despite authored version 9. Its expectation is corrected to 9; story content is unchanged.

[Final card rules and limits](../../../docs/CARD_BUFFS_25.md) · [Original 25-card investigation](../../../docs/NEXT_25_CARD_BUFF_CANDIDATES.md).
