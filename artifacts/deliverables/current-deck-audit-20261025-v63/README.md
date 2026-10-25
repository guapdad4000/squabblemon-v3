# Current game deck evidence — October 25, 2026

Rules 63 / card balance 63. **20,400 successful scheduled matches, zero failed cases, 46 named league decks, 301/301 playable cards observed.** This replaces the old v57 named table for current automated base-PvP recommendations while preserving the older raw evidence.

[All decks with all ten card names](DECK-TIER-LIST.md) · [Named roster CSV](deck-rosters.csv) · [Current printed catalog stats](catalog.csv) · [Policy and seat splits](deck-breakdowns.csv) · [Matchups](matchups.csv)

## What the fresh field shows

| Rank | Exact tested deck | Simulated score |
| ---: | --- | ---: |
| 1 | Light | 80.78% |
| 2 | TOUR MONEY | 72.01% |
| 3 | EVERYBODY EATS | 70.21% |
| 4 | The Wiz | 69.61% |
| 5 | Dark | 68.28% |

Score counts draws as half a win. Each deck has 752 seat appearances, including 32 mirror appearances, under equal greedy and bounded two-play policies. These are fixed-recipe diagnostics, not player win rates or an optimized-deck search. Old v57 percentages are not directly comparable: rules, some rosters, scheduling and policies changed.

Light remains high in both policies (80.85% greedy, 80.72% two-play). The low end includes the explicitly historical Counterplay comparison recipe, Sherlock and Watson, and Demario/Luigion. Do not turn those ranks directly into buffs: delayed effects, setup and opponent mix can change the result. Demario/Luigion scored 26.53% across the full field, but 53.12% / 50.00% against its selected holdout controls; the latter is not a replacement full-field rank.

KYLE was never selected in the original league or stress samples. His separate coverage probe played him in 21/32 matches, including five SQUABBLE activations, with 102 emitted base-ability events. That closes observed play coverage and exposes a policy-selection limitation. It does not show every possible Smile Bomb condition was tested. No original league outcome was replaced or pooled with forced plays.

The current Community Table recipe uses Cracked Head and Foodz in place of the old export's Barbershop Heckler and Rastamon. Named exports preserve exact tested order. The catalog CSV snapshots the assembled live definitions, including later stat overrides, rather than copying an early definition literal.

## Evidence and checks

| Dataset | Matches | Role |
| --- | ---: | --- |
| matrix | 17,296 | All unordered league pairs and mirrors; both policies and seats; 184 seed labels per deck |
| stress | 2,816 | All 82 cards outside league recipes, plus paid-choice probes |
| confirmation | 256 | 16 selected high/low-versus-control pairs, separate seeds; excluded from league ranks |
| coverage-completion | 32 | Post-run KYLE coverage, separate seeds; excluded from league ranks |

- 276 exact full-event/compact-preview complete-match comparisons passed. Those verification comparisons are separate from the 20,400 scheduled matches above.
- 60 runtime/online/guidance tests, 12 harness tests, seven rivalry-model tests and 16 report-integrity tests passed. Frontend and scripts TypeScript checks passed.
- All four source/plan/runtime freshness gates passed. The report renderer independently checked raw file checksums, every scheduled case, outcome normalization, and recomputed deck, matchup and card aggregates before writing the exports.
- All 460 named deck slots and derived-output checksums were independently checked after export. See [provenance](provenance.json), [coverage](coverage.json), and [validation](validation.json).
- No card balance, gameplay rule, live bot policy, saved player deck, reward or economy change was made. Training bands retain their existing assignments; they are authored difficulty labels, not these PvP rank bands.
- Runtime guidance now describes current Gamer, Ice Cream Truck and Freeze answers, corrects Boyfriend's remote bonus, and retains played-card summaries after defeat. Known live CPU/evaluator limitations remain listed in the main report.

## Reproduction and freshness

Base Git HEAD: `61e9a86c1bd1ba49e350bd4a488671ab37d26ad2`.
Audited source: `f3c57f54175c45cdb8493ea1d7b7178f801ba8664612e87c5c3a4d867f4c7193`.
Policy: `online-base-paid-both-plies-v2`; runtime Node 22.23.3 on Linux x64.

The [audited source archive](audited-source.tar.gz) contains all 102 files in the plan source manifest, verified individually. It overlays a fresh copy of the base commit to recover the relevant local changes; the base commit alone is insufficient. Archive SHA-256: `0268e04587d516968660a5de5f7c58694d360d6a6610f837de271237b64e47e6`.

From the repository root, run `pnpm --filter @workspace/scripts balance:current check <dataset-directory>` for each of the four directories before relying on these ranks. A changed relevant source, runtime, plan, rules version or incomplete summary fails the check. Raw integrity is additionally verified during report rendering. Full commands and historical pointers are in the [current evidence index](../../../docs/balance/README.md).

For a fresh run, use a new evidence directory and explicit run label with `balance:current verify`, `init-competitive-fresh`, `init-stress`, `worker`, `report`, then `init-confirm`. Matrix used four workers; stress and confirmation used two. The [supplemental initializer](coverage-completion/initialize.mjs) records how the remaining no-deployment card was selected from complete results and uses the unchanged simulator with one worker. Original plans and outputs refuse replacement.

This is local source and simulation evidence. It does not establish production deployment, human balance, Story/training CPU performance or upgraded-card performance. No push was performed.
