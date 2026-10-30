# Anunaki balance tuning — rules version 65

Applied the approved two-pass plan. Base costs remain unchanged. Yakub still summons one free Caucus, or two on Squabble, without their On Reveal. Caucus still deals damage and gains +1 Hand per round beside an active friendly tablet.

## Final changes

- Yakub: removed the next-character +2/+3 Hands buff. Existing serialized pending buffs remain readable/resolvable; new reveals and echoes do not create them.
- Ninhursag: removed the immediate +3 ally buff. Retains 2/3 stats, tablet creation, and +2 Hands plus an ally cleanse on friendly tablet consumption in her lane.
- Utu: 1/2 instead of 1/3; initial debuff is −1, or −2 when consuming a tablet. Still creates a tablet when no enemy is present.
- Caucus: successful-hit chain chance reduced from 50% to 35%. Retains 2/3 stats, landed-hit requirement, eight-extra safety bound, damage, and radiation.
- Online rules and card balance versions advanced from 64 to 65; old online rooms use the existing retirement path.

## Matched benchmark

Same ten-card Anunaki roster, eight opponent decks, 20 seeds, two policies, both seats, base tier, fixed rotation zero, Squabble enabled. Draws count in the denominator; no half-win credit.

| Candidate | Wins | Losses | Draws | Games | Win rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| Before | 504 | 119 | 17 | 640 | 78.75% |
| Yakub + Ninhursag only | 447 | 161 | 32 | 640 | 69.84% |
| All four changes | 384 | 207 | 49 | 640 | 60.00% |
| Final, ten fresh seeds | 210 | 82 | 28 | 320 | 65.63% |

Final matched policy splits: greedy 205/320 wins (64.06%), seeded legal 179/320 (55.94%). Seat splits: first seat 159/320 (49.69%), second seat 225/320 (70.31%). Fresh policy splits: greedy 114/160 (71.25%), seeded legal 96/160 (60%). Fresh seat splits: first 97/160 (60.63%), second 113/160 (70.63%). The seat gap is a remaining playtest concern, not something hidden by the overall percentage.

This meets the approximate benchmark target; it is not a predicted human win rate or full-roster ranking. Opponent coverage, fixed card order and the two policies limit conclusions. No further nerfs were applied to force the fresh sample to exactly 60%.

Raw outcomes, logs and source hashes: `output/anunaki-balance-review/` beside this checkout. Reproduce from `scripts/` with `ANUNAKI_BALANCE_SEEDS=20 ANUNAKI_BALANCE_SEED_PREFIX=readiness-holdout node --import tsx src/anunaki-balance-smoke.ts`; fresh sample uses count 10 and prefix `tuning-fresh`.

## Verification

Full frontend regression: 2,511 main tests plus 20/9/8 follow-ons passed. Native database journey: 18 tests plus 10 media/cosmetic follow-ups passed. This includes all 56 Story nodes, legal wins, rewards, raid eligibility and retry behavior. Standard raid starter victory remains a legal saved/JSON-round-tripped sequence; its final Roaster now plays in district 1 rather than district 0. Printed-budget checks reflect Utu 1/2. No reward thresholds or boss HP were changed to make tests pass.

Production build is verified separately after the final source freeze. No commit, push or deploy is authorized by this tuning pass. Prior wider balance reports are historical until regenerated for version 65.
