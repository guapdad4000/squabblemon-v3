# Squabblehouse additive-counter retest

The approved Cashier, Griddle Master, and Janitor revisions were tested separately and together against the frozen Alice/Wonderland, GUAP, and Wiz crews. Nothing was published.

## Matched setup and integrity

- Six versions, each with **1,008 unique scheduled cases**: 864 primary cases and 144 fresh confirmation cases.
- Primary: 12 seeds × 3 rotations × 2 upgrade tiers × 2 mirrored seats × 3 opponents × 2 policies. Confirmation: 6 new seeds × 2 rotations × 2 tiers × 2 seats × 3 opponents, greedy policy only.
- Total: **6,048 unique cases plus 6,048 duplicate validation replays**, not 12,096 independent samples.
- Every version has nine complete shards, exact identical case keys, independently recomputed raw/matrix outcome parity, and **zero simulation failures**.
- The diner roster, engine deck ID, draw-order key, opponent crews, printed costs/Hands, rarity, and upgrade mechanics are fixed. All versions share the corrected movement, capacity, hand-return, and route-legality rules.
- “Corrected original” selectively restores the original three abilities onto those corrected rules. It is not a wholesale historical-engine rollback. In particular, authentic original Janitor already reversed a fresh Queen execution; that protection was preserved in the control.
- The six fresh confirmation seeds differ from the earlier comparison. Compare versions within this report, not pooled totals across the old and new schedules.

Verification is recorded in [verification.json](verification.json); source isolation and snapshot identities are recorded in [source-proof.json](source-proof.json). Aggregated raw-derived figures are in [comparison.json](comparison.json), with a downloadable [summary.csv](summary.csv).

## Strict bot win rates

Draws do not count as wins in this table. Each opponent has 336 cases; each overall column has 1,008.

| Version | Alice | GUAP | Wiz | Overall |
|---|---:|---:|---:|---:|
| Corrected original | 13.1% | 29.5% | 24.1% | 22.2% |
| Current v31 | 13.7% | 28.9% | 22.6% | 21.7% |
| Cashier only | 13.4% | 29.2% | 22.9% | 21.8% |
| Griddle only | 13.7% | 29.5% | 22.0% | 21.7% |
| Janitor only | 13.7% | 28.9% | 22.6% | 21.7% |
| Combined v32 | 13.4% | 29.8% | 22.6% | 21.9% |

## Policy and fresh-schedule splits

Each cell shows strict wins/cases followed by win percentage. The primary greedy and seeded-legal schedules each contain 432 cases. Fresh confirmation contains 144.

| Version | Primary greedy | Primary seeded-legal | Fresh confirmation |
|---|---:|---:|---:|
| Corrected original | 94/432 · 21.8% | 99/432 · 22.9% | 31/144 · 21.5% |
| Current v31 | 81/432 · 18.8% | 103/432 · 23.8% | 35/144 · 24.3% |
| Cashier only | 84/432 · 19.4% | 101/432 · 23.4% | 35/144 · 24.3% |
| Griddle only | 82/432 · 19.0% | 104/432 · 24.1% | 33/144 · 22.9% |
| Janitor only | 81/432 · 18.8% | 103/432 · 23.8% | 35/144 · 24.3% |
| Combined v32 | 85/432 · 19.7% | 103/432 · 23.8% | 33/144 · 22.9% |

## Interpretation

Combined v32 has **221 wins versus current v31's 219**: +2 wins, or +0.2 percentage points. Its half-draw score, defined as `(wins + draws / 2) / cases`, improves by 6 points, or +0.6 percentage points.

That is a small, mixed result, not evidence of a substantial matchup improvement:

- Alice loses one strict win, GUAP gains three, and Wiz's win count is unchanged.
- Primary greedy improves by four wins; primary seeded-legal wins are unchanged.
- Fresh confirmation falls from 35 to 33 wins, and half-draw score falls from 28.5% to 27.4%.
- Combined is three strict wins below corrected original overall (221 versus 224), although its half-draw score is slightly higher.
- Cashier alone contributes the largest net improvement among the single-feature versions in this sample: +1 strict win and +3.5 half-draw points. Griddle changes individual cases but nets zero wins; Janitor changes one loss into a draw and nets zero wins.
- Seats remain materially different. Combined wins 14.5% with the crew in the A-player seat and 29.4% in the B-player seat; current v31 wins 14.7% and 28.8%, respectively. Tier and seat details are retained in comparison.json and the raw reports.

These are fixed-crew, fixed-policy bot comparisons, **not human win rates, optimized-deck rankings, statistical-significance claims, or general proof of isolated card strength**. No further tuning was performed after observing these results.

## Implementation and app checks

Cashier retains the district Open Tab and adds the strongest-enemy-character move/return lock. Griddle strips its selected target's Protection before the full original attack, and redirected damage uses the actual recipient's Burn state. Janitor has independent shared harm and staff-removal charges. Cashier training requires a committed new/extended effect, not a speculative lock later reversed by Janitor.

- Focused mechanics/catalog/authority checks: 168 passed.
- Desktop and phone mounted battle checks: 8 passed, including current/replay/public-guest states, independent charges, legacy records, and real next-round reset.
- Library, frontend, scripts, and API typechecks passed.
- Frontend build passed the unchanged GameApp 900 KiB cap at 899.9 KiB; bundle-guard tests 5/5 and balance-patch guard tests 8/8 passed.
- Full frontend suite: 1,260/1,262 passed. Full scripts suite: 55/56 passed. The remaining two story-content checks and challenge-API source check were pre-existing, outside this balance change, and are not represented as passing.
- Costs, printed Hands, the ten-card diner roster, Bus Boy's move, artwork, saved decks, inventories, and publication state were preserved.

## Raw reports

- [Corrected original](corrected-original/diner/current-rules.json)
- [Current v31](current-v31/diner/current-rules.json)
- [Cashier only](cashier-only/diner/current-rules.json)
- [Griddle only](griddle-only/diner/current-rules.json)
- [Janitor only](janitor-only/diner/current-rules.json)
- [Combined v32](combined-v32/diner/current-rules.json)