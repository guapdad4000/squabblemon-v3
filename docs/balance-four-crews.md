# Four-crew balance evidence (Task 126)

**Human balance gate: PENDING.** These are deterministic authored-deck scores (wins plus
half of draws), not live-player win rates, confidence intervals, or proof of fun.

## Reproduce

Run from the repository root, without an application server or player database:

```sh
pnpm --filter @workspace/scripts exec tsx src/four-crew-balance.ts --rules baseline
pnpm --filter @workspace/scripts exec tsx src/four-crew-balance.ts --rules candidate --nerd-cost 4
pnpm --filter @workspace/scripts exec tsx src/four-crew-balance.ts --rules candidate --nerd-cost 3
pnpm --filter @workspace/scripts exec tsx src/four-crew-balance.ts --rules candidate --nerd-cost 4 --sequence-only
pnpm --filter @workspace/scripts exec tsx src/four-crew-balance.ts --rules candidate --nerd-cost 3 --sequence-only
pnpm --filter @workspace/scripts exec tsx src/four-crew-summary.ts
pnpm --filter @workspace/scripts exec tsx src/four-crew-balance.ts --rules candidate --nerd-cost 4 --full
```

The baseline is reconstructed with `git archive` from the immutable pre-patch commit
`4a229154818fe27c1c61d5bc110e3d1c6397e7cb` into ignored `.cache/task126-pinned/`.
No duplicate historical engine is shipped. The commit must be available locally.
The candidate imports the working shared engine. Nerd's experimental cost is changed
only inside that offline process; no stored deck, collection, progression, reward,
starter or production account is read or changed.

Each targeted command writes an aggregate JSON to `scripts/results/task126/`.
`--out-dir PATH` overrides that directory. Per-pair checkpoint files allow `--resume`
after an interrupted run **only while the engine and experiment remain unchanged**.
Delete checkpoints before changing candidate mechanics; never merge observations
from different builds. The summary refuses partial runs or mismatched compositions,
opponents or axes. Full reports preserve every existing review/blocker flag and
return exit code 2 when blockers remain; that is not an engine crash.

## Controlled design

Each rules/cost state schedules **1,008 matches**: seven subjects, three opponents,
three policies, two district seeds, rotations 0/5, tiers 0/3, and both seats. Every
subject/opponent/policy cell has 16 games; each subject/policy aggregate has 48.
All three policies have SQUABBLE enabled, avoiding a second changed variable.

Subjects:

1. Original Cellblock lane-sequence crew, unchanged composition.
2. Original Sherlock/Watson crew, unchanged composition.
3. Original Demario/Luigion crew, unchanged composition.
4. Original Counterplay crew, including its generic completion cards.
5. Explicit Dark-control recommendation: Counter, Gamer, Goth Kid, Closet Nerd,
   Red Pill, BUDDY, Wifey, Pinay Nurse, Plug, Bust-Down Watch.
6. Dark splash: Nerd, Gamer, BUDDY, Goth Kid, Red Pill, Snow Bunny, Roaster,
   Plug, Wifey, Counter.
7. Echo/setup splash: Nerd, Tayaty, Oz, Scammer, Demario, Luigion, Watson,
   Sherlock, Plug, Wifey.

Opponents are the existing Fire/GUAP, Wave 7 Legends and Air Bond shells. They
represent different strong packages, not the entire metagame. Original and coherent
Counterplay share the original order key so the same slot permutation is used;
replacing a card cannot silently choose an easier draw order. Both seats and both
training tiers are retained in the raw summaries.

Read the comparisons separately:

- **Deck construction:** original versus coherent Counterplay under baseline rules.
- **Rule changes:** the same exact shell under baseline versus candidate, both Nerd 4.
- **Optional Nerd discount:** candidate Nerd 4 versus candidate Nerd 3, including
  Dark and echo splash decks; do not attribute the composition gain to this discount.

The original `focus-counterplay` remains in the 880-match full matrix so historical
comparisons do not silently substitute a different deck. The new
`focus-counterplay-coherent` is additionally available in the lab registry and the
targeted experiment. No starter or saved deck is replaced.

