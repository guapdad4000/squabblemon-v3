# Combo base-card candidate — rules 45

Local candidate only; not committed, pushed, or published. GUAP and FOLKS are excluded from current ranking/audit recipes and the shared rivalry playtest. The cards remain available in the game. Historical reports are unchanged. Ruby Shades replaces FOLKS in Blood; Redneck Evil remains the GUAP replacement.

## Changes

- Techbro Rich: 4 Motion / 5 Hands → 3 Motion / 4 Hands. Earlier access to Burn Rate; borrowing, repayment and training rules are unchanged.
- Live Streamer: 2 Motion / 2 Hands → 2 Motion / 3 Hands. Existing follow-up cap and ability rules are unchanged.
- No XP, rarity, acquisition, or saved-deck migration changes.
- The initial 3 Motion / 5 Hands Techbro experiment was rejected for exceeding the existing printed-stat budget. Its raw report is retained as candidate-v45.json and is not the accepted candidate.

## Base-only online-command tests

Each row has 48 games per run: four district/draw seeds, both owner assignments, both opening seats, and three policies. Draws count as half a win. These are simulated scores, not human win rates.

| Combo opponent | Before | Paired candidate | Fresh candidate |
| --- | ---: | ---: | ---: |
| blue | 10.42% | 10.42% | 29.17% |
| red | 12.50% | 10.42% | 8.33% |
| starter-block | 29.17% | 41.67% | 8.33% |
| starter-vibes | 18.75% | 29.17% | 35.42% |

The paired sample improves the other-starter matchups, but the fresh Block result does not support a robust balance claim. Blood/Crips remain difficult. Treat this as an early-tempo playtest candidate, not a solved starter overhaul; avoid stacking further buffs to chase one seed set. Other Electric/Compound decks also use these cards, so broader field and human testing remain useful before release.

## Blood versus Crips without FOLKS

192 fresh base-card games: Crips 59.375%, Blood 40.625%. Greedy and two-play policies each score Crips 53.125%; paired-seeded scores 71.875%. Both openings and seats are included. This is a new roster and new seeds, not a causal paired estimate of FOLKS strength. No additional Blood/Crips stat changes were made.

## Verification

- 275 focused mechanics/curve tests passed, including both owners and training tiers, borrowing/repayment, and existing Electric interactions.
- 11 policy/online-model tests passed, including rejection of both excluded cards in custom recipes.
- Full suite: 1639/1645 passed initially. Two assertions affected by the intentional Techbro budget change were corrected; their containing engine/Squabblehouse suites then passed 70/70. The other four are the previously documented missing art, Griddle expectation, and two transcript failures.
- New mounted base Combo scenario passed on desktop and phone (2/2).
- Frontend, scripts, and dedicated E2E TypeScript checks passed.
- Production build and all entry bundle budgets passed.

Raw results: scripts/results/combo-base/{baseline-v44,tempo-v45,tempo-holdout-v45}.json and scripts/results/crip-followup/rivalry-no-folks-v45.json.
