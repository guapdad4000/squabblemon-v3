# Dark-card sweep

`dark-card-sweep-v16-quick.json` is the bounded quick run from the current assembled shared-engine card data. It inventories every playable `Dark` character and blockbuster from `cards` after the engine's creative-kit and roster-balance assembly, including each engine card ID, name, kind, Motion cost, printed Hands, ability, and final effect text. The generated JSON is the authoritative complete inventory and result record; this file intentionally summarizes rather than duplicating the finalized card text.

## Reproduce

Run from the repository root:

```sh
pnpm --filter @workspace/scripts run balance:dark-sweep -- --quick
pnpm --filter @workspace/scripts run balance:dark-sweep -- --full
pnpm --filter @workspace/scripts run balance:dark-sweep -- --shortlist
```

Quick is the default if neither mode is specified. An optional `--out-dir=PATH` selects another output directory. The current quick JSON was generated with:

```sh
pnpm --filter @workspace/scripts exec tsx src/dark-card-sweep.ts --quick
```

Quick uses district seed `element-audit-district-00`, rotation 0, tier 0, both seats, and the four unchanged Water, Electric, Earth, and Poison element crews: 8 scheduled matches per variant and policy. Full adds `element-audit-district-01`, rotation 5, and tier 3, producing 64 matches per variant and policy. Both modes run greedy and seeded-legal policies.

The report deliberately separates two rule cohorts:

- **`characters-and-lower-cost`**: finalized character substitutions and the lower-cost Dark-only crew run with `allowSquabble: true`, matching official v16. This cohort has its own unchanged Dark baseline.
- **`blockbusters-no-squabble`**: Dark blockbuster substitutions run with `allowSquabble: false`, because the engine rejects blockbuster play under SQUABBLE. This cohort has a separate unchanged Dark baseline under the same no-SQUABBLE rule. Do not compare blockbuster cohort scores to the SQUABBLE-enabled character cohort.

Both cohorts keep the same fixed opponents and their respective schedule axes. Each variant and its cohort baseline reuse the original Dark deck identity/order key, pairing seeded deck ordering. The report records per-cohort schedules and per-opponent outcomes.

`--shortlist` is a bounded, SQUABBLE-enabled-only review of four variants: the unchanged Dark baseline, `swap-inmate-kingpin`, `swap-shiesty`, and `dark-lower-cost`. It uses Water, Electric, Air, and Counterplay — Dark Control, both original district seeds, rotations 0/5, tiers 0/3, and both seats. That is 16 games per opponent/variant/policy, **512 scheduled games total** across four variants and two policies. It writes a separate `dark-card-sweep-v16-shortlist.json`; it does not include or compare the no-SQUABBLE blockbuster cohort.

The sweep performs one substitution per non-baseline Dark card. It replaces the closest-cost baseline member (stable baseline order breaks ties), preferring an exact same-cost match. Thus `same-cost` variants hold printed cost constant, while `cost-changing` variants identify the associated deck-cost delta. It also compares the unchanged official Dark crew with the existing lower-curve, all-Dark ten-card composition (`counter`, `gamer`, `gothkid`, `nerd`, `redpill`, `shonuff`, `shiesty`, `incel`, `sugarfoot`, `subwaymagician`). Per-variant JSON includes games, wins/losses/draws, score rate, failures, score by opponent, and `balanceLab` card observations/events.

## Evidence and interpretation

The fixed v16 element-audit baseline is included as historical context: Dark scored **39.8% greedy** and **28.6% seeded-legal**, with 192 games per policy in the original 13-deck v16 matrix. Those figures come from the full element matrix (both tiers, two seeds, rotations 0/5, both seats, SQUABBLE enabled) and are not directly comparable to this deliberately small quick probe.

