# Payoff buff experiment

Baseline is the final retained v58 reliability patch, with Nerd at five Hands. First two baselines are the corrected buffs/confirm-buffs results from ../reliability-patch-20261012, paired by deck, opponent, tier, seat and bot policy. Source is saved in baseline-source.

Candidates change Ashlee's Plant spread payoff, A Spare Gus's Motion cost, Studio Couch YN's local Music buff, and Mixtape Cousin's arrival payout. No printed Hands increase.

Sets A/B: same six benchmark opponents, four tiers, both owner seats, greedy and seeded legal policies. Each deck has 96 matches per set. Seeds/rotations match the prior baselines exactly. These comparisons informed candidate selection.

Holdout C: fresh seed payoff-holdout-20261012-191, rotation 19, against Red, Blue, Electric, Who You Know, SquabbleHouse Shift and Cellblock Pressure. Baseline and candidate each run 288 matches. This opponent/draw set was not used to pick the first candidate.

Scores count a draw as half a win. Small bot samples, not live player win rates or a 46-deck league ranking. Training/seat/policy cases share recipes and draws and are not independent population samples. Source snapshots retain original and candidate rules for reproducibility.
