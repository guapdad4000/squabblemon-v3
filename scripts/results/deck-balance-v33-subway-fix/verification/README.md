# Subway crash-fix verification

The gameplay change is limited to the missing-rider branch after a Subway move.
If arrival effects removed the rider, the engine returns their already-committed
state and events instead of dereferencing the missing card or creating a phantom
movement/blocked target. No card budgets, staff identities, starter recipes,
balance/rules versions, or database data were changed.

## Checks

| Check | Result | Evidence |
| --- | --- | --- |
| Original-engine lethal rider regressions, both seats | Reproduced the original missing-card `lane` exception | `subway-before-fix.log` |
| Corrected direct-play, legal-candidate and player UI-preview regressions | 14 passed, 0 failed | `subway-after-fix.log` |
| Broader engine, district, staff, transcript and replay suites | 261 passed, 2 pre-existing campaign-content failures | `engine-suite.log` |
| The two campaign assertions against the pre-fix shared engine | Same two failures, independently confirmed | `baseline-campaign-tests.log` |
| Balance simulation, telemetry and audit-harness suites | 28 passed, 0 failed | `balance-suite.log` |
| Shared-library typecheck | Passed: `pnpm run typecheck:libs` | Run before the leaf-package checks |
| Web typecheck | Passed: `pnpm --filter @workspace/squabblemon run typecheck` | No frontend type errors |
| Scripts typecheck | Passed: `pnpm --filter @workspace/scripts run typecheck` | After correcting readonly mutations in the new test fixtures only |
| Public guest preview | Loaded successfully; no browser errors | `screenshots/subway-fix-guest-preview.jpg` in the workspace |

The 14 new regressions cover both seats: lethal and nonlethal Security tax,
Security's committed +1, successful rides from each lane (including 2 to 0),
locked/full destinations, first-play consumption after defeat or blockage,
independent sides and next-round reset, protection/immunity/Janitor reversal,
and nested Cook/Bonnetgirl reactions plus a neutral Manager aura-loss casualty.
They compare committed play with legal bot previews, player-visible preview
results, and presentation-suppressed gameplay, and verify input immutability.
The tests are registered in the normal and battle suites and can be run alone
with `pnpm --filter @workspace/squabblemon run test:subway`.

## Broader-suite commands

```sh
pnpm --filter @workspace/squabblemon exec node \
  --import ../../scripts/battle-test-css.mjs --import tsx \
  --test --test-concurrency=2 \
  src/subwayArrival.test.ts src/districts.test.ts \
  src/squabblehouseWave.test.ts src/dinerOnShift.test.ts \
  src/dinerOnShiftAuthority.test.ts src/dinerOnShiftPresentation.test.tsx \
  src/dinerCounters.test.ts src/gameEngine.test.ts src/multiCardTurns.test.ts \
  src/botBalance.test.ts src/matchTranscript.test.ts src/battlePreview.test.ts \
  src/battleDestruction.test.ts src/battleChoreography.test.ts \
  src/rosterBalance.test.ts src/squabblehouseCatalog.test.ts

pnpm --filter @workspace/scripts exec node --import tsx \
  --test --test-concurrency=2 \
  src/balanceLab.test.ts src/balanceTelemetry.test.ts \
  src/balanceSweepTelemetry.test.ts src/deck-balance-audit.test.ts
```

## Existing issues deliberately not changed

- `later-season encounters use authored dialogue cards and preserve reveal order`
  fails on `church-aunties-setup` having fewer aftermath lines than its assertion
  requires.
- `early campaign balance content retains IDs, rewards, and authored encounter rules`
  expects story-content version 10, while the unchanged content is version 11.

For the baseline confirmation, the original shared engine was read from the
pre-edit Git revision recorded in `../baseline.json` and substituted into an
isolated temporary bundle of the unchanged transcript tests. Only those two
named assertions were run. They failed identically; no working engine file was
reverted, and audited source files stayed frozen throughout the full rerun.
The story tests and story content were not weakened or altered for this fix.

The existing nonlethal Subway replay wrapper also repeats the arrival transition
in its final movement snapshot. `nonlethal-replay-observation.json` records a
surviving rider's lane and Security modifier before and after each event. This
predates the crash guard and is recorded as separate follow-up work; no event
reordering or balance changes are hidden in this patch.

## Audit and operational boundaries

See `../README.md`, `../provenance.json`, `../full/report.md`, and
`../failed-cases/replay-summary.json` for the complete corrected audit, exact
schedule/source checks, and historical-file integrity proof. The 18 failure
replays are an additional check, not extra games mixed into the 3,392-case
denominator.

Only the existing frontend workflow was started for the public guest preview.
No authentication bypass was added, and signed-in play was not browser-tested.
All gameplay audits and regression tests were offline/in-memory. Nothing was
published or pushed, and no database was changed.