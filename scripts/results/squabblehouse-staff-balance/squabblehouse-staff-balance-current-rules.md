# Squabblehouse staff current-rules offline balance sweep

- Roster mode: staff (approved staff shell; not optimized)
- Run: primary plus fresh greedy holdout
- Engine/source commit: `b367258a9b85f308064fcc794c2a6316a4e53cd7`
- Versions: `@workspace/squabblemon-engine@0.0.0`; card balance 29; online rules 29; BalanceLab schema 2
- Deterministic configuration fingerprint: `cb78fd57bda5b7f3b98b23f07004c67cdba09e714c518e87a4c748b270593913`
- Runtime: 1093.96 s
- Squabble: on; tiers 0 and 3; mirrored seats
- Exact fixed shell: squabble-house-manager, plug, waterboy, squabblehouse-security, squabblehouse-teknician, griddle-master, inmate-reformed, janitor, laundry, nail
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
| focus-wonderland | greedy | Primary: 12 seeds × 3 rotations | 144 | 21-115-8 | 14.6% | 0.174 | 0.083 | 0.264 | 0.097 | 0.250 | 0 |
| focus-wonderland | seeded-legal | Primary: 12 seeds × 3 rotations | 144 | 28-108-8 | 19.4% | 0.222 | 0.174 | 0.271 | 0.194 | 0.250 | 0 |
| focus-fire-guap | greedy | Primary: 12 seeds × 3 rotations | 144 | 30-97-17 | 20.8% | 0.267 | 0.118 | 0.417 | 0.181 | 0.354 | 0 |
| focus-fire-guap | seeded-legal | Primary: 12 seeds × 3 rotations | 144 | 50-86-8 | 34.7% | 0.375 | 0.354 | 0.396 | 0.271 | 0.479 | 0 |
| focus-wiz | greedy | Primary: 12 seeds × 3 rotations | 144 | 37-96-11 | 25.7% | 0.295 | 0.076 | 0.514 | 0.313 | 0.278 | 0 |
| focus-wiz | seeded-legal | Primary: 12 seeds × 3 rotations | 144 | 59-71-14 | 41.0% | 0.458 | 0.444 | 0.472 | 0.438 | 0.479 | 0 |
| focus-wonderland | greedy | Fresh holdout: 6 seeds × 2 rotations | 48 | 4-43-1 | 8.3% | 0.094 | 0.000 | 0.188 | 0.000 | 0.188 | 0 |
| focus-fire-guap | greedy | Fresh holdout: 6 seeds × 2 rotations | 48 | 11-29-8 | 22.9% | 0.313 | 0.083 | 0.542 | 0.229 | 0.396 | 0 |
| focus-wiz | greedy | Fresh holdout: 6 seeds × 2 rotations | 48 | 13-33-2 | 27.1% | 0.292 | 0.083 | 0.500 | 0.250 | 0.333 | 0 |

## Runtime card costs

- Squabble House Manager (squabble-house-manager): 1 Motion
- Plug (plug): 1 Motion
- Water Boy (waterboy): 1 Motion
- Squabblehouse Security (squabblehouse-security): 4 Motion
- Squabblehouse Teknician (squabblehouse-teknician): 5 Motion
- Griddle Master (griddle-master): 3 Motion
- Inmate Reformed (inmate-reformed): 3 Motion
- Janitor (janitor): 3 Motion
- Laundromat Regular (laundry): 2 Motion
- Nail Tech (nail): 2 Motion

## Card deployments and trigger evidence

Per-card deployment, source-attributed event notes, structured base/nested/upgrade evidence, replay-confirmed SQUABBLE consumption where event coverage is complete, final copies, and average final power are retained by matchup/policy under `cardSummaries` and `crewCardEventObservations`. Legacy mixed-event ratios are labelled audit-only, and ability reliability is null for both crews: zero-delta wrappers can represent successful nested echoes, and unlogged eligibility/passive value remains unknown. Historical raw outcomes are not rewritten. Card appearance/play-conditioned evidence is descriptive, not causal card strength.

## Failures and interpretation

Recorded failure entries: 0. No failed simulation is silently discarded; each matrix failure group and raw replay failure is retained in the JSON.

These deterministic bot-vs-bot outcomes are not human win rates. Greedy and seeded-legal represent policy sensitivity, not estimates of human play. A card that is played more often, or has a high success rate conditional on an ability event, is not thereby proven stronger.

## Reproduction

```sh
pnpm --filter @workspace/scripts exec tsx src/squabblehouse-balance-sweep.ts --roster staff --pilot
for matchup in focus-wonderland focus-fire-guap focus-wiz; do
  for policy in greedy seeded-legal; do
    pnpm --filter @workspace/scripts exec tsx src/squabblehouse-balance-sweep.ts --roster staff --shard "$matchup:$policy:primary"
  done
  pnpm --filter @workspace/scripts exec tsx src/squabblehouse-balance-sweep.ts --roster staff --shard "$matchup:greedy:holdout"
done
pnpm --filter @workspace/scripts exec tsx src/squabblehouse-balance-sweep.ts --roster staff --merge
```

The staff validation schedule uses six fresh `squabblehouse-staff-validation-district-*` holdout seeds, distinct from the prior mixed-shell holdout. Each shard is independently resumable and writes a raw JSON chunk in `scripts/results/squabblehouse-staff-balance/`; `--merge` requires all nine matching-fingerprint staff chunks.

Each unique schedule cell is reported once (1,008 requested primary + holdout cases); the raw match records are replay-validated against the aggregate `runBalanceMatrix` execution. Matrix runs plus raw capture are duplicate validations, not 2,016 independent samples.

## Provenance

The exact current opponent names/rosters come from `createDefaultBalanceDecks()`. Engine `CARD_BALANCE_VERSION=29` and `ONLINE_RULES_VERSION=29` were read from the current engine exports; no online service was invoked. Current runtime kits, costs, and source-file SHA-256 fingerprints are in the JSON. No production engine, app, saved deck, database, or balance values are modified.
