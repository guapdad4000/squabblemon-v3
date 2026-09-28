# Element balance evidence

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