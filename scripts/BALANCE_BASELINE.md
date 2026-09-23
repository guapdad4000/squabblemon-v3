# Deterministic balance baseline

**Automated baseline: RECORDED. Human playtest gate: PENDING.**

This file preserves the redacted aggregate from the full deterministic run. It contains no
participant data or raw match transcripts. The generated machine-readable report remains under
the ignored `scripts/tmp/balance-task-118-final/` directory.

## Reproduction record

- Command: **pnpm balance:full**
- Fingerprint: **54f19dec**
- Matrix: **880 / 880 successful / 0 engine failures**
- Coverage (Task 118 bounded full matrix): 11 decks, 55 pairings, two fixed district seeds,
  rotations 0 and 5, tiers 0 and 3, mirrored seats, SQUABBLE enabled; **880 scheduled
  matches**. The 11 are the eight affected archetype shells plus
  `focus-wave7-legends`, `focus-counterplay`, and `focus-air-bond` as the minimum distinct
  Fire/control/movement benchmarks.
- Player-seat score rate: **36.8%**
- Decision flags: **20 blocker / 25 review**
- Human playtest gate: **PENDING**

The command writes its reports before returning the intentional blocker exit while blocker flags
remain. The corrected ability metric derives success from engine state and resource changes.
No-effect outcomes are excluded while real fallback and information effects remain successful.

## Task 118 archetype coverage

The matrix now includes dedicated ten-card shells for Earth tax and finishers, Sherlock/Watson,
The Wiz movement, Wonderland return, Fire/GUAP, Poison entry punishment, Cellblock lane
sequencing, and Demario/Luigion. Existing starter crews and strong benchmark shells remain in
the matrix. Every shell is validated for ten unique engine cards before a run.

Final deck score rates were Wave 7 72.8%, Poison 70.0%, Fire/GUAP 67.5%, Air Bond 64.4%,
Earth 63.7%, Wiz 58.4%, Wonderland 50.6%, Demario/Luigion 33.8%, Counterplay 24.4%,
Sherlock/Watson 23.1%, and Cellblock 21.3%.

Paired comparisons hold district seed, draw rotation, seat, and training tier constant. The
completed report contains 288 greedy paired cases and 96 cases under each alternate policy
(first-legal and seeded-legal), so policy-sensitive signals are visible rather than presented as
universal win rates. Human playtest status remains **PENDING**. The earlier 20-deck/6,720-match
expansion was intentionally removed because it was not practical release validation.

Inherited findings: player-seat skew, existing Wave 7/Tayaty combo swings, and the
Late Scaling/Wave 7 Legends bands remain visible and are not attributed to Task 118. The
full-run policy and paired-swap blockers are also model/shell signals, not card-wide power
measurements. Patch-sensitive full-run findings are the new Cellblock, Sherlock/Watson,
Fire/GUAP, Poison, Counterplay, and Demario/Luigion shell bands plus the new GUAP/Landlord/Oz/Demario/Luigion
fixtures; they require investigation but do not prove a regression or universal card win rate.

## Paired swap signals

The bounded full-run swap plan has 48 controlled paired cases per experiment (two seeds,
two rotations, two tiers, three opponents, and mirrored seats). A positive delta means the
candidate shell scored higher than the baseline shell. These are shell-specific signals, not
universal card win rates.

| Candidate for removed card | Score delta | Gate |
| --- | ---: | --- |
| Captain Jigga for Officer Oink | +24.0 pp | blocker |
| Alchy for Rastamon | +20.8 pp | blocker |
| Tayaty for Cornball | +12.5 pp | blocker |
| Counter for Closet Nerd | +11.5 pp | blocker |
| Ashlee for Officer Oink | +9.4 pp | blocker |
| Young Bull for Plug | +8.3 pp | blocker |

## Cross-policy sensitivity

Final player-seat score rates were 36.8% for greedy, 49.1% for first-legal, and 59.4% for
seeded-legal, with 288 greedy paired cases and 96 under each alternate policy.

## Guardrail outcome

The final run placed Earth at **63.7%**, within the intended band after rejecting the
optional Block Party Titan +2 spread candidate. The optional BBL Demon 5/4 body candidate
was also rejected. Block Party Titan remains 6/7 with its established +1-per-district
spread, while BBL Demon remains 4/4 and keeps its local -1-to-every-enemy identity.
Required GUAP, Landlord, Mansa Musa, John Henry, and Bottle Girl signature mechanics were
retained.

The full column uses the one-ply greedy policy, all default opponents, and SQUABBLE. Alternate
first-legal and seeded-legal probes use a bounded representative subset without SQUABBLE, so
their magnitude is supporting sensitivity evidence rather than a like-for-like replacement for
the full run.

| Swap | Full greedy | First legal | Seeded legal | Reading |
| --- | ---: | ---: | ---: | --- |
| Young Bull for Plug | +8.3 pp | — | — | Greedy-only fixture in this run |
| Counter for Closet Nerd | +11.5 pp | +3.1 pp | +15.6 pp | Magnitude and gate vary by policy |
| Captain Jigga for Officer Oink | +24.0 pp | +1.6 pp | +15.6 pp | Magnitude and gate vary by policy |
| Alchy for Rastamon | +20.8 pp | — | — | Greedy-only fixture in this run |
| Ashlee for Officer Oink | +9.4 pp | +25.0 pp | +9.4 pp | Positive across policies |
| Tayaty for Cornball | +12.5 pp | — | — | Greedy-only fixture in this run |

The favorable real-resolution fixture measured 3.67 Hands per Motion for Ashlee plus Tayaty, 3.33 for Captain Jigga plus Tayaty, and 3.20 for Counter plus Tayaty at tier 0. Cornball plus Tayaty reached 4.50 and Sneaker plus Tayaty reached 5.25 in the same fixture.

## Bounded changes retained

The evidence supports retaining the already applied printed-Hand reductions:

- Young Bull: 3 to 2
- Counter: 3 to 2
- Ashlee: 4 to 3

No additional isolated stat reduction is justified from this automated evidence alone. Alternate-policy sign and magnitude changes require direct play observation, especially for sequencing, cleanse access, and combo shells.

## Release interpretation

The automated blockers remain investigation items. They do not override the human protocol or change its gate. Human comprehension, fun, strategy discovery, and campaign pacing remain **PENDING** until the sessions and aggregate gates in [BALANCE_PLAYTEST.md](./BALANCE_PLAYTEST.md) are completed.