## Mechanical guardrails

Crafty retains its local support-**kind** condition. Boyfriend's new +1 targets only
another district's weakest friendly one of the four inmate characters. Sherlock's
new ally +2 requires an actual cancellation and an active source, not trap placement.
Watson keeps the actual-damage recovery cap and Protection behavior. Demario is
2/2 with one local 1-Hand Mushroom; normal and powered Luigion receive +2 from at
most one local token per deployment, while an ordinary consumer still receives +1.
Echoes do not consume tokens, and powered SQUABBLE/jump values are unchanged.

The harness additionally records real-resolution Tayaty probes for Nerd, Demario,
Luigion, Watson and Sherlock at both tiers and seats. They are favorable artificial
board fixtures, not typical match damage. Oz and Scammer appear in the complete
echo-shell games; focused engine tests establish the exact copying restrictions.

## Results and decision

All three targeted states completed **1,008/1,008 matches, zero engine failures**:
**3,024 matches** total, plus 96 sequencing cases and 60 real-resolution combo
probes. Interrupted exploratory work is not counted as evidence. The historical 880-match
baseline is preserved in [BALANCE_BASELINE.md](../scripts/BALANCE_BASELINE.md);
the new full report is a like-for-like matrix, not a human release pass.

Each table cell below has 48 matches against the same three strong opponents.

| Original shell, unchanged cards | Greedy old → new | First-legal old → new | Seeded-legal old → new |
| --- | ---: | ---: | ---: |
| Cellblock | 10.4% → 13.5% | 21.9% → 21.9% | 20.8% → 21.9% |
| Sherlock/Watson | 12.5% → 16.7% | 29.2% → 29.2% | 37.5% → 37.5% |
| Demario/Luigion | 13.5% → 8.3% | 12.5% → 24.0% | 24.0% → 36.5% |
| Historical Counterplay | 14.6% → 14.6% | 18.8% → 18.8% | 30.2% → 30.2% |

Cellblock and detectives improve only modestly, not enough to claim parity with
these strong opponents. **Demario/Luigion regresses under greedy**, even as both
alternate policies improve substantially. The cheaper opening setup is retained
for its stated accessible-combo goal, not described as an across-the-board score
increase. Losing one printed Hand changes some greedy selections and later board
value; these observations do not isolate one causal explanation. Human sequencing
and matchup validation remain required.

Seat/tier skew is material. Under new rules Cellblock's greedy player/CPU scores
are 4.2%/22.9%; detectives 2.1%/31.3%; Demario/Luigion 10.4%/6.3%. Their tier
0/tier 3 scores are respectively 8.3%/18.8%, 18.8%/14.6%, and 2.1%/14.6%.
Each seat or tier slice contains only 24 matches. Training gains must not be
mistaken for an unbiased estimate of untrained strength.

### Counterplay: composition first, Nerd discount rejected

| Isolated comparison | Greedy | First-legal | Seeded-legal |
| --- | ---: | ---: | ---: |
| Historical → coherent composition, **old rules** | 14.6% → 30.2% | 18.8% → 40.6% | 30.2% → 40.6% |
| Coherent crew, new rules Nerd 4 → Nerd 3 | 30.2% → 32.3% | 40.6% → 35.4% | 40.6% → 36.5% |
| Other Dark-control splash, Nerd 4 → Nerd 3 | 52.1% → 53.1% | 32.3% → 35.4% | 52.1% → 40.6% |
| Echo/setup splash, Nerd 4 → Nerd 3 | 36.5% → 37.5% | 40.6% → 36.5% | 54.2% → 59.4% |

**Final recommendation: keep Closet Nerd at 4 Motion / 3 Hands.** The coherent
deck is the dependable gain across policies; no control leader receives another
buff. The optional discount increases actual Nerd deployment frequency, but the
small greedy gain reverses under both alternate policies for its intended crew.
The echo splash goes the other way under seeded play. That is insufficient
evidence to broaden a universal Silence enabler's efficiency.

