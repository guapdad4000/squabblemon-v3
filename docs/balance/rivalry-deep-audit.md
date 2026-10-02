# Blood / Crips: follow-up audit, frozen rules 42

This pass completed **2,720 simulated games** across seven reproducible reports, with no simulation failures.

## Decision

Keep card values frozen. No additional buffs or nerfs were applied in this pass. The previous near-50/50 aggregate was a bot sample under fixed round order, not proof of competitive parity. This audit adds decision traces, common-random seat controls, a two-play search, field-wide tests, targeted confirmations, and actual multiplayer command-handler matches.

**Human playtesting is prepared but has not been performed.** Browser exercises are automated. All tested rosters exclude GUAP; every runner asserts this. A legacy opponent identifier still contains `guap`, but its actual deck uses Redneck Evil and its displayed name is Fire Pressure.

## What changed in the tooling

- `rivalry-deep-audit.ts`: reproducible field, decision, tier, chain-search, and outlier schedules; retains per-card observations and decision traces.
- `pairedSeededPolicy`: deck-specific random priorities, unchanged by owner label, seat suffix, or global action count. Both seats keep the same deck-specific draws.
- `chainBalancePolicy`: bounded search for two plays in the same turn. It uses canonical legal engine previews; no future draws or opponent replies are simulated. It is an experimental diagnostic, not a replacement for the live AI.
- `rivalry-online-audit.ts`: compares alternating PvP initiative with a fixed-opener control using the same starting state and the real `applyOnlineCommand` handler.
- Shared-screen playtest: both players can act, change tiers, swap seats while preserving draws, record notes, and export games whose complete command replay matches the live room.
- 40 new adversarial combo regressions, 9 audit/model tests, and desktop/phone full-game export checks.

The gameplay-source fingerprint remains `e3268be35f91b89c98a0e3883bb85ab324bd3e4b8641af5a9432481599be24e2`. Runners also record their own source fingerprint. The initial online runner source is retained separately because only a TypeScript annotation and holdout options were added afterward.

## 1. Bot decisions

The greedy lab policy is one-play lookahead; the seeded policy is deliberately independent of card strength. Neither is the shipped CPU AI. The shipped CPU already uses a bounded future-turn search. The lab weights Burn at 0.3 per stack capped at three, Protection at 0.6, and has no explicit value for an unconsumed Initiation mark, Spinner trap, LOOK OUT future calls, or delayed dog support. It can discover those only when a preview immediately realizes them.

On the 192-game decision schedule (64 per policy), Crips scored:

| Policy | Crips score | Player seat | CPU seat |
|---|---:|---:|---:|
| Greedy | 18.75% | 17.19% | 20.31% |
| Original seeded | 63.28% | 54.69% | 71.88% |
| Common-random seeded | 63.28% | 64.06% | 62.50% |

The original seeded seat gap shrank from 17.19 percentage points to -1.56 points with controlled random priorities on this sample. That shows the earlier gap was confounded; it does not establish zero turn-order advantage.

Greedy made 41 voluntary passes with legal plays for Crips and 23 for Blood. Initiation remained in hand on 37 and 21 of those decisions respectively. These are decisions, not distinct failed games. Greedy played Folks in 64/64 games, versus 52/64 for each low-information policy; placement and sequencing clearly matter.

In a separate paired 128-game comparison, two-play search scored Crips 43.75%, versus greedy 35.94% (64 each). It changed 173 decisions, including 17 switches from Alchy to Initiation. Across both decks it played Initiation 123 times versus 88 with greedy. This supports setup blindness as one contributor, not a complete causal explanation or proof that the new bot is universally stronger.

The legacy evaluator's comment says public-state-only, but its Streamer setup term consults each side's cheap-card count in hand. That does not affect these two fixed rivalry rosters, which contain no Streamer; it is an additional limitation for field opponents. No policy performance here should be equated with human skill.

