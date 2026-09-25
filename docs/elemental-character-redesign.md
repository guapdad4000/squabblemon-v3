# Elemental character redesign

The existing 16 Elemental Bond placeholders are renamed in the order supplied by the user, four per element. Engine IDs, catalog IDs, artwork paths, rarities, ownership, and upgrade identities remain stable. OG Vegan has 1 base Hand to budget her two-sided Plant buff. All 16 supplied illustrations are now installed with their original transparent alpha. Source mapping is recorded in `artifacts/squabblemon/reference/elemental-character-artwork.json`.

| Former name | New name | Element | Move | Gameplay |
| --- | --- | --- | --- | --- |
| Riptide Bruiser | Gator Boy | Water | Emotional Support Gator | On Reveal: Give the highest-Hands enemy here -1 Hands. If its Hands fall, gain +1 Hand. |
| Stillwater Medic | Hot Tub Hottie | Water | Soak Your Problems | On Reveal: Cleanse your lowest-Hands frozen or silenced ally here and give it +1 Hand. If cleansed, gain +1 Hand. |
| Monsoon Anchor | Gas Station Sushi Chef | Water | Trust the Cooler | Ongoing: While in your hand, your other Water characters gain +1 Hand at round end. On Reveal: Weaken the strongest enemy here. |
| Rainmaker | Energy Drink Freak | Water | Fourth Can, No Plan | On Reveal: Lose 2 Hands, then restore 3 Motion, up to 9. |
| Battery Back | Game Developer | Electric | Works on My Machine | On Reveal: Repair your lowest-Hands ally in another district with a negative Hands modifier: give it +1 Hand and restore 1 Motion, up to 9. |
| Circuit Captain | Electrician Foreman | Electric | Everybody on the Clock | Ongoing: While in your hand, your other Electric characters gain +1 Hand at round end. |
| Wiretap | E.V. Enthusiast | Electric | Actually, It Charges Free | On Reveal: Your next card in another district costs 1 less Motion. If you have no other character here, restore 1 Motion, up to 9. |
| Livewire | Dominican Phone Salesman | Electric | Switch Carriers | On Reveal: Move to your weakest other district. If you move, gain +1 Hand and your next card in a different district from your new location costs 1 less Motion. |
| Sprout | OG Vegan | Plant | I Brought My Own Plate | On Reveal: Give your lowest-Hands other Plant ally here +1 Hand. If one is here, also gain +1 Hand. |
| Root Nurse | Matcha Freak | Plant | Ceremonial Grade Crashout | On Reveal: If you have at least 4 Motion left after playing this card, gain +2 Hands. Otherwise, cleanse your lowest-Hands frozen or silenced ally here and give it +1 Hand. |
| Canopy Keeper | Performative Male | Plant | Feminist Literature, Unopened | Ongoing: While in your hand, your other Plant characters gain +1 Hand at round end. |
| Garden Wall | A Spare Gus | Plant | Personal Space Is Seasonal | On Reveal: Give the strongest enemy in another district -2 Hands, then give your weakest other ally here +1 Hand. |
| Gust | Big City Pigeon | Air | Run Your Breadcrumbs | On Reveal: Move to your weakest other district. If you move, give the weakest enemy there -1 Hand. |
| Crosswind | Baby Crying on an Airplane | Air | No Quiet Section | On Reveal: Weaken the strongest enemy here. Move your weakest other ally here to your weakest other district. |
| Slipstream | The Flight Plug | Air | Cousin at the Gate | Ongoing: While in your hand, your other Air characters gain +1 Hand at round end. |
| Cloudbreak | Airheaded Model | Air | Wrong Gate, Great Lighting | On Reveal: Move to your weakest other district. If you move, give your weakest ally left in the original district +2 Hands. |

## Artwork briefs

### Gator Boy

Florida Haitian man in camouflage Carhartt overalls, with a gator on the ground beside him.

