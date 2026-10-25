# Current deck evidence — runtime refresh, October 25, 2026

Rules **64**, card balance **64**. **20,368 successful fresh scheduled matches; zero failed cases; 46 named league recipes; 301/301 playable cards observed played.** This is a source-pinned automated base-card PvP audit, not player win rates or live deployment proof.

[Complete named tier list](DECK-TIER-LIST.md) · [All ten cards in each tested deck](deck-rosters.csv) · [Rankings](rankings.csv) · [Matchups](matchups.csv) · [Policy/seat splits](deck-breakdowns.csv) · [Catalog](catalog.csv) · [Coverage](coverage.json) · [Provenance](provenance.json)

## Exact runtime equivalence

Every case, ordered deck, seed, policy, tier and seat assignment is preserved from the [previous v64 bundle](../current-deck-audit-20261025-v64/README.md). Outcomes were newly simulated; no prior raw outcomes were copied into this report.

| Fresh dataset | Successful cases | Comparison with previous v64 |
| --- | ---: | --- |
| Matrix | 17,296 | All packed outcome/card/choice/current-classification rows match |
| Stress | 2,816 | All packed rows match |
| Confirmation | 256 | All packed rows match |

The [checksum-verified comparator](compare-runtime-results.py) records **zero gameplay, nonclassification telemetry or current-classification mismatches across all 20,368 scheduled rows** in [runtime-equivalence-results.json](runtime-equivalence-results.json). All five exported CSVs are byte-identical to the previous v64 exports. This establishes equivalence for these exact automated schedules; it does not establish every arbitrary deck, upgraded card, encounter or human strategy.

The 46 league recipes contain 219 of 301 cards; stress probes exercise the remaining cards. All 460 named roster slots were checked for stable IDs and names. Stress and confirmation stay separate from league ranks. Scores count draws as half a win; both seats and policy splits remain visible. No numerical card, gameplay or balance changes were made.

## Telemetry correction and historical boundary

The [first runtime candidate](../current-deck-audit-20261025-runtime-v64/README.md) also completed 20,368 cases, but two stress rows falsely promoted a Ptang event from no-observed-effect to direct effect. Equal Waterboy mechanical values had different object property insertion order; the inherited JSON-string comparator treated this as a mechanical change. That candidate and its exact diagnostic trace remain preserved.

Current direct/nested/wrapper classification now compares JSON values independently of object key order while preserving array order and actual changes. Exact Ptang/Waterboy stress regressions, reordered-object checks and real-value/array-order checks passed. A completely new source-bound run produced this accepted bundle after that diagnostics-only correction; gameplay engine/replay codec remained frozen.

The exported historical `isSuccessfulBalanceAbilityEvent` and legacy `abilitySuccesses` raw counter retain their compatibility heuristic, including possible insertion-order false positives. **They are not current ability-success rates or reliability measurements**, and are outside the packed current-classification equivalence claim above. Current classification still describes emitted events, not base-ability attempts or eligible opportunities; no-observed-effect is not a failed ability.

The report renderer also replaces obsolete v63 prose about Gamer setup, paid choices and a round-five resource horizon. The current audit shares legal paid-investment/eligible Squabble choices with the live CPU, values planted KYLE fuses and configured round limits, and retains bounded top-four/one-extra-own-play search with the rival hand masked. It does not solve rival responses or most held/conditional payoffs and does not establish live-bot policy parity.

## Verification and recovery

- All three source/runtime/plan freshness gates passed after completion.
- The renderer independently verified raw-worker hashes, exact partitions, ordered rosters, seat-normalized outcomes and deck/matchup/card aggregates before exporting.
- **276 complete-match full-event/compact-preview comparisons passed** under this exact final source.
- Current telemetry and sweep tests passed **18/18** independently; renderer corruption/format tests passed **17/17**.
- The combined historical suite remains **20 passed, one failed** because the preexisting 57,634,051-byte Git LFS staff-report object is unavailable (`4f55c3f79827da57a777c4d1defb8f073ef796ff77eea67316d7a612ac426574`). Its assertion was not altered or skipped. This historical fixture gap is separate from the fresh current audit and is retained in `execution-logs/combined-telemetry-with-historical-fixture.log`.
- A tool-session restart interrupted matrix workers before receipts existed. Partial files are preserved under `interrupted-matrix-session-restart/`, with zero accepted cases from those files. All four matrix partitions were rerun from scratch under the unchanged existing plan. Checksum-validated complete stress, confirmation and verification outputs were retained.

Execution logs and worker elapsed values are provenance only. Other functional checks shared the host, so this audit makes no simulation timing comparison or device-performance claim.

## Source and reproduction

Audited source SHA-256: `db4e1aae087bbbee4ba1b76abe013eed25625c8a120ac7557fa540a83f8afe19`. Base Git HEAD: `61e9a86c1bd1ba49e350bd4a488671ab37d26ad2`. Policy: `online-base-shared-legal-delayed-horizon-v3`; native Node **v22.23.3**, Linux x64. The commit alone does not reproduce uncommitted audited source.

The [source archive](audited-source.tar.gz) contains all **103** manifest files, including `replayCodec.ts`; archive SHA-256: `b02aa83a9b0f1488930388a4c121d2e402dfa1976c2e1e80af4f25ec9dba7c63`. Each plan binds its source manifest, exact schedules and runtime. Renderer SHA-256 and every derived output checksum are recorded separately in [provenance.json](provenance.json).

Run `pnpm --filter @workspace/scripts balance:current check <dataset-directory>` for each of `matrix`, `stress` and `confirmation` before using these results after further source changes. Run `python3 scripts/src/current-deck-report.py` with these three dataset directories and a fresh `--out` directory to reproduce derived exports. Outputs are write-once. `compare-runtime-results.py` independently verifies and compares raw cases; preserve its accepted result before explicitly rerunning it.

All prior reports remain unchanged. No push, live migration, compact-write activation, deployment or human/physical-device validation occurred in this audit.
