# Element balance evidence

## Balance patch 16

This pass changes seven cards, using their finalized playable kits rather than superseded expansion definitions:

- **Closet Nerd:** 4 → 3 Motion; 3 printed Hands and the existing interruption/reveal behavior are unchanged.
- **Shotta:** 4 → 3 Motion; 3 printed Hands, the opening hit, and the two-encore/once-per-round limits are unchanged.
- **Sherlock:** 3 Motion / 4 Hands → 2 Motion / 3 Hands. His visible, avoidable Stakeout trap, expiry, and successful-cancellation rewards are unchanged. Watson retains the v15 pair bonus.
- **Alchy:** ongoing growth begins at round 4 instead of round 3. The losing-district bonus, trained upgrades, and suppression rules remain.
- **Last Train Conductor:** a successfully moved passenger gains +2 Hands, or +3 if Water, instead of +3/+4. Movement and cleansing remain required.
- **Electrician Foreman** (`circuitcaptain`): each worker still gains +1 Hand on taking a job. Completing both jobs now gives each another +1 instead of +2; the one-time 1-Motion refund remains.
- **E.V. Enthusiast** (`wiretap`): retains the next-card cross-district discount but no longer also refunds 1 Motion immediately.

Card balance and online rules versions are both **16**. Printed Hands remain within cost + 1. Global Motion, hand bonds, crew lists, ownership, rewards, and artwork are unchanged. In particular, Monsoon Anchor and Pirate Radio DJ still have their active hand bonds; the removed Ice Cream Truck and Foreman bonds were not used to explain or tune this pass.

### Matched v15 → v16 comparison

The complete v16 reports are `v16/v16-greedy.json` and `v16/v16-seeded-legal.json`. Their exact deck lists and schedule metadata were compared to the preserved v15 reports: the same 13 crews, district seeds, rotations, tiers, and both seats. Each policy completed **1,248 matches**, **192 appearances per crew**: **2,496 matches with zero simulation failures**.

These are bot **score rates**, including half a point for a draw, not player win rates.

| Crew | Greedy v15 → v16 | Seeded-legal v15 → v16 |
|---|---:|---:|
| Light | 38.8% → 34.4% | 47.9% → 44.5% |
| Water | 77.1% → 77.3% | 73.7% → 67.2% |
| Plant | 53.6% → 53.6% | 44.0% → 42.2% |
| Electric | 69.8% → 54.7% | 75.5% → 66.9% |
| Dark | 35.2% → 39.8% | 25.3% → 28.6% |
| Earth | 50.0% → 46.9% | 47.4% → 47.1% |
| Fire | 35.2% → 29.9% | 52.1% → 53.6% |
| Air | 68.0% → 64.8% | 48.4% → 48.7% |
| Poison | 51.0% → 50.0% | 48.4% → 47.9% |
| Sherlock and Watson | 32.6% → 53.9% | 38.3% → 52.1% |
| Demario and Luigion | 34.9% → 34.6% | 41.9% → 39.3% |
| Cellblock | 55.2% → 54.2% | 59.9% → 57.0% |
| Counterplay — Dark Control | 48.7% → 55.7% | 47.1% → 54.7% |

The detective and mixed Dark Control crews improved under both policies, and Electric's lead narrowed. Pure Dark improved only modestly and remains weak. Water remains dominant under greedy play despite its smaller payoffs; its improvement toward the middle is limited to the seeded policy. Light and Demario declined under both policies, and Fire's greedy result fell even as its seeded result improved. This is a targeted pass, not evidence that every crew or element is balanced, nor an isolated causal estimate for any one of the seven cards.

Run from the repository root:

```sh
pnpm --filter @workspace/scripts run balance:elements --label=v16 --out-dir=results/element-audit/v16
pnpm --filter @workspace/scripts run balance:elements --seeded --label=v16 --out-dir=results/element-audit/v16
```

Regression coverage includes collection/battle stat parity and exact-cost play for both owners; Alchy's old/new trigger rounds and disabled states; Conductor's Water/non-Water and blocked-movement cases; Wiretap's solo/crowded no-refund and one-use discount; Foreman's partial/completed jobs and serialized no-repeat behavior; and authoritative crew/online replay. The new cost and tempo tests run through the default game test command.

Type checking, frontend/API builds, and bundle-budget checks passed. The affected battle, card, and multiplayer checks passed, and the running mobile preview was checked.

**Remaining verification gap:** the broader owned-test-database API suite passed 192 of 193 checks. Its full new-account campaign journey timed out while solving `cracked-head-takes-the-block`; an isolated campaign retry hit the same 10,000 ms / 40,000-expansion search limit after 8,081 expansions. A focused comparison also reproduced that timeout on both the pre-patch v15 and current v16 engines with identical participating card definitions, encounter, crew, and districts; none of the seven changed cards appears in that match. That focused fixture used default level-one upgrades, not the HTTP journey's database-derived XP. This is evidence of a pre-existing solver verification gap, not a passing end-to-end campaign result or proof that the battle is unwinnable. Neither search budgets nor campaign gameplay were changed to hide it.

## Balance patch 15

