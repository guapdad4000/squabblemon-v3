# Current game deck evidence — October 25, 2026

Rules 64 / card balance 64. **20,368 successful scheduled matches, zero failed cases, 46 named league decks, 301/301 playable cards observed.** This supersedes the v63 policy baseline for current automated base-PvP diagnostics. Historical raw evidence is preserved.

[Every deck with all ten card names](DECK-TIER-LIST.md) · [Named roster CSV](deck-rosters.csv) · [Current printed catalog](catalog.csv) · [Policy/seat splits](deck-breakdowns.csv) · [Matchups](matchups.csv) · [Balance review and human playtest targets](BALANCE-REVIEW.md)

## What the corrected field shows

| Rank | Exact tested deck | Simulated score |
| ---: | --- | ---: |
| 1 | Light | 78.39% |
| 2 | Air | 71.94% |
| 3 | The Wiz | 69.41% |
| 4 | TOUR MONEY | 69.15% |
| 5 | Fire | 68.35% |
| 6 | EVERYBODY EATS | 67.82% |

A draw contributes half a win. Every recipe has 752 seat appearances, including 32 mirror appearances, across equal greedy and bounded two-play policies. These are fixed base-card recipes, not optimized deck searches or player win rates. The 46 recipes contain 219 of 301 cards; stress probes cover the remaining 82.

The current policy shares legal paid-investment/Squabble choices with the live CPU, values planted KYLE fuses against the public board, and respects extended-round resource value. It also removes Gamer's obsolete cheap-card setup heuristic from the live CPU. Candidate search stays bounded; the audit policy is not identical to live encounter behavior.

KYLE was selected in **346/752 league appearances**, versus zero in v63. All 301 cards were observed without supplemental forced matches. This fixes a missing-policy-value symptom; it does not establish every conditional ability branch was tested. Current canonical card definitions and ordered league rosters are unchanged between v63 and v64, but policies and seed namespaces changed. The score differences cannot be assigned causally to one fix.

**No numerical buffs or nerfs are included.** Light remains the first counterplay target. Music/Community sequencing, Fire/KYLE timing, Air movement and intentional hold/bait lines for the low-ranked pairs need crossed-seat human tests. Demario/Luigion's 22.81% versus Mushroom Garden's 58.31% demonstrates why one recipe's rank cannot establish that shared cards need buffs. Overall opening-seat score is 59.77%; seat splits remain visible.

## Evidence and checks

| Dataset | Matches | Role |
| --- | ---: | --- |
| matrix | 17,296 | Full unordered league pairs and mirrors, both policies/seats, 184 seed labels per deck |
| stress | 2,816 | All 82 cards outside league recipes, plus exact paid-choice probes |
| confirmation | 256 | 16 selected matchups with independent seeds; excluded from league ranks |

- **276 complete-match full-event/compact comparisons** passed separately from the scheduled matches.
- All three source/runtime/plan freshness gates passed before export. The renderer independently verified raw worker hashes, exact case partitions, normalized outcomes and deck/matchup/card aggregates.
- All 460 named roster slots were checked for names and stable IDs. [Provenance](provenance.json), [coverage](coverage.json) and [validation](validation.json) retain the identities and validation boundaries.
- CPU/legal-choice tests, native version-retirement checks and browser recovery evidence are documented in the [hardening report](../../../docs/audits/beta-hardening-2026-10-25.md). They are separate from league balance evidence.
- Authored training difficulty bands remain unchanged. No saved player deck or player performance record is overwritten with bot scores.

## Reproduction and freshness

Base Git HEAD: `61e9a86c1bd1ba49e350bd4a488671ab37d26ad2`.
Audited source: `dfbfacef31b2fe22c0cfb012f0b0013b8b32fb66c4df325c138f320b25956a5b`.
Policy: `online-base-shared-legal-delayed-horizon-v3`; runtime Node 22.23.3 on Linux x64.

The [audited source archive](audited-source.tar.gz) contains all 102 plan-manifest source files. Overlay it on the base commit to reproduce the relevant local source; that commit alone is insufficient. Archive SHA-256: `3275de5b1ea62d5f3185262eab929c1483ee97db8ab05daa3e71549e2be1bc60`.

From the repository root, run `pnpm --filter @workspace/scripts balance:current check <dataset-directory>` separately for `matrix`, `stress` and `confirmation`. The gate rejects changed relevant source/runtime/version/plan or incomplete results. The renderer additionally validates raw results and refuses to overwrite derived outputs. Use a new output directory for a replacement report. Full commands and historical evidence are in the [current evidence index](../../../docs/balance/README.md).

For new simulations use an explicit run label and new directory with `balance:current verify`, `init-competitive-fresh`, `init-stress`, `worker`, `report` and `init-confirm`. This run used four matrix workers, two stress workers and one confirmation worker. No supplemental schedule was needed.

Local source and automated simulation only: no human, upgraded-PvE, physical-device or deployment proof. No push was performed.