The quick pass completed **320 scheduled matches** total with **zero failed simulations**: 272 in the SQUABBLE-enabled cohort (17 variants × 8 games × 2 policies) and 48 in the no-SQUABBLE blockbuster cohort (3 variants × 8 games × 2 policies). In the character cohort, the unchanged Dark baseline scored **56.3% greedy** (4 wins, 1 draw, 3 losses) and **12.5% seeded-legal** (1-0-7). The lower-cost crew averaged 2.50 Motion versus the baseline's 3.20 and scored **37.5% greedy** (3-0-5) and **31.3% seeded-legal** (2-1-5). In the separate no-SQUABBLE cohort, its unchanged baseline scored 43.8% greedy and 12.5% seeded-legal. Those blockbuster figures are only comparable to their own no-SQUABBLE baseline.

The earlier first-pass quick result has been replaced; do not use its no-SQUABBLE character rates. The fresh report applies SQUABBLE to the character and lower-cost cohort as required.

### Full-roster shortlist results

The bounded shortlist completed **512/512 scheduled games with zero failures**, with 64 games per variant and policy. Scores are `(wins + draws / 2) / games`; per-opponent entries below are score rates and are also available with full W/D/L detail in the JSON. Both one-card trials replace Goth Kid, preserving the original `element-dark` identity/order key. These substitutions change a card and the deck's printed-cost curve together.

| Policy | Variant | Aggregate | Water | Electric | Air | Dark Control |
|---|---|---:|---:|---:|---:|---:|
| Greedy | Unchanged baseline | 35.2% | 28.1% | 40.6% | 34.4% | 37.5% |
| Greedy | Swap in Inmate Kingpin | 37.5% | 37.5% | 40.6% | 37.5% | 34.4% |
| Greedy | Swap in Shiesty | 53.9% | 56.3% | 46.9% | 53.1% | 59.4% |
| Greedy | Lower-cost Dark crew | 39.1% | 15.6% | 46.9% | 46.9% | 46.9% |
| Seeded-legal | Unchanged baseline | 25.8% | 37.5% | 21.9% | 15.6% | 28.1% |
| Seeded-legal | Swap in Inmate Kingpin | 35.9% | 56.3% | 25.0% | 37.5% | 25.0% |
| Seeded-legal | Swap in Shiesty | 42.2% | 62.5% | 28.1% | 50.0% | 28.1% |
| Seeded-legal | Lower-cost Dark crew | 40.6% | 40.6% | 28.1% | 65.6% | 28.1% |

These are **deck-composition probes, not causal card values or isolated buff estimates**. Scores are specific to this short schedule, fixed opponents, policy, replacement choice, and resulting cost/synergy changes; do not interpret a lift as evidence for a card-level balance change.

### Repo Man cost hypothesis

A separate **in-memory, non-shipping** trial compared the unchanged Repo Man (4 Motion, 4 Hands) against a 3-Motion/4-Hands prototype. Each variant used the unchanged pure-Dark crew identity against Water, Electric, Air, and Dark Control under SQUABBLE, with both district seeds, rotations 0/5, tiers 0/3, both seats, and both policies: **64 paired-schedule games per variant and policy**, with zero failures.

| Policy | Unchanged 4-Motion Repo Man | Prototype 3-Motion Repo Man |
|---|---:|---:|
| Greedy | 35.2% | 35.2% |
| Seeded-legal | 25.8% | 28.9% |

The greedy aggregate was flat; against Water and Dark Control it got worse. The small seeded-legal gain alone does not justify reducing Repo Man's cost, so its authoritative card text and the online/card balance versions remain unchanged. The prototype mutated the engine's card object only inside an isolated trial process; no synthetic effects or production card rules were shipped.

Across the audit, same-cost swaps control printed cost only. Replacing any card also changes sequencing, ability synergy, and the draw. The generated reports preserve per-card observations and per-opponent outcomes, but they are bot evidence, not player win rates. The entire assembled 27-card Dark roster was inventoried and screened; the 512-game shortlist was tested more deeply. The optional exhaustive `--full` matrix was **not** run, and neither composition lift nor this cost prototype proves an isolated card buff.