- **Abuela:** her existing healing/protection/lunch also gives the target +1 Hand. Healing still restores only damage actually taken.
- **Church Auntie:** her reveal grants +3 Hands to a Light target, or the existing +2 to another element. Protection-block rewards remain unchanged.
- **Night Shift Medic:** her reveal also gives the weakest other local Light character +1 Hand, even on a healthy board. This does not pretend a cleanse occurred or spend the cleanse-reaction trigger.
- **Foodz:** each district's weakest other friendly character receives +2 Hands if Light, otherwise +1. The actual-cleanse recovery bonus remains.
- **Rooftop Gardener:** printed Hands 1 → 2. The +3-Hand Seed harvest happens at this round's end instead of next round's end. It stays local and pays once.
- **Performative Male:** printed Hands 3 → 4; gives the promised ally +1 Hand immediately. The original follow-up still requires a later helpful action; the initial +1 cannot fulfill its own promise.
- **Matcha Freak:** printed Hands 2 → 3, with the same Motion cost and ability.
- **Demario:** consuming a Mushroom with a non-Luigion character grants +2 Hands instead of +1. Normal/Powered Luigion still receives +2; echoes still cannot consume a Mushroom.
- **Inmate Kingpin:** 1 Motion / 2 printed Hands, down from 1 / 3. Contraband passing, three-carrier payoff, and the once-per-Kingpin limit are unchanged.
- **Watson:** also gives +2 Hands to a friendly Sherlock he protects, without changing unpaired Watson's recovery or protection.
- **TRON:** still grants up to three other allies +1 Hand each, but the 1-Motion refund now requires all three recipients instead of two.

Card balance and online rules versions are both **15**. Global Motion, crew sizes, card ownership, upgrade identities, rewards, and artwork are unchanged.

## Comparing the reports

The official comparison uses the same 13 hand-picked crews before and after: nine named elemental decks, Cellblock (including the Normal core), Sherlock/Watson, Demario/Luigion, and mixed Dark Control. These are not optimized decks or player match statistics.

Each policy runs **1,248 distinct matches**, with **192 appearances per crew**, both player/CPU seats, two fixed district seeds, rotations 0/5, and upgrade tiers 0/3. SQUABBLE is enabled. A score rate is `(wins + draws / 2) / games`, not a draw-excluding win rate. Greedy and seeded-legal policies are two limited automated play styles, not human skill brackets.

- `v14/greedy.json` and `v14/seeded.json`: preserved pre-patch full-matrix reports from balance 14.
- `v15/v15-greedy.json` and `v15/v15-seeded-legal.json`: full post-patch reports, including failures, matchup/tier breakdowns, card observations, and schedule metadata.
- The older top-level `greedy.json` / `seeded.json` files are the historical balance-14 reports, not a moving "latest" pointer.
- The new runner exits unsuccessfully if any simulation fails. Historical v14 exports lacked an explicit failure summary; their exact full schedule and deck lists have been preserved rather than reconstructed from a different sample.

### Final before/after results

Both final runs completed: **2,496 matches, zero simulation failures**. The figures below are bot score rates, not player win rates.

| Crew | Greedy v14 → v15 | Seeded-legal v14 → v15 |
|---|---:|---:|
| Light | 31.0% → 38.8% | 41.7% → 47.9% |
| Water | 75.0% → 77.1% | 74.5% → 73.7% |
| Plant | 38.0% → 53.6% | 38.8% → 44.0% |
| Electric | 70.1% → 69.8% | 76.8% → 75.5% |
| Dark | 38.0% → 35.2% | 25.5% → 25.3% |
| Earth | 51.8% → 50.0% | 47.7% → 47.4% |
| Fire | 37.8% → 35.2% | 53.9% → 52.1% |
| Air | 71.4% → 68.0% | 49.7% → 48.4% |
| Poison | 53.9% → 51.0% | 49.5% → 48.4% |
| Sherlock and Watson | 38.3% → 32.6% | 38.3% → 38.3% |
| Demario and Luigion | 31.5% → 34.9% | 43.2% → 41.9% |
| Cellblock | 67.2% → 55.2% | 62.8% → 59.9% |
| Counterplay — Dark Control | 46.1% → 48.7% | 47.7% → 47.1% |

Light and Plant improved under both policies; Cellblock moved closer to the middle. This is not an all-crews-balanced claim: Water/Electric remain strong; the official Dark and detective decks remain weak; Demario's deck improvement is not consistent across policies. The detective pair's direct interaction is stronger, but the surrounding field improved too. Air was not directly nerfed again because its two-policy results remain markedly different.

Run from the repository root:

```sh
pnpm --filter @workspace/scripts run balance:elements --label=v15 --out-dir=results/element-audit/v15
pnpm --filter @workspace/scripts run balance:elements --seeded --label=v15 --out-dir=results/element-audit/v15
```

`--quick` keeps one existing seed and rotation 0, both tiers and seats: 312 matches, 48 appearances per crew. Compare quick runs only with the same quick schedule, not with the full leaderboard. Unknown/malformed flags fail rather than silently choosing defaults.

## Separate Dark composition pilot

The official Dark deck is deliberately unchanged for the engine comparison. `dark-composition-*.json` tests the original deck, a lower-cost all-Dark variant, and a mixed-support variant against the same Water/Electric/Earth/Poison opponents, seeds, rotations, tiers, and seats. The original deck identity is reused to hold deterministic shuffles constant.

Each variant has only **32 games per policy**. These are composition probes, not additional element balance results or proof that a particular card needs a buff. The lower-cost variant improved both sampled policies; simply adding Buddy/Plug did not consistently improve the original. No broad Dark buff or recommended-deck replacement is inferred from this small sample.

```sh
pnpm --filter @workspace/scripts run balance:dark-composition
pnpm --filter @workspace/scripts run balance:dark-composition --seeded
```

## Release checks

The patch is covered by targeted both-owner ability tests, deterministic crew/reward replay, online-rule rejection tests, battle and roster suites, root typechecking, and frontend/API builds. Existing assertions for Abuela's old zero-Hand setup were updated to explicitly verify the new +1 while retaining protection, recovery, and one-use Lunch checks. The browser preview was also checked.