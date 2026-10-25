# Current deck evidence and historical registry

**Current accepted report: October 25, 2026 runtime refresh — card balance 64 / online rules 64.** All 20,368 scheduled matches completed successfully: 17,296 league, 2,816 stress and 256 independent confirmation matches. The 46 named deck recipes contain 219 of 301 playable cards; all 301 were observed played across the three schedules. These are automated base-card PvP diagnostics.

Start with the [findings and validation record](../../artifacts/deliverables/current-deck-audit-20261025-runtime-v64-telemetry/README.md) or [complete named tier list](../../artifacts/deliverables/current-deck-audit-20261025-runtime-v64-telemetry/DECK-TIER-LIST.md). Data: [named rosters](../../artifacts/deliverables/current-deck-audit-20261025-runtime-v64-telemetry/deck-rosters.csv), [rankings](../../artifacts/deliverables/current-deck-audit-20261025-runtime-v64-telemetry/rankings.csv), [matchups](../../artifacts/deliverables/current-deck-audit-20261025-runtime-v64-telemetry/matchups.csv), [policy/seat splits](../../artifacts/deliverables/current-deck-audit-20261025-runtime-v64-telemetry/deck-breakdowns.csv), [current catalog stats](../../artifacts/deliverables/current-deck-audit-20261025-runtime-v64-telemetry/catalog.csv), [observed card coverage](../../artifacts/deliverables/current-deck-audit-20261025-runtime-v64-telemetry/coverage.json), and [provenance](../../artifacts/deliverables/current-deck-audit-20261025-runtime-v64-telemetry/provenance.json).

Accepted source SHA-256: `db4e1aae087bbbee4ba1b76abe013eed25625c8a120ac7557fa540a83f8afe19`; policy `online-base-shared-legal-delayed-horizon-v3`. The base Git commit is `61e9a86c1bd1ba49e350bd4a488671ab37d26ad2`. Plan manifests bind the audited working source, including uncommitted changes; the commit alone cannot reproduce it. A checksum-verified source archive is included. **Run the freshness gate before using this report after further source changes.**

The runtime refresh newly simulated the exact prior 20,368-case schedules. Every packed gameplay/card/choice/current-classification row matches the prior v64 baseline. A diagnostics-only object-key-order correction removed two false effect classifications found in the first runtime candidate; the legacy raw heuristic remains explicitly separate. See the current report for exact comparisons, interruption recovery and the unrelated unavailable historical LFS fixture.

## What the refresh measures

- The matrix ranks the exact ordered, legal ten-card recipes it actually tests. Named rosters include stable engine IDs, so renamed characters remain traceable.
- All three schedules use base-card PvP through the authoritative online-command engine. Upgraded cards, PvE encounters, arbitrary custom decks and human play are outside this evidence.
- Live solo opponents use `chooseCpuPlay`/`revealCpuTurn`, encounter behavior weights and their own candidate/next-turn search. The audit uses the separately versioned `fullBalanceSweep` policies for both online seats. Shared rules do not make those decision policies equivalent; these tables do not measure Story/training CPU win rates.
- Live CPU and audit now share legal paid investments and eligible Squabble combinations. The obsolete Gamer setup heuristic is removed; the evaluator values planted KYLE fuses and extended-round resources. Remaining limits: top-four, one-extra-own-play lookahead does not solve rival responses or most held-card/conditional future payoffs. The KYLE forecast holds public occupants/shields fixed; its weight is a heuristic, not a probability. No card costs, Hands or effects changed.
- Stress schedules exercise additional cards and paid choices. Confirmation checks selected matchups with separate seeds. All 301 cards are observed without forced supplemental matches; KYLE was played in 346 league appearances. Stress and confirmation are not pooled into full-field ranks.
- A score counts a draw as half a win. A card being played or emitting an event is descriptive coverage, not an individual strength estimate or proof that all of its conditions were tested.
- Keep policy, seat, seed and matchup differences visible. Different historical rosters and schedules are not a controlled before/after comparison.

## Render accepted results

From the repository root, first run `pnpm --filter @workspace/scripts balance:current check <dataset-directory>` for each dataset (`matrix`, `stress`, `confirmation`) to verify its source/runtime is still current. The accepted bundle was rendered with the command below. To reproduce it, choose a fresh `--out` directory; existing derived files cannot be overwritten:

```sh
python3 scripts/src/current-deck-report.py \
  --matrix artifacts/deliverables/current-deck-audit-20261025-runtime-v64-telemetry/matrix \
  --stress artifacts/deliverables/current-deck-audit-20261025-runtime-v64-telemetry/stress \
  --confirmation artifacts/deliverables/current-deck-audit-20261025-runtime-v64-telemetry/confirmation \
  --out artifacts/deliverables/current-deck-audit-20261025-runtime-v64-telemetry
```

The renderer requires schema-2 source/plan/runtime identities, complete successful schedules, matching ordered league rosters and catalog snapshots. It independently verifies raw-worker checksums and case partitions, seat-normalized outcomes, and deck/matchup/card aggregates before exporting anything. Versions, counts, names and printed card stats come from those snapshots. Derived outputs are write-once: preserve an existing accepted bundle before producing a replacement. The renderer's own checksum is recorded independently of simulation source identity.

Focused corruption/format checks: `python3 scripts/src/current-deck-report.test.py`. These synthetic tests validate the reporting machinery, not game balance.

## Historical registry

All entries below are historical snapshots. Their versions, corrections, rejected candidates and original checksums remain authoritative for what they recorded; none is relabeled as a fresh run.

| Evidence | Tested identity and coverage | Interpretation / availability |
| --- | --- | --- |
| [October 25 v64 pre-runtime baseline](../../artifacts/deliverables/current-deck-audit-20261025-v64/README.md) | Rules/balance 64; 20,368 matches; source `dfbfacef…`, same policy and exact schedules as current refresh | Superseded only by newly source-bound runtime evidence; original raw files, manifests and exports remain unchanged. |
| [First runtime candidate, not accepted](../../artifacts/deliverables/current-deck-audit-20261025-runtime-v64/README.md) | Source `b16e3a70…`; 20,368 matches; two telemetry-only false effect classifications | Preserved diagnosis; corrected instrumentation rerun is the accepted report above. |
| [October 25 v63 policy baseline](../../artifacts/deliverables/current-deck-audit-20261025-v63/README.md) | Rules/balance 63; 20,400 matches including 32 forced KYLE coverage cases; source `f3c57f54…`, policy `online-base-paid-both-plies-v2` | Superseded by the v64 policy correction above. Catalog/ordered recipes unchanged, but seeds and policy changed; not a controlled causal comparison. Original manifests, archive and raw files preserved. |
| [Task 118/126 baseline](../../scripts/BALANCE_BASELINE.md), [four-crew comparisons](../balance-four-crews.md) | Task 118 fingerprint `54f19dec`, 880 matches across 11 shells; Task 126 baseline commit `4a229154818fe27c1c61d5bc110e3d1c6397e7cb`, 1,008 matches per targeted state | Early bounded lab and design comparisons; human gate remains pending. |
| [Rules 11 roster pass](../ROSTER_BALANCE_40.md) | Based on `5a6a48c`; 40 revisions, 160-match smoke matrix | Historical printed-rule changes, not a full-roster ranking. |
| [Element audit](../../scripts/results/element-audit/README.md) and [Dark sweep](../../scripts/results/dark-card-sweep/README.md) | Element v14–16; final v16 uses 13 crews and 2,496 matches across two policies | Targeted elemental evidence. Older top-level files remain historical. |
| [Squabblehouse mixed shell](../../scripts/results/squabblehouse-balance/squabblehouse-balance-current-rules.md) and [staff correction](../../scripts/results/squabblehouse-staff-balance/squabblehouse-staff-balance-current-rules.md) | v29; mixed-shell commit `9aebdd31c605679a7cf8e578efcbbe72936d87f3`; separate corrected staff schedules | The first mixed gang/staff roster is not a staff-deck baseline. Keep its correction notice. |
| [Diner comparison](../../scripts/results/squabblehouse-diner-comparison/README.md), [counter package](../../scripts/results/squabblehouse-counter-comparison/README.md), [additive retest](../../scripts/results/squabblehouse-counter-revision-comparison/README.md) | v30–32, including 1,008 paired cases per version in counter comparisons | Matched historical changes; rejected-support and schema-1 evidence stays separate. |
| [Corrected v33 deck audit](../../scripts/results/deck-balance-v33-subway-fix/full/report.md) | Source `8c429a01…`; 3,392 complete matches | Approved crash-corrected audit. Preserve the original failure/replay evidence. |
| [v34 league](../../scripts/results/all-decks-v34-ranking/report.md), [v34 GUAP-free](../../scripts/results/all-decks-v34-no-guap/report.md), [v35 GUAP-free](../../scripts/results/all-decks-v35-no-guap/report.md) | 37 decks, 10,656 matches each; source hashes `a2260e28…`, `f72206f9…`, `2f206009…` respectively | Distinct ordered rosters; documented reuse applies only to unchanged compositions. |
| [Air/Water confirmation](../../scripts/results/air-water-v35-holdout/report.md), [crew parity](../../scripts/results/crew-parity-deliverables/README.md) | v35 focused field check; v35→36 five-subject comparison, 10,880 fresh holdout matches | Neither reranks the entire field. Calibration and confirmation remain separate. |
| [Blood/Crips archive](blood-crip-balance.md), [v44 patch](rivalry-full-patch-v44.md), [base v46 acceptance](base-playtest-acceptance-v46.md) | Rules 37–46 across the linked rivalry/combo reports | Earlier "latest candidate" links refer to their historical sequence, not the current engine. Fixed-order samples do not establish online parity. |
| [Full-roster buffs](../../artifacts/deliverables/full-roster-buffs-2026-10-07/README.md), [synergy follow-up](../../artifacts/deliverables/synergy-buffs-2026-10-07/README.md), [selected wave](../../artifacts/deliverables/selected-wave-2026-10-08/README.md) | v50-era: 267-card screen; 360 games per synergy arm; 320 per selected-wave arm | Card-scenario observations are not independent matches. |
| October 9–12 local base-PvP and league bundles | `base-pvp-balance-audit-20261009`, two v52 buff candidates, `full-card-deck-sweep-20261011`, `current-deck-rankings-20261012`, `deck-field-tuning-20261012`, Red-focus/correction/crew bundles | Local-only deliverables may be absent from clean checkouts. v52 "current rankings" source `550695fa…` has 46 decks/16,560 matches; full sweep source `ca5bc6c5…` adds 1,944 probes. Preserve abandoned-candidate labels. |
| October 12 named tiers and flow audit | Tracked [v57 plan](../../artifacts/deliverables/card-audit-deck-tier-list-20261012/plan.json), source `5cf7dd41…`; 46 decks, 16,560 matches; 219/298 cards in league. Flow diagnostics: 3,008 additional matches | `DECK-TIER-LIST.md`, `deck-rosters.csv` and `deck-flow-audit-20261012` were local-only exports in the original workspace when inventoried; do not promise they exist in a clean checkout. |
| [Reliability patch](../../artifacts/deliverables/reliability-patch-20261012/REPORT.md), [payoff patch](../../artifacts/deliverables/payoff-buffs-20261012/REPORT.md), [elemental patch](../../artifacts/deliverables/elemental-buffs-20261012/REPORT.md) | v58, v59 and v60 targeted comparisons; four training tiers and explicit retained/rejected candidates | More recent targeted evidence does not update the older full-field tier list. |

Earlier crew/support/movement/creative/25-card batches under `scripts/results/` and their dated design notes are also historical. Do not rewrite their raw numbers, source snapshots, manifests or hashes. Add supersession information here or in a separate reader-facing notice rather than modifying hash-bound evidence.

Large archived JSON files may intentionally be Git LFS pointers. See [benchmark recovery policy](../benchmark-archives.md); a pointer is not JSON evidence, and missing archive payloads do not block an independent new run.

## Runtime data and player guidance

Current printed stats and effective card text come from the assembled shared-engine `cardCatalog`/`cards`, not from historical Markdown. The game deck workbench derives its cost curve from that live catalog. Saved-player match records and server-ranked statistics are separate from offline bot scores. Do not import benchmark rankings as player performance data.

The [four-crew guide](../four-crew-guide.md) and [prototype art roster](../../artifacts/squabblemon/reference/CURRENT_ROSTER.md) are retained historical references. Current recipe guidance must be checked against the catalog and exact exported rosters. The [human-playtest protocol](../../scripts/BALANCE_PLAYTEST.md) remains pending until real sessions are completed.
