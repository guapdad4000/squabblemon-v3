# CPU and audit policy correctness — 2026-10-25

Sources are frozen for the v64 rerun. Card definitions, numerical balance and authoritative resolution rules are unchanged. The policy version is `online-base-shared-legal-delayed-horizon-v3`; v63 simulation evidence is stale for these policy changes.

## Changes

- One shared legal-intent enumerator supplies the live CPU, generic balance runner, full PvP sweep and its second ply. It includes canonical Dice wagers 1/2/3, both Concert choices, Homeless Guy investment0–4, eligible Squabble combinations, actual extra costs, opposing Dice budget, locks and lane restrictions.
- The CPU removes Gamer's obsolete cheap-play setup reward and returns the exact Squabble/investment it evaluated. API bot execution remains one authoritative command (integration owned by the compatibility pass).
- Hypothetical CPU branches omit presentation snapshots and mask the opponent's private hand and both unseen deck orders. The current own hand remains available. Lookahead stays bounded to the top four options and one extra own turn.
- The simulator gives already planted KYLE fuses 35% of the current-public-board detonation delta, using existing bomb resolution, shields and immunity. It values Motion and unused Squabble until the actual match round limit, including After Party.
- Generic simulation and the legacy rivalry/combo adapters preserve the selected investment; paid candidates no longer silently become the zero-investment command.

## Before/after fixtures

These are local deterministic diagnostic fixtures, not player win rates or application performance claims.

| Fixture | Before | After |
|---|---:|---:|
| Concert facing three small enemies | pass | damage mode1, one legal play |
| Gamer obsolete setup comparison | Gamer in empty lane | Side of Hands on current contested lane |
| KYLE existing next-round fuse value delta | 0 | 15.28 |
| Four unused Motion at round6 with After Party | 0 | 0.48 |
| Same Motion at ordinary final round6 | 0 | 0 |
| Twenty mixed-hand CPU decisions, one local run | 218.18 ms | 64.30 ms |

The measured decision fixture improved while adding legal options because hypothetical branches suppress replay/presentation snapshots. This is one local microfixture, not a broad speed guarantee. `baseline.json`, `after.json` and the copied `cpu-policy-probe.mts` retain the inputs/results; the probe imports the active worktree explicitly.

## Executed checks

All commands use `/usr/bin/node` with `PATH=/usr/bin:$PATH` in the active worktree. No browser, frontend build, production database or full new balance matrix was run by this pass.

- `node --import tsx --test --test-name-pattern='policy evaluator|CPU current|CPU uses Concert|CPU does not reward|CPU honors|balance match commits' src/balanceLab.test.ts ../artifacts/squabblemon/src/gameEngine.test.ts` from `scripts`: **7/7 passed**, 1.20s. Covers legal/affordable options, exact one play, hidden data invariance, consumed Squabble, KYLE immunity/no-target/final-round behavior, extended horizon and exact paid simulation commit.
- `node --import tsx --test src/fullBalanceSweep.test.ts src/rivalry-online-model.test.ts src/rivalry-audit-policies.test.ts` from `scripts`: **24/24 passed**, approximately2.8s. Includes paid second ply and actual online adapter equivalence for investment3 plus Squabble.
- Full `gameEngine.test.ts` and `balanceLab.test.ts` execution: **both files passed**, approximately88.75s; that invocation emitted file-level TAP, so no individual-case count is claimed.
- `node node_modules/typescript/bin/tsc -b lib/squabblemon-engine`: **passed**.
- `node node_modules/typescript/bin/tsc -p scripts/tsconfig.json --noEmit`: **passed**.
- `git diff --check`: **passed**.

## Boundaries

The delayed-value forecast holds current public occupants/shields fixed and does not predict enemy movement, removal, future draws, round-end ordering interactions or future recruitment. Its 35% weight is a policy heuristic, not a calibrated probability. The live CPU has bounded optimistic own-turn lookahead, not opponent-response search. The historical generic balance runner remains a local phase-model diagnostic; the current full sweep uses authoritative online commands. New v64 full matrix/stress/confirmation runs and compatibility/service checks are separate parent-owned evidence. No card balance conclusion is established by these targeted tests alone.
