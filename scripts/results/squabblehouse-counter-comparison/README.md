# Squabblehouse counter package: matched v30 / v31 comparison

Verified on 2026-10-01 UTC. This is a development-checkout experiment, not a published release.

## What was compared

Both versions use the same ten-card Squabblehouse crew: Manager, Bus Boy, Cashier, Security, Teknician, Griddle Master, Inmate Reformed, Janitor, Waffle Warlord, and Side of Hands. There are nine staff plus one support card; the crew's printed Motion total remains 31.

The selected ability changes are:

- **Cashier — Open Tab:** A district receipt lasting through the end of the next round. It stops the first valid enemy-character movement departure or hand return each round. Refreshing extends expiry without stacking charges or restoring a spent charge. Arrivals are unaffected, and the receipt survives its source leaving.
- **Griddle Master — Cracked Plate:** Removes the strongest protected enemy character's Protection here, then deals 2 damage. Without a protected character, it retains the original strongest-enemy damage/Burn attack.
- **Janitor — Turn It Around:** Retains the existing Hands/status reversal for any ally, and additionally reverses enemy-forced movement, hand returns, and execution against friendly staff into +2 Hands. All cases share the existing once-per-owner/district/round trigger.

Costs, printed Hands, roster, opponent runtime kits, progression tiers, and the shared simulation harness are held fixed. Shared movement/return handling also enforces legal departure routes and prevents blocked-action rewards. Construction's late-round closure remains play-only; genuine story movement locks still apply.

The **before** engine comes from the complete, selectively archived v30 source at commit `b3387f68bc3c7ac5e85a536a327e700222ab5fd0`, with imports bound to that archive. All 59 recursive engine files are checked against the Git archive, independently of the historical accepted report's nine-file hash map. The **after** engine is the live v31 checkout; full source fingerprints, not a shared Git HEAD stamp, identify its modified code.

## Schedule and acceptance

- Primary: 12 original district seeds × rotations 0/2/5 × tiers 0/3 × both seats × greedy and seeded-legal policies × three opponents = **864 cases per version**.
- Fresh confirmation: six new district seeds × rotations 1/6 × tiers 0/3 × both seats × greedy policy × three opponents = **144 cases per version**.
- Total: **1,008 cases per version; 2,016 versioned cases**.
- Matrix and captured-raw executions separately validate each requested case: **4,032 engine executions**, not 4,032 independent cases. Pilots and superseded development attempts are excluded from these totals.

`verification/counter-verification.json` confirms all nine paired Cartesian blocks, exact case-key coverage, zero matrix/raw failures, independently recomputed outcome tallies, frozen before-engine identity, and matched runtime kits. Historical result files remain unchanged.

## Results

Win rate below means **wins / all matches**; draws are not wins. Each primary row has 144 matches per version; each fresh-confirmation row has 48.

| Opponent | Policy / sample | Before W–L–D | After W–L–D | Before win rate | After win rate |
| --- | --- | --- | --- | ---: | ---: |
| Alice / Wonderland | Greedy primary | 17–119–8 | 16–117–11 | 11.8% | 11.1% |
| Alice / Wonderland | Seeded-legal primary | 19–115–10 | 20–115–9 | 13.2% | 13.9% |
| Alice / Wonderland | Fresh greedy | 1–47–0 | 0–47–1 | 2.1% | 0.0% |
| Fire GUAP | Greedy primary | 44–84–16 | 40–89–15 | 30.6% | 27.8% |
| Fire GUAP | Seeded-legal primary | 40–88–16 | 41–87–16 | 27.8% | 28.5% |
| Fire GUAP | Fresh greedy | 16–30–2 | 13–34–1 | 33.3% | 27.1% |
| Wiz | Greedy primary | 35–101–8 | 25–107–12 | 24.3% | 17.4% |
| Wiz | Seeded-legal primary | 39–93–12 | 42–92–10 | 27.1% | 29.2% |
| Wiz | Fresh greedy | 8–37–3 | 9–38–1 | 16.7% | 18.8% |

Across the complete scheduled sample, wins change from **219/1,008 (21.7%)** to **206/1,008 (20.4%)**. The matrix's separate score-rate metric counts a draw as half a win: aggregate score rate changes from **25.4%** to **24.2%**.

### Interpretation

The package is implemented and its mechanics pass their regression tests, but these runs **do not establish an overall performance improvement**. Seeded-legal results improve slightly for all three opponents; greedy-primary results regress, especially against Wiz. Fresh greedy confirmation does not support a general uplift.

These are fixed-policy bot comparisons, not human win-rate estimates. Cases share seeds, tiers, rotations, and seats, so they are not independent player observations. This is a package comparison, not evidence of any individual card's causal strength or ability reliability. Further tuning requires a separate decision; no additional balance changes were made to force a favorable result.

## Implementation verification

- Independent final source review: PASS.
- Diner-counter and district regression suites: 53/53 passed.
- Mounted desktop/phone battle checks: 4/4 passed, covering ready/spent/expired receipts, local/replay views, and public guest ownership projection.
- Workspace TypeScript check passed; final engine TypeScript check passed after the Construction correction.
- Frontend build and unchanged bundle caps passed.
- Full frontend test run: 1,250/1,252 passed. The remaining two are pre-existing story-dialogue/content checks, not counter failures.
- Bundle-check fixtures: 5/5 passed; balance-patch fixtures: 8/8 passed; benchmark-check fixtures: 6/6 passed.
- The earlier scripts-wide run retained one pre-existing challenge-API source-regex failure; that unrelated source was not changed.
- Web/API services run cleanly, and the app landing screen was visually checked.
- **Nothing was published.**

## Files and reproduction

Canonical outputs:

- `before/diner/current-rules.json`
- `after/diner/current-rules.json`
- `verification/counter-verification.json`

From the workspace root, the runner's `--prepare-snapshot` creates or validates the isolated archive. Run before operations through its archived runner and after operations through the workspace runner. Both support `--preflight`, `--pilot`, `--shard <opponent>:<policy>:<primary|holdout>`, and `--merge`; the workspace runner's `--phase after --verify` verifies the completed pair. Generated destinations are write-once: do not overwrite accepted outputs or mix shards from different source fingerprints.