Stable artwork path: `assets/characters/riptide-bruiser.webp`. Preserve full character and props on genuine transparent alpha.

### Hot Tub Hottie

Adult woman relaxing in a hot tub; playful, self-assured attitude.

Stable artwork path: `assets/characters/stillwater-medic.webp`. Preserve full character and props on genuine transparent alpha.

### Gas Station Sushi Chef

Chef running a gas-station sushi counter; cooler and convenience-store sushi props.

Stable artwork path: `assets/characters/monsoon-anchor.webp`. Preserve full character and props on genuine transparent alpha.

### Energy Drink Freak

Overcaffeinated energy-drink obsessive carrying several cans.

Stable artwork path: `assets/characters/rainmaker.webp`. Preserve full character and props on genuine transparent alpha.

### Game Developer

Sleep-deprived game developer holding a hammer and a broken screen.

Stable artwork path: `assets/characters/battery-back.webp`. Preserve full character and props on genuine transparent alpha.

### Electrician Foreman

Electrician foreman with practical workwear, tools, and a supervisory presence.

Stable artwork path: `assets/characters/circuit-captain.webp`. Preserve full character and props on genuine transparent alpha.

### E.V. Enthusiast

Hipster posed in front of an electric car.

Stable artwork path: `assets/characters/wiretap.webp`. Preserve full character and props on genuine transparent alpha.

### Dominican Phone Salesman

Dominican phone salesman with phones and sales-counter props.

Stable artwork path: `assets/characters/livewire.webp`. Preserve full character and props on genuine transparent alpha.

### OG Vegan

Older vegan woman; original-generation vegan, not a youthful wellness influencer.

Stable artwork path: `assets/characters/sprout.webp`. Preserve full character and props on genuine transparent alpha.

### Matcha Freak

Matcha obsessive with a matcha drink and whisk.

Stable artwork path: `assets/characters/root-nurse.webp`. Preserve full character and props on genuine transparent alpha.

### Performative Male

Disheveled adult man in Korean student-inspired styling: brown blazer, shorts, tote containing women’s books, matcha in hand, small white wired earbuds, round clear-frame glasses, and an “I hate men” shirt button.

Stable artwork path: `assets/characters/canopy-keeper.webp`. Preserve full character and props on genuine transparent alpha.

### A Spare Gus

A guy named Guy holding a giant asparagus. Display name: A Spare Gus.

Stable artwork path: `assets/characters/garden-wall.webp`. Preserve full character and props on genuine transparent alpha.

### Big City Pigeon

A big-city pigeon wearing a ski mask.

Stable artwork path: `assets/characters/gust.webp`. Preserve full character and props on genuine transparent alpha.

### Baby Crying on an Airplane

Baby crying in an airplane seat; comic cabin chaos.

Stable artwork path: `assets/characters/crosswind.webp`. Preserve full character and props on genuine transparent alpha.

### The Flight Plug

Woman holding a laptop and boarding passes.

Stable artwork path: `assets/characters/slipstream.webp`. Preserve full character and props on genuine transparent alpha.

### Airheaded Model

Adult fashion model with a distracted, absent-minded expression.

Stable artwork path: `assets/characters/cloudbreak.webp`. Preserve full character and props on genuine transparent alpha.

## Rules and compatibility

Hostile hits use the existing elemental matchup, immunity, protection, and destruction pipeline. Movement respects frozen/locked cards, closed districts, and capacity. Follow-up rewards require a successful move or hit. Ties follow the existing deterministic engine order. Four hand-bond engines remain draftable, with their original trained bond upgrades. Ethnicity informs the requested character design, not any combat bonus.

## Validation

92 targeted engine, elemental-deck, redesign, balance, training, and artwork tests passed. Both sides use the same move behavior; shielded hits and locked movement cannot award follow-ups. Library/frontend typechecks and production build with entry-bundle validation passed. These checks establish rules correctness, not final live-match balance.
