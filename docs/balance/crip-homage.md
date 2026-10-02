> Historical report. Superseded by [rules 42 Blood / Crips balance](blood-crip-balance.md), including CLUE’s final 4-Motion cost and +2 remote support.

# Blue Set homage — rules 41

**Current scope: GUAP is excluded from every test deck.** Any historical GUAP-containing comparison below was outside the requested scope and must not guide further changes. Retained raw reports are historical evidence; the current runners reject GUAP.

Follows the [v40 rivalry buffs](crip-rivalry.md) in the isolated
`codex/crip-deck-buffs` worktree. This pass changes only CLUE COOKY's homage;
all prior buffs and the original ten-card Crip deck remain in place.

## Final rule

When CLUE's district is losing at its existing reveal check:

1. Other friendly Blue Set characters contribute +1 each **without losing Hands**.
   Natural members and Initiation recruits count, including one-Hand or immune Blue
   allies. CLUE itself, enemy characters, hazards and supports do not contribute.
2. Blue members count first. Ordinary eligible characters pay 1 Hand each only
   toward the remaining allowance, retaining at least 1 Hand as before.
3. **Total homage is capped at +4 per reveal**, including echoes. This is a reveal
   cap, not a match-long limit. Echoes do not copy CLUE's training payout.

A held or tied district collects no homage. Existing displacement, remote +3 /
Protection, and once-only training stay intact. The cap deliberately replaces the
old uncapped tax, including in mixed decks with many ordinary allies.

The shared card description and effect log explain the rule. Online and reward
versions both advance to 41 so older issued matches cannot silently use new rules.

## Focused paired check

Fresh predeclared seed labels, two rotations, greedy/seeded policies, base/full
training and both seats: 32 games against each of five opponents, **160 per arm**.
Both versions use the same ordered rosters. The baseline fingerprint matches the
previously retained v40 report. No gameplay changes were made during either run.

| Opponent | v40 | v41 |
|---|---:|---:|
| Historical GUAP-free Blood | 67.19% | 67.19% |
| Original Blood with GUAP | 35.94% | 35.94% |
| Light | 53.13% | 53.13% |
| Air | 39.06% | 40.63% |
| Dark | 42.19% | 43.75% |

Zero simulation failures. The new rule preserves Blue allies' Hands in regression
fixtures, but **does not show a Blood score gain in this sample**. The Air and Dark
changes are small. These draw-half bot scores are not player win rates; the seeds
and policies differ from the earlier report, so compare versions within this table.

## Reproduce

```sh
pnpm --filter @workspace/scripts exec tsx src/crip-homage-check.ts LABEL
pnpm --filter @workspace/scripts exec tsx src/crip-buff-check.ts LABEL
```

Use frozen v40/v41 engine sources and different output labels. Existing results
cannot be overwritten. The focused runner verifies source stability and game count.

- [Focused v40](../../scripts/results/crip-followup/homage-v40.json)
- [Focused v41](../../scripts/results/crip-followup/homage-v41.json)

## Verification

- **86/86 focused tests pass**, including 16 new homage regressions for both
  owners, base/full upgrades, donor priority, the four-Hand ceiling, one-Hand and
  immune Blue allies, ordinary donor floors, held districts and Tayaty echoes.
- Workspace TypeScript checks pass.
- Broad frontend suite: **1,461/1,465 pass**. The four known failures remain the
  absent source-art PNG, obsolete Griddle damage expectation and two obsolete
  story expectations; no new failure was introduced.
- No push, deployment, or player-data mutation. Changes remain local in the
  isolated branch alongside the earlier Crip buffs.

## Wider-field result

All 576 final games completed without simulation failure; ordered rosters and case keys match the retained v40 baseline. The final engine fingerprint matches the focused comparison.

| Slice | v40 | v41 |
|---|---:|---:|
| all | 54.25% | 54.43% |
| base | 53.12% | 53.65% |
| trained | 55.38% | 55.21% |
| greedy | 47.74% | 47.22% |
| seeded | 60.76% | 61.63% |
| player | 50.17% | 50.17% |
| cpu | 58.33% | 58.68% |

The overall change is only **+0.17 percentage points**. Greedy and fully trained slices decline slightly, while base and seeded-legal slices rise. Retain this as a bounded Blue Set loyalty improvement, not proof of a broad competitive breakthrough.

[Final wide report](../../scripts/results/crip-followup/v41.json); [paired baseline](../../scripts/results/crip-followup/v40.json).

## Corrected GUAP-free scope

The current rivalry runner schedules 64 games against Blood only; the focused homage runner schedules 128 games against Blood, Light, Air and Dark. Both reject any roster containing GUAP. The corrected 64-game rivalry verification completed with zero failures and a 60.94% Crip score. Scripts typechecking passes. [Verified GUAP-free rosters and results](../../scripts/results/crip-followup/no-guap-v41.json).
