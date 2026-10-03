# Counterplay follow-up — rules 46

Local audit only; no card stat or XP change, no commit or publication. GUAP and FOLKS are excluded from every deck in these runs.

The prior report's 85.42% Combo win rate used `focus-counterplay`, a legacy six-card test shell automatically filled with Bus Pass, Soul Food, Cognac and Bustdown. The recommended workshop Counterplay crew is the separate `focus-counterplay-coherent` Dark Control recipe. The two recipes are not interchangeable. The balance-lab label now identifies the former as a legacy comparison, and a test checks that the recommended workshop crew matches the coherent audit deck.

## Base-level audit

Each cell is 48 games using three policies, both owner assignments and opening seats. Draws count as half a win. These are automated games, not human win rates.

| Counterplay recipe | vs Combo | vs Compound | vs Voltage | vs Fire | vs Crips | vs Blood | vs Block | vs Vibes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Legacy comparison | 8.33% | 26.04% | 27.08% | — | — | — | — | — |
| Recommended Dark Control | 75.00% | 83.33% | 67.71% | 81.25% | 61.46% | 62.50% | 87.50% | 75.00% |
| Exploratory middle shell | 70.83% | 70.83% | 41.67% | 81.25% | 47.92% | 54.17% | 79.17% | 81.25% |
| Exploratory Nerd-only shell | 35.42% | 54.17% | 27.08% | 59.38% | — | — | — | — |

The recommended crew already beats Combo and most of this field, so a global Counterplay card buff would overshoot. The middle shell also overperforms against several starters. The Nerd-only version is more restrained but is merely an experimental benchmark recipe, not a user-facing starter. A Gamer-only variant looked closer to even against Combo in the exploratory sample (58.33%), but an independent sample shifted to 41.67% against Combo and 89.58% against elemental Fire; it also beat Block 85.42% and Vibes 79.17%. That version is not a stable recommendation. No Counterplay composition was changed. The actionable result is to keep the historical and recommended crews distinct in future balance decisions.

A separate Compound test swapped Cognac for Church Auntie. On paired seeds it went from 55.21% to 66.67% against Crips, but Blood shifted 71.88% to 58.33%, Fire 52.08% to 68.75%, and Combo 41.67% to 33.33%. Seed-to-seed swings remain large; this is not a stable reason to add Church to Compound. Its current recipe stays intact.

Raw results: `scripts/results/combo-base/counter-legacy-field-v46.json`, `counter-coherent-field-v46.json`, `counter-coherent-rivals-v46.json`, `counter-middle-field-v46.json`, `counter-middle-rivals-v46.json`, `counter-nerd-v46.json`, `counter-gamer-v46.json`, `counter-gamer-rivals-v46.json`, `counter-gamer-holdout-v46.json`, `compound-church-rivals-v46.json`, `compound-church-field-v46.json`, `compound-paired-rivals-v46.json`, and `compound-paired-field-v46.json`.