This rejects an optional, inconclusive change; it does not claim Nerd 3 is proven
overpowered. The real-resolution Nerd+Tayaty probe has the same tier-0 nine-Hand
swing but costs five versus four Motion (1.80 → 2.25 swing/Motion). Demario+Tayaty
changes eight Hands/four Motion → seven Hands/three Motion (2.00 → 2.33); Watson
six/three → seven/three (2.00 → 2.33). Luigion+Tayaty stays ten/three and Sherlock
eight/four in that fixture. All listed tier-0 probes are owner symmetric; both
tiers are retained in the raw files. A trap not actually triggered in the fixture
does not measure Sherlock's new cancellation reward.

### Printed values and ability changes

| Card | Before | Final rule | Reason and preserved limit |
| --- | --- | --- | --- |
| Inmate Crafty | 2 Motion / 2 Hands | 2 / 3 | Useful early body; local support-kind +2 remains conditional. |
| Inmate Boyfriend | 3 / 3, local ally +2 | Same, plus weakest other-lane friendly inmate +1 | Spread scoring; only the four inmate identities; either branch can train once. |
| Sherlock | 3 / 4, actual trap cancellation gives self +2 | Same, plus weakest other friendly character board-wide +2 | Successful prediction helps another district; trap timing, lifetime, replacement and single cancellation unchanged. |
| Watson | 2 / 2 | 2 / 3 | Stronger defensive body; still restores at most 3 actually lost Hands, preserving Protection/fallback and remote Sherlock protection. |
| Demario | 3 / 3 | 2 / 2 | Opening-turn setup, not a free body: still one 1-Hand Mushroom using a real board slot. |
| Luigion | 2 / 2; ordinary-form Mushroom award +1 | 2 / 2; normal-form Mushroom award +2 | Pair works without SQUABBLE. Powered award stays +2; multiplier, reveal and jump values unchanged. |
| Closet Nerd | 4 / 3 | **Unchanged 4 / 3; 3 / 3 candidate rejected** | Composition provides the reliable gain; optional cost results are policy-sensitive. |

Informant, Contraband, LeBron, Counter, Gamer, BUDDY, Red Pill and Goth Kid received
no direct buffs. These setup changes are intentionally not compared using a different
deck list to conceal an unfavorable result.

### Final 880-match matrix and unchanged gate

Final full fingerprint: **`47aa7d1f`**, compared with the recorded pre-task
**`54f19dec`**. The same 11 decks, 55 distinct pairings, two district seeds,
rotations 0/5, tiers 0/3 and mirrored seats completed **880/880 matches with
zero engine failures**. Each deck appears in 160 games. The original Counterplay
composition remains here intentionally; its improved recommendation is measured
separately above.

| Authored shell | Recorded baseline | Final Nerd-4 rules |
| --- | ---: | ---: |
| Wave 7 Legends | 72.8% | 72.8% |
| Poison entry | 70.0% | 66.6% |
| Fire/GUAP | 67.5% | 65.9% |
| Earth tax | 63.7% | 64.1% |
| Air Bond | 64.4% | 63.7% |
| The Wiz | 58.4% | 58.8% |
| Wonderland | 50.6% | 52.2% |
| Cellblock | 21.3% | 26.9% |
| Sherlock/Watson | 23.1% | 26.6% |
| Historical Counterplay | 24.4% | 26.3% |
| Demario/Luigion | 33.8% | 26.3% |

Baseline percentages are the historical published one-decimal values rather than
a newly rerun full baseline. Raw unrounded final aggregates are retained in
`scripts/results/task126/candidate-nerd4-full.json`. The targeted old-rules
comparisons above were freshly reconstructed and run for this patch.

**The automated gate remains failed: 20 blocker and 25 review flags**, matching
the previous aggregate counts; no threshold or severity was relaxed. The CLI
intentionally returns 2 after writing the full report (a pnpm wrapper may report
its own nonzero exit). This is not a claim that every individual flag is identical:
the historical complete machine report is not present, so inheritance is supported
by the recorded aggregate and the reconstructed targeted probes, not an invented
flag-by-flag diff.

The complete final blocker set is:

- Seven deck bands: Wave 7 (72.8%), Poison (66.6%), Fire (65.9%), and all four
  historical target shells below the 35% lower threshold.
