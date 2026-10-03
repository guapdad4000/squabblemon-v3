# Combo and Compound base-card recipe candidate — rules 46

Local candidate; not committed or published. XP progression is unchanged. GUAP and FOLKS are excluded from every audit deck; Ruby Shades stays in Blood.

## Authored recipes

Who You Know now uses Cornball, Plug, Live Streamer, Gamer, Techbro Rich, Boss Bae, Wifey, Bus Pass, STOCKZ and Sneaker Reseller. Cross-district plays grow STOCKZ and Boss Bae; Sneaker is the contested-lane closer. An exploratory version with Dr. Fade in Wifey's slot scored 77–92% against four field decks, so the final candidate restores Wifey.

Compound Interest now uses Cornball, Plug, Live Streamer, Rastamon, Gamer, STOCKZ, Wifey, Bus Pass, BUDDY and Cognac. Its prior recipe omitted the card named Compound Interest and filled three slots generically. The new growth plan replaces Techbro with STOCKZ and Soul Food with BUDDY. Voltage remains unchanged: an earlier broad roster audit showed it was generally strong before the Combo experiment.

## Fresh base-level paired bot games

Each cell is 48 games with three policies, both deck owners and opening seats, through the actual multiplayer command handler. Draws count as half a win. These fresh seeds were not used to choose either final recipe.

| Deck tested | Crips | Blood | Block | Vibes | Combo | Compound | Voltage | Legacy Counterplay | Fire |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Combo | 41.67% | 39.58% | 64.58% | 43.75% | — | 54.17% | 27.08% | 85.42% | 64.58% |
| Compound | 27.08% | 45.83% | 51.04% | 42.71% | 25.00% | — | 27.08% | 66.67% | 46.88% |

Different subject/opponent ordering and seed rotation explain why Combo-versus-Compound and Compound-versus-Combo are not exact complements; do not treat these small bot samples as human win rates. Compound's exploratory paired comparison improved against Crips from 20.83% to 33.33%, Blood 27.08% to 41.67%, Voltage 16.67% to 45.83%, and elemental Fire 35.42% to 48.96%. The fresh holdout confirms improvement in several matchups but still shows weak Compound results against Crips and Voltage. The 85.42% Combo result was against a historical Counterplay comparison shell; it does not describe the recommended Counterplay practice crew. No further flat-stat buffs are justified from these samples alone.

Human base-level games with both seats and a wider untouched field remain before publication. The in-app Blood/Crips rivalry fixture does not substitute for Combo/Compound human games.

Raw results: `scripts/results/combo-base/combo-final-rivals-v46.json`, `combo-final-field-v46.json`, `compound-final-rivals-v46.json`, and `compound-final-field-v46.json`. Earlier candidate and paired comparison files in the same directory document the rejected versions.

Validation: 80/80 focused Combo, core-engine and card-budget tests; frontend and scripts TypeScript; production build and bundle budgets. Full frontend suite: 1667/1671 passed, with the same four pre-existing portrait, Griddle and story/transcript failures.
