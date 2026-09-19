# Deterministic balance baseline

**Automated baseline: RECORDED. Human playtest gate: PENDING.**

This file preserves the redacted aggregate from the full deterministic run on September 19, 2026. It contains no participant data or raw match transcripts. The machine-readable report remains under the ignored tmp/balance-lab/ directory.

## Reproduction record

- Command: **pnpm balance:full**
- Fingerprint: **6dc9fe4b**
- Matrix: 2,496 scheduled / 2,496 successful / 0 engine failures
- Coverage: 12 decks, 78 pairings, four district seeds, rotations 0 and 5, tiers 0 and 3, mirrored seats, SQUABBLE enabled
- Player-seat score rate: 32.3%
- Decision flags: 97 blocker / 33 review
- Human playtest gate: **PENDING**

The command writes its reports before returning the intentional blocker exit while blocker flags remain. The corrected ability metric derives success from engine state and resource changes. No-effect outcomes are excluded while real fallback and information effects remain successful. This added one review flag versus the prior tuned aggregate: Laundromat Regular at 97 successes from 481 triggers (20.2%).

## Paired swap signals

Each full-run swap has 96 controlled paired cases. A positive delta means the candidate shell scored higher than the baseline shell. These are shell-specific signals, not universal card win rates.

| Candidate for removed card | Score delta | Gate |
| --- | ---: | --- |
| Young Bull for Plug | +24.5 pp | blocker |
| Counter for Closet Nerd | +18.2 pp | blocker |
| Captain Jigga for Officer Oink | +11.5 pp | blocker |
| Alchy for Rastamon | +9.4 pp | blocker |
| Ashlee for Officer Oink | +8.9 pp | blocker |
| Tayaty for Cornball | +7.8 pp | review |

## Cross-policy sensitivity

The full column uses the one-ply greedy policy, all default opponents, and SQUABBLE. The alternate probes use 48 paired cases, three representative opponents, and no SQUABBLE, so their magnitude is supporting sensitivity evidence rather than a like-for-like replacement for the full run.

| Swap | Full greedy | First legal | Seeded legal | Reading |
| --- | ---: | ---: | ---: | --- |
| Young Bull for Plug | +24.5 pp | -8.3 pp | +4.2 pp | Sign reversal; strongly model sensitive |
| Counter for Closet Nerd | +18.2 pp | +6.3 pp | +15.6 pp | Positive across policies; magnitude varies |
| Captain Jigga for Officer Oink | +11.5 pp | +0.0 pp | +6.3 pp | Falls below blocker threshold outside greedy |
| Alchy for Rastamon | +9.4 pp | +1.0 pp | +19.8 pp | Cleanse opportunities and sequencing dominate |
| Ashlee for Officer Oink | +8.9 pp | +24.0 pp | +7.3 pp | Positive across policies; wide fixture sensitivity |
| Tayaty for Cornball | +7.8 pp | +2.1 pp | +9.4 pp | Combo shell and sequencing sensitive |

The favorable real-resolution fixture measured 3.67 Hands per Motion for Ashlee plus Tayaty, 3.33 for Captain Jigga plus Tayaty, and 3.20 for Counter plus Tayaty at tier 0. Cornball plus Tayaty reached 4.50 and Sneaker plus Tayaty reached 5.25 in the same fixture.

## Bounded changes retained

The evidence supports retaining the already applied printed-Hand reductions:

- Young Bull: 3 to 2
- Counter: 3 to 2
- Ashlee: 4 to 3

No additional isolated stat reduction is justified from this automated evidence alone. Alternate-policy sign and magnitude changes require direct play observation, especially for sequencing, cleanse access, and combo shells.

## Release interpretation

The automated blockers remain investigation items. They do not override the human protocol or change its gate. Human comprehension, fun, strategy discovery, and campaign pacing remain **PENDING** until the sessions and aggregate gates in [BALANCE_PLAYTEST.md](./BALANCE_PLAYTEST.md) are completed.