## 2. Actual multiplayer turn order

The lab's default loop always gives the player owner the first turn each round. Production `applyOnlineCommand` alternates the opening seat by round. The matched online experiment uses both owner assignments and both opening seats, all four tiers, four seeds, and three policies: 384 games total.

| Flow | Crips overall | Greedy | Common-random seeded | Two-play search |
|---|---:|---:|---:|---:|
| online-alternating | 52.08% | 37.50% | 76.56% | 42.19% |
| fixed-opener | 59.38% | 51.56% | 82.81% | 43.75% |

**Current online match creation supplies no progression and therefore uses base ability training.** Higher-tier matches in this experiment are deliberately injected diagnostics. They do not describe the currently issued PvP training settings. At tier 0 in the first online sample, Crips scored 39.58% over 48 games. Treat that separately from the 52.08% all-tier aggregate. Online participants each receive their own SQUABBLE; the standard PvE CPU policy is a different setup.

A separate base-only confirmation uses 16 fresh seeds, both owner labels and opening seats, and all three policies: **192 games**. Crips scored **46.88%** overall; greedy 31.25%, common-random seeded 68.75%, and two-play search 40.62%. This is the relevant additional signal for current PvP rules, still subject to policy and sample limitations.

## 3. Wider roster

Two crews versus 36 other recipes each; two fresh seeds, both owner seats, tiers 0/3, greedy and common-random policies: **1,152 matches**. Each individual matchup has only 16 games and is a screening result.

| Crew | All | Greedy | Common-random seeded | Base | Tier 3 |
|---|---:|---:|---:|---:|---:|
| Crips | 59.11% | 46.53% | 71.70% | 61.81% | 56.42% |
| Blood | 56.25% | 57.29% | 55.21% | 62.15% | 50.35% |

Both crews exceeded 50% overall across the sampled roster, but Crips remains very policy-sensitive. The field deck list is a recipe collection, not a player-popularity-weighted metagame. Results from the reverse Blood/Crips row are not complements: role-dependent draw seeds differ when deck A and B swap.

Fresh outlier confirmation used four new seeds, two rotations, both seats, tiers 0/3, and two policies: **384 games**, 64 per crew/opponent pairing.

| Opponent | Crips score | Blood score |
|---|---:|---:|
| WHO YOU KNOW | 75.78% | 90.62% |
| SQUABBLEHOUSE SHIFT | 36.72% | 26.56% |
| Electric | 32.81% | 53.91% |

Blood's initial 0/16 against Electric did **not** replicate: the new score was 53.91%. Do not buff Blood based on that screen. Both crews still struggled against Squabblehouse, making that the next matchup to inspect with humans. Both strongly beat the sampled starter Combo deck; check its intended starter power level before trying to equalize it with a focused crew.

## 4. Tier 2

Twelve fresh seeds, two rotations, both seats, tiers 1/2/3, and two policies: **288 matches**.

| Tier | Crips overall | Greedy | Common-random seeded |
|---|---:|---:|---:|
| 1 | 53.65% | 43.75% | 63.54% |
| 2 | 60.42% | 43.75% | 77.08% |
| 3 | 66.67% | 47.92% | 85.42% |

The earlier tier-2 dip did not reproduce as an isolated weak tier. Do not add a tier-2 buff on this evidence. Policy dependence increases with training in this sample. These higher-tier observations matter for trained modes, not current base-training online rooms.

## 5. Combo and counterplay checks

40 new tests cover both owners and every tier 0–3:

- CLUE plus Ganger support keeps one Protection layer. Spinner consumes the shield, then Ganger Red can deal damage.
- Protection blocks Folks' Burn application; an exposed target takes the round-end tick and its stacks clear. Old Burn cannot tick again.
- Initiation recruits count as Blue for CLUE's support, receive the correct tier payout once, and cannot award recruitment to a later arrival.
- RED PUNCH cannot displace an immune target into full opposing districts, exceed capacity, or train on that no-op.
- LOOK OUT cannot exceed three calls across six rounds, cannot call twice in a round, cannot repeat training, and never creates negative card costs.

