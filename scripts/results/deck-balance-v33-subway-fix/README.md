# Subway crash correction — approved balance33 / rules33

**Accepted complete audit: 3,392 / 3,392 successful simulations; zero failures.**
The separate original-failure replay also passed **18 / 18**. No cases, legal options, crews or comparison axes were removed to obtain completion.

## Integrity and parity

- Full plan exactly matches the historical ordered schedule and all deck definitions, IDs and draw-order keys: 2,112 league, 192 counter-screen and 1,088 confirmation cases. Policies, seats, seeds, rotations and tiers are unchanged.
- All 18 original failed keys agree with historical shards and findings, selected in original plan order. Their fresh results **and traces** exactly match the corresponding full-run rows.
- All **3,374 previously successful rows** remain exactly identical, including result telemetry and diner traces. The remaining 18 are recovered simulations, not old losses or omitted samples.
- All **11 frozen historical evidence files** remain byte-identical to `baseline.json` (itself verified against the pre-edit baseline). Of 61 fingerprinted source files, only `gameEngine.ts` and `deck-balance-audit.ts` changed; 59, including the report renderer and balance/rules definitions, did not.
- Old source: `f9bfa32d48e5d06ed2fba8ba7193c58b243510794ab7c23b50958f4a78a117ab`.
- Final source: `8c429a01fc75dbec7086da879b00ee837db90bebf9b0c899d86aa6d42ad8c732`.

Independent checks covered exact shard partitions, unique completeness, zero failures, result axes, legal winner values and seat mapping, telemetry rosters, source/version consistency, and exact complete-sample summary/report rendering. File attestations and denominators are in [`provenance.json`](provenance.json). Gameplay legality is additionally covered by the parent's 14 Subway regressions; evidence inspection is not a substitute for those tests.

## Current complete-sample observations

See [`full/report.md`](full/report.md) and [`full/summary.json`](full/summary.json).

- Twelve-crew league: 352 games per crew. SQUABBLEHOUSE SHIFT: 238 wins / 92 losses / 22 draws, **70.7% score** (67.6% wins), second behind Wonderland Return's 84.4% score.
- Diner versus all 17 opponents: 1,632 games, 96 per opponent (32 primary + 64 fresh confirmation). Overall: 1,082 wins / 441 losses / 109 draws, **69.6% score** (66.3% wins).
- Diner score spans 33.3% against Wonderland Return to 87.0% against COMPOUND INTEREST. Manager appeared in 1,622 games; mean peak 11.82 Hands / 5.63 ongoing, maxima 25 / 7.

These are fixed deterministic greedy and seeded-legal **bot samples, not player win rates, optimized crew strength, or isolated causal card strength**. Draws count as half a point. Event counts are descriptive and do not establish ability reliability. Recovery of incomplete samples is not evidence of a balance buff.

## Execution and reproduction

Parent-managed run: 13 commands, all exit 0, **236.012 seconds wall time**. Failure worker: 6.799 seconds; eight full workers: 424 cases each, 144.719–226.114 seconds. Exact commands, timestamps and exits: [`execution.json`](execution.json); progress: `logs/`.

From `scripts/`, using **new, nonexistent output directories** (the CLI refuses overwrites):

```sh
node --import tsx src/deck-balance-audit.ts --out <new-root>/failed-cases --init-failures results/deck-balance-v33-onshift
node --import tsx src/deck-balance-audit.ts --out <new-root>/failed-cases --worker 0 1
node --import tsx src/deck-balance-audit.ts --out <new-root>/failed-cases --merge 1
node --import tsx src/deck-balance-audit.ts --out <new-root>/full --init --from-plan results/deck-balance-v33-onshift/plan.json
# Launch indices 0 through 7 with the supported managed background mechanism, then await all exits:
node --import tsx src/deck-balance-audit.ts --out <new-root>/full --worker <index> 8
node --import tsx src/deck-balance-audit.ts --out <new-root>/full --merge 8
```

Run replay first, then the entire original schedule on one frozen source. Do not run the historical `deck-balance-audit-results.ts` analyzer against these results. Only complete zero-failure full samples receive matchup summaries; the separate replay receives no balance-rate report.

## Verification limits and separate follow-ups

Parent reports all 28 balanceLab/telemetry/audit tests and 14 Subway regressions passing, plus engine/frontend/scripts typechecks. The broader focused engine/staff/replay suite has 261 passes and **two pre-existing campaign transcript assertion failures**, independently reproduced against the original git HEAD engine (`verification/engine-suite.log`, `verification/baseline-campaign-tests.log`; proposed task 277).

Existing nonlethal replay arrival-order duplication is recorded in `verification/nonlethal-replay-observation.json` (proposed task 276); it is not claimed fixed here. See the parent's `verification/README.md` for detailed regression and visual checks. No historical evidence, database state, published artifacts or balance values were changed by this evidence work.