- Six favorable combo efficiency flags: Captain Jigga+Tayaty tier 3 (5.33),
  Cornball+Tayaty tier 3 (**7.50**), Luigion+Tayaty tier 3 (5.33),
  Roaster+Tayaty tier 3 (5.25), and Sneaker+Tayaty tiers 0/3 (5.25/**6.75**).
  Values are net district Hands per Motion, not damage. Luigion's flagged 16-Hand
  swing/3 Motion is **identical under the reconstructed old and new rules**;
  it is not a new powered ceiling.
- Six paired-swap blockers, unchanged from the recorded old aggregate:
  Captain for Oink **+24.0 pp**, Alchy for Rastamon **+20.8 pp**, Tayaty for
  Cornball +12.5 pp, Counter for Nerd +11.5 pp, Ashlee for Oink +9.4 pp,
  Young Bull for Plug +8.3 pp.
- Player-seat score **36.5%**, versus the recorded 36.8%. Full-run first-legal
  and seeded-legal sensitivity subsets score 48.8% and 57.8% by player seat;
  those inherited probes disable SQUABBLE and differ from the targeted
  like-for-like policy comparisons above.

The 25 reviews comprise 13 combo efficiencies, two deck bands (Earth/Air),
seven low ability-success rates and three low play rates. The patch-sensitive
Demario+Tayaty tier-3 efficiency increases from 3.50 to **4.33**, still below
the 5.0 blocker threshold, while its actual net swing falls from 14 to 13.
All reviews and numerical values remain in the raw full report.

No newly demonstrated runaway combo or dominant target shell warrants a further
buff/nerf from these data. There **is** a genuine adverse candidate signal:
Demario/Luigion's greedy full score falls about **7.5 percentage points** and
its strong-opponent greedy score also declines. This remains an unresolved balance
limitation, not explained away by the two favorable alternate policies. The
opening-turn setup/normal-combo goal is delivered; reliable competitive improvement
for that authored shell is **not proven**. Do not report all four crews as uniformly
stronger, or the remaining bands as solved.

### Sequencing observation

The 48-case coherent-control greedy probe records actual Nerd choices (both seats,
both tiers, identical seeds/rotations/opponents), not merely a theoretical cheaper
cost. At cost 4 Nerd was deployed in 22 cases: once in round 4 and 21 times in
round 6. At cost 3 he was deployed in 42: once in round 3, four times in round 4,
five times in round 5 and 32 times in round 6. Mean deployment round among plays
was 5.91 versus 5.62. This proves improved bot affordability, but not earlier
deployment on the same population or stronger human sequencing: the set of
matches where he was played also changed. Every selected deployment and its
authoritative ability notes are retained in the sequence JSON.

### Verification record

- The regression test is in `scripts/src/balanceLab.test.ts`, so the existing
  `pnpm test:balance` / scripts `test` command includes it automatically.
  It checks the preserved original shell, legal explicit ten-card recommendation,
  same slot permutation and 16-case paired axes.
- Scripts typecheck and the standard **13/13 balance tests** passed, including
  the new regression and the unchanged intentional blocker-exit test.
- Parent integration verification reports: wave rules 67 tests, authoritative
  checks 41, online 8, API progression 9, mounted browser 16, and root typecheck
  passing. These are software checks, not human balance evidence.
- Final integrated Squabblemon suite: **561/561 tests plus 3/3 bundle tests**.
  Workspace typecheck passes across libraries, web apps, API server and scripts.
  The final 4-Motion Nerd collection assertion also passes on desktop and phone.
- Reward and online rules versions advance together. Previously accumulated
  rewards, ownership, saved crews and progression are untouched; in-progress
  snapshots from older rules fail explicitly rather than being replayed under
  incompatible combat rules.

## Remaining validation

See [the four recommended crews](four-crew-guide.md) for player-facing plans.
Use the existing [human playtest protocol](../scripts/BALANCE_PLAYTEST.md), including
the focused questions added for this patch. Bot-policy/seat repair, human recruitment,
and wider archetype changes remain outside this patch. No bot band alone demonstrates
that a card is too strong or that a struggling crew has been solved.