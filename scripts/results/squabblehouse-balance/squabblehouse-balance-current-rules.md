# Squabblehouse current-rules offline balance sweep

> **Roster correction — not a Squabblehouse staff-deck baseline:** The user clarified that the dogs and Triple OGs belong in gang decks, not the Squabblehouse staff deck. This sweep tested a mixed staff-and-gang roster. Its outcomes remain valid for that exact roster only; they do not establish the intended Squabblehouse deck's win rates or justify the earlier buff/rework recommendations. A corrected roster must be tested separately.

- Run: primary plus greedy holdout
- Engine/source commit: `9aebdd31c605679a7cf8e578efcbbe72936d87f3`
- Versions: `@workspace/squabblemon-engine@0.0.0`; card balance 29; online rules 29; BalanceLab schema 1
- Deterministic configuration fingerprint: `27fb864f21e13423ea141773db39d55a3c3935ba613803aaf3261922154193cf`
- Runtime: 1421.43 s summed shard time; 899.28 s start-to-finish wall-clock envelope (bounded parallel shards).
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
| focus-wonderland | greedy | Primary: 12 seeds × 3 rotations | 144 | 8-130-6 | 5.6% | 0.076 | 0.021 | 0.132 | 0.104 | 0.049 | 0 |
| focus-wonderland | seeded-legal | Primary: 12 seeds × 3 rotations | 144 | 21-113-10 | 14.6% | 0.181 | 0.146 | 0.215 | 0.215 | 0.146 | 0 |
| focus-fire-guap | greedy | Primary: 12 seeds × 3 rotations | 144 | 25-100-19 | 17.4% | 0.240 | 0.125 | 0.354 | 0.167 | 0.313 | 0 |
| focus-fire-guap | seeded-legal | Primary: 12 seeds × 3 rotations | 144 | 44-83-17 | 30.6% | 0.365 | 0.319 | 0.410 | 0.368 | 0.361 | 0 |
| focus-wiz | greedy | Primary: 12 seeds × 3 rotations | 144 | 24-111-9 | 16.7% | 0.198 | 0.090 | 0.306 | 0.236 | 0.160 | 0 |
| focus-wiz | seeded-legal | Primary: 12 seeds × 3 rotations | 144 | 51-82-11 | 35.4% | 0.392 | 0.417 | 0.368 | 0.465 | 0.319 | 0 |
| focus-wonderland | greedy | Fresh holdout: 6 seeds × 2 rotations | 48 | 2-43-3 | 4.2% | 0.073 | 0.000 | 0.146 | 0.063 | 0.083 | 0 |
| focus-fire-guap | greedy | Fresh holdout: 6 seeds × 2 rotations | 48 | 14-24-10 | 29.2% | 0.396 | 0.146 | 0.646 | 0.396 | 0.396 | 0 |
| focus-wiz | greedy | Fresh holdout: 6 seeds × 2 rotations | 48 | 8-35-5 | 16.7% | 0.219 | 0.021 | 0.417 | 0.229 | 0.208 | 0 |

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

Per-card deployment, observed ability-event triggers/successes, squabbles, final copies, and average final power are retained by matchup/policy in the raw JSON under `cardSummaries`. This is play-conditioned descriptive evidence, not a causal estimate of card strength. The engine observation classifies logged ability events; ongoing/passive effects that do not emit a source-attributed ability event may be undercounted. Full wave-card event notes, success classifications, and targets are retained per game under `waveCardEventObservations`.

## Corrected observations and limitations

The legacy balanceLab per-card squabbles counter is a substring false positive: it matches /SQUABBLE/i in Squabblehouse play notes. Raw per-match observations are preserved unchanged; the old value remains under unreliableBalanceLabSquabbleSubstringCount. For the six wave cards below, aggregate squabbles is recomputed from retained source-attributed play notes using /\bSQUABBLE doubled\b/i. Other shell cards (including Squabble House Manager) are explicitly unknown, not zero.

| Wave card | Logged play notes | Recomputed SQUABBLE doubled notes | Specific ability-event note evidence (descriptive) |
| --- | ---: | ---: | --- |
| squabblehouse-security | 847 | 23 | 97 explicit no-enemy notes |
| squabblehouse-teknician | 770 | 16 | 759 logged eligible staff echo notes; 5 explicit no-eligible notes |
| griddle-master | 823 | 116 | 225 explicit no-enemy notes |
| inmate-reformed | 829 | 70 | 322 explicit no-staff-bonus notes |
| cane-corso-red | 693 | 167 | 651 explicit matching-OG-absent notes |
| blue-nose-pit | 881 | 249 | 767 explicit matching-OG-absent notes |

Generic observer ability-success rates are not base-ability reliability rates: wrapper events and upgrade-success events are mixed, and retained event excerpts do not include abilityMetadata. Therefore abilitySuccessRateWhenObserved is null in shell-card summaries; the inherited ratio is kept as legacyObserverAbilitySuccessRate for audit only. Use explicit notes (for example, Teknician eligible repeat vs. no eligible staff, a dog waiting for its matching OG, no enemy in lane, or Inmate without staff bonus) as descriptive evidence—not as a causal card-strength estimate. Passive dog protection/tanking and Security ongoing triggers may be missing or not source-attributed.
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