These are counterexamples to particular runaway combinations, not an exhaustive proof that no dominant strategy exists. Full-game traces and the browser playtest remain necessary. Per-card `noEffect` observations are emitted-event classifications, not ability failure rates; eligibility and passive effects may be unlogged.

## Verification and human handoff

- 156 focused engine tests pass, including all 40 new stress cases and existing Blood/Crips/multiplayer checks.
- 9 new policy/online-model tests pass.
- 6 desktop/phone browser scenarios pass, including full six-round shared-screen games, both sides playing, all tier settings, replay exports, and seat-swap draw preservation.
- Workspace typecheck and dedicated browser-fixture typecheck pass.
- No engine or card-value changes in this pass. The previously documented four unrelated full-suite failures are not claimed fixed; the full suite was not rerun for audit-only additions.

Run the local playtest:

```sh
PORT=5178 BASE_PATH=/ pnpm --filter @workspace/squabblemon dev
```

Open `http://localhost:5178/e2e/rivalry-playtest.fixture.html`. The fixture uses the real multiplayer command handler but does not create or send an online room. It is a shared-screen laboratory: hands are not private. Start with tier 0 for today's PvP; tiers 1–3 are trained-mode diagnostics. Use [the empty 32-game score sheet](rivalry-human-playtest.csv), switch people as well as decks, and export each completed game with notes. The sheet intentionally has no invented results.

Remaining human questions: can Blue preserve answers for Blood's removal instead of spending support too early; can Blood punish spread Blue boards without depending on one Folks draw; and does Squabblehouse offer enough practical counterplay for either crew? Do not change costs or Hands until the decision traces and those games identify a specific lever.

## Reproduction and raw evidence

```sh
pnpm --filter @workspace/scripts exec tsx src/rivalry-deep-audit.ts field UNIQUE-LABEL
pnpm --filter @workspace/scripts exec tsx src/rivalry-deep-audit.ts decisions UNIQUE-LABEL
pnpm --filter @workspace/scripts exec tsx src/rivalry-deep-audit.ts tier2 UNIQUE-LABEL
pnpm --filter @workspace/scripts exec tsx src/rivalry-deep-audit.ts chain UNIQUE-LABEL
pnpm --filter @workspace/scripts exec tsx src/rivalry-deep-audit.ts outliers UNIQUE-LABEL
pnpm --filter @workspace/scripts exec tsx src/rivalry-online-audit.ts UNIQUE-LABEL
pnpm --filter @workspace/scripts exec tsx src/rivalry-online-audit.ts UNIQUE-LABEL --base-holdout
SQUABBLEMON_PROXY_ROOT='' pnpm --filter @workspace/squabblemon exec playwright test --config e2e/playwright.rivalry.config.ts
```

Every completed runner asserts the case count and unchanged gameplay/roster fingerprint. Existing reports cannot be overwritten. Matched draws, repeated policies, and mirrored seats produce correlated scenarios; these scores are not independent human win-rate estimates.

- [rivalry-field-v42](../../scripts/results/crip-followup/rivalry-field-v42.json)
- [rivalry-decisions-v42](../../scripts/results/crip-followup/rivalry-decisions-v42.json)
- [rivalry-tier2-v42](../../scripts/results/crip-followup/rivalry-tier2-v42.json)
- [rivalry-chain-v42](../../scripts/results/crip-followup/rivalry-chain-v42.json)
- [rivalry-outliers-v42](../../scripts/results/crip-followup/rivalry-outliers-v42.json)
- [rivalry-online-v42](../../scripts/results/crip-followup/rivalry-online-v42.json)
- [rivalry-online-base-holdout-v42](../../scripts/results/crip-followup/rivalry-online-base-holdout-v42.json)
