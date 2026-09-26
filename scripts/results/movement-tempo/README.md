# Movement and tempo audit — September 25, 2026

## Finding

Hand-bond scaling is the largest contributor among the mechanisms isolated here. The evidence does not justify removing Tin Man's new Hand reward or E.V. Enthusiast's Motion refund. A separate, reproducible counterplay bug did need repair: Weaken failed to disable STOCKZ, Streamer, Boss Bae, and Wifey's round-start Protection refresh.

The shipping change uses the same active-ability gate as other engines for those four reactions. Existing earned Hands remain; disabled reactions do not spend Streamer's allowance or Boss Bae's counter. Cleansing re-enables future reactions. Online and reward balance versions advance to 7. No printed card stats, refund amounts, or hand bonds are changed by this patch.

## Matched experiment

Pinned baseline: `1926c7d6f3ed10db96b3f0e394bdf20233b2c5d0`.

Two subjects (Earth Rides and starter Voltage), seven opponents (Fire, Air, coherent control, Poison, Wonderland, Wiz, Mushroom Garden), two new district seeds, rotations 0/5, training tiers 0/3, both seats, SQUABBLE enabled. Each subject plays 112 games per experiment/policy. Baseline is tested with greedy and seeded-legal policies. Four separate ablations keep card IDs, draw order, costs, bodies, and opponents fixed; only the named mechanic is disabled in a temporary engine copy. Candidate tests apply the shipping engine fix to the same pinned source tree. Total: 1,120 simulations.

| Test | Earth score | Electric score |
| --- | ---: | ---: |
| Baseline, greedy | 95.54% | 77.23% |
| Baseline, seeded-legal | 63.39% | 76.79% |
| Tin Man Protection only, greedy | 94.64% | — |
| Concrete and Torta bonds disabled, greedy | 51.34% | — |
| E.V. Enthusiast refund disabled, greedy | — | 74.11% |
| Electrician Foreman bond disabled, greedy | — | 39.29% |
| Shipping Weaken fix, greedy | 95.54% | 77.23% |

Scores count draws as half a win. Ablations are diagnostics, not proposed card removals. They are not additive estimates of a card's individual strength, and the candidate's unchanged aggregate score does not invalidate the directly reproduced counterplay bug.

Electric's training split is pronounced: tier 0 scores 63.39% greedy / 60.71% seeded, while tier 3 scores 91.07% / 92.86%. A pure hand bond grants +1 to every matching ally each round, then each trained tier supplies another +1 boost each round. Concrete and Torta stack both their ordinary grants and their trained grants. This deserves a separate, measured bond-stacking and training-budget experiment before further broad buffs.

Earth is strongly policy-sensitive: 95.54% greedy versus 63.39% seeded. Electric's high score is much less policy-sensitive. Both are deterministic bot results, not live win-rate estimates; no human playtest gate is satisfied by this audit.

## Tempo observations

In the greedy baseline, Earth restored 0 Motion per match and Electric averaged 0.34; Electric averaged 0.82 free plays. Under seeded play, Electric restored 0.54 and made 0.54 free plays per match. These observations do not support a refund-loop explanation for these lineups. Voltage does not contain Pirate Radio DJ; its bounded second-Electric refund remains covered separately by the existing engine tests.

Per-match telemetry records actual paid Motion, net restored Motion after the deployment's legal cost, free deployments, and district changes by cards already on the board. `existingCardMoves` intentionally excludes self-movement by a newly deployed card and is not a total movement-event count. Full results and seat/tier aggregates are stored alongside this report.

## Reproduction

```sh
pnpm --filter @workspace/scripts exec tsx src/movement-tempo-audit.ts
pnpm --filter @workspace/scripts exec tsx src/movement-tempo-audit.ts --policy seeded
pnpm --filter @workspace/scripts exec tsx src/movement-tempo-audit.ts --experiment earth-no-bonds
pnpm --filter @workspace/scripts exec tsx src/movement-tempo-audit.ts --experiment electric-no-bond
pnpm --filter @workspace/scripts exec tsx src/movement-tempo-audit.ts --experiment tin-protection-only
pnpm --filter @workspace/scripts exec tsx src/movement-tempo-audit.ts --experiment ev-no-refund
pnpm --filter @workspace/scripts exec tsx src/movement-tempo-audit.ts --experiment candidate
```

The candidate option uses the working tree's engine implementation with the baseline registry. All experiments extract to temporary directories and clean them afterward; ablations never mutate playable cards in the repository.

## Validation and incidental repair

- Eight regression cases failed on the baseline and pass with the fix: all four affected reactions for both owners. STOCKZ's existing disabled-status test now covers Weaken too.
- 147 focused engine, movement, refund, multiplayer, and transcript tests pass; nine reward-snapshot tests pass.
- Library, application, and script typechecks pass; production build and entry-bundle budget pass.
- The full suite exposed an upstream story regression: the active composition omitted Chapter One, exported an empty Chapter One placeholder and venue table, and had removed story validation. Restored the complete definitions from `d33f9dc`, retaining both current dialogue expansions. This restores the missing battles and the original validation rather than weakening the failing tests.

After restoration, the full Node 24 application suite has 708 passing tests and the two known stale assertions (story version 7 versus 9, Earth count 19 versus 23). The new story failures are resolved.
