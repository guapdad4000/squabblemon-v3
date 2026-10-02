# Squabblehouse current-rules offline balance sweep

- Run: pilot
- Engine/source commit: `9aebdd31c605679a7cf8e578efcbbe72936d87f3`
- Versions: `@workspace/squabblemon-engine@0.0.0`; card balance 29; online rules 29; BalanceLab schema 1
- Deterministic configuration fingerprint: `7bf5ecdc92cfd06d7a9b92db3acd50fd32e682bdfdd40c8796b56c9ed779bd92`
- Runtime: 11.41 s
- Squabble: on; tiers 0 and 3; mirrored seats
- Exact fixed shell: squabble-house-manager, cane-corso-red, blue-nose-pit, squabblehouse-security, squabblehouse-teknician, griddle-master, inmate-reformed, janitor, triple-og-blue, triple-og-red
- Shared shell orderKey: `squabblehouse-balance-shell-v1`

## Canonical current opponent crews

| ID | Current name | Exact roster |
| --- | --- | --- |
| focus-wonderland | Wonderland Return | alice, cheshire, queenofhearts, mrrabbit, dorothy, laundry, waterboy, guap, alchy, madhatter |
| focus-fire-guap | Fire and GUAP | guap, folks, hooper, bbldemon, cornercoach, cognac, krump, dancecaptain, og, baby |
| focus-wiz | The Wiz | dorothy, scarecrow, tinman, oz, lion, passportbro, break, bboy, wickedwitch, flyingmonkeys |

## Matchup results

| Matchup | Policy | Schedule | Games | W-L-D | Outright wins | Half-draw score | Player seat | CPU seat | Tier 0 | Tier 3 | Failures |
| --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| focus-wonderland | greedy | Pilot: 1 seeds × 1 rotations | 4 | 0-4-0 | 0.0% | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0 |
| focus-fire-guap | greedy | Pilot: 1 seeds × 1 rotations | 4 | 2-2-0 | 50.0% | 0.500 | 0.000 | 1.000 | 0.500 | 0.500 | 0 |
| focus-wiz | greedy | Pilot: 1 seeds × 1 rotations | 4 | 1-3-0 | 25.0% | 0.250 | 0.000 | 0.500 | 0.000 | 0.500 | 0 |

## Runtime card costs

- squabble-house-manager: 1 Motion
- cane-corso-red: 2 Motion
- blue-nose-pit: 2 Motion
- squabblehouse-security: 4 Motion
- squabblehouse-teknician: 5 Motion
- griddle-master: 3 Motion
- inmate-reformed: 3 Motion
- janitor: 3 Motion
- triple-og-blue: 4 Motion
- triple-og-red: 4 Motion

## Card deployments and trigger evidence

Per-card deployment, corrected Squabblehouse event-note counts, final copies, and power are retained in `cardSummaries`; raw generic ability-observer counts are preserved but are not base-ability reliability estimates. This is play-conditioned descriptive evidence, not a causal estimate of card strength. The engine observation classifies logged ability events; ongoing/passive effects that do not emit a source-attributed ability event may be undercounted. Full wave-card event notes, success classifications, and targets are retained per game under `waveCardEventObservations`.

## Corrected observations and limitations

The inherited /SQUABBLE/i play-note substring counter is a false positive for Squabblehouse names. Raw per-match results remain unchanged; aggregate counts for the six wave cards are recomputed only from notes matching /\bSQUABBLE doubled\b/i. Other shell cards (including Squabble House Manager) are unknown, not zero.

| Wave card | Logged play notes | Recomputed SQUABBLE doubled notes | Explicit ability-note evidence |
| --- | ---: | ---: | --- |
| squabblehouse-security | 10 | 0 | 0 no-enemy notes |
| squabblehouse-teknician | 11 | 0 | 10 eligible echo notes; 0 no-eligible notes |
| griddle-master | 11 | 0 | 1 no-enemy notes |
| inmate-reformed | 12 | 0 | 2 no-staff-bonus notes |
| cane-corso-red | 4 | 0 | 3 matching OG absent |
| blue-nose-pit | 7 | 0 | 5 matching OG absent |

Generic ability-success rates are not base-ability reliability rates: base wrappers and ability-upgrade events cannot be separated from retained event excerpts. Aggregate abilitySuccessRateWhenObserved is null; the inherited rate is kept for audit only. Passive dog protection/tanking and Security ongoing value may be undercounted.
## Failures and interpretation

Recorded failure entries: 0. No failed simulation is silently discarded; each matrix failure group and raw replay failure is retained in the JSON.

These deterministic bot-vs-bot outcomes are not human win rates. Greedy and seeded-legal represent policy sensitivity, not estimates of human play. A card that is played more often, or has a high success rate conditional on an ability event, is not thereby proven stronger.

## Reproduction

```sh
pnpm --filter @workspace/scripts exec tsx src/squabblehouse-balance-sweep.ts --pilot
for matchup in focus-wonderland focus-fire-guap focus-wiz; do
  for policy in greedy seeded-legal; do
    pnpm --filter @workspace/scripts exec tsx src/squabblehouse-balance-sweep.ts --shard "$matchup:$policy:primary"
  done
  pnpm --filter @workspace/scripts exec tsx src/squabblehouse-balance-sweep.ts --shard "$matchup:greedy:holdout"
done
pnpm --filter @workspace/scripts exec tsx src/squabblehouse-balance-sweep.ts --merge
```

Run the runtime pilot first with `--pilot`; each shard is independently resumable and writes a raw JSON chunk. `--merge` requires all nine matching-fingerprint chunks and writes the final `current-rules` JSON/Markdown report.

Each unique schedule cell is reported once (1,008 requested primary + holdout cases); the raw match records are replay-validated against the aggregate `runBalanceMatrix` execution. Matrix runs plus raw capture are duplicate validations, not 2,016 independent samples.

## Provenance

The exact current opponent names/rosters come from `createDefaultBalanceDecks()`. Engine `CARD_BALANCE_VERSION=29` and `ONLINE_RULES_VERSION=29` were read from the current engine exports; no online service was invoked. Current runtime kits, costs, and source-file SHA-256 fingerprints are in the JSON. No production engine, app, saved deck, database, or balance values are modified.
