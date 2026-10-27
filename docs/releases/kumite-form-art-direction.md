# Kumite fighter forms — revised form artwork

This revision replaces only the 24 Base / Squabble / Awakened illustrations rejected during review. It changes no gameplay, stance thresholds, layout, sprite animation, unlock art or title treatment.

## Direction

Use the existing Squabblemon anime arcade illustration style: bold hand ink, expressive faces, angular cel shadows, restrained costume colours and readable silhouettes. Character identity and outfit come from original character art. The reference pose is not a template. Each fighter's three forms must differ in body action, silhouette and camera angle; an added aura alone is insufficient.

Use fists, never crowns. Preserve full limbs and weapon paths. Effects should support the action and leave the face readable. Dragonfly Jones is deliberately funny. Chonk Lee has auburn/brown hair in all three forms. Sho'Nuff is theatrical and menacing rather than a generic fighter.

| Fighter | Base | Squabble | Awakened |
| --- | --- | --- | --- |
| Leroy | Low nunchaku evasive sweep | Reverse airborne roundhouse | Restored original authored Golden Glow |
| Sho'Nuff | Low beckoning villain laugh | Worm's-eye corkscrew axe kick | Crimson descending stomp |
| Bushedo Brown | Side lunge adjusting glasses | Planted step-through elbow strike | Rising heel / soul-heat kick |
| Franklin Duke | Grounded split and guard | Descending double hammer-fist | Three-point ground smash |
| Dragonfly Jones | Wobbling, worried crane stance | Accidental floor sweep | Absurd upside-down dragonfly Glo flip |
| Undercova Brotha | Phone-in-hand spy dodge | Airborne scissor kick | Low soul-slide finisher |
| P. Tang | Cocky belt draw | Foreshortened spinning belt lash | Descending heel stomp and Glo belt |
| Chonk Lee | Rear-quarter grounded elbow | Side-view flying knee with both feet visible | Low-angle dragon-heel stomp |

## Delivery

The 23 new plates were generated with the built-in image tool under the user's approved provider substitution. Leroy's existing `assets/kumite/fighters/bruce-leroy-glow.webp` is restored byte for byte as `assets/characters/forms/leroy-awakened.webp`; the original remains untouched.

The other plates use transparent WebP derivatives bounded to 1024 pixels on the longest edge, quality 88, method 6. Full-resolution generated PNG masters and the rejected first revision are retained locally. The 24 form files total 5,994,314 bytes versus 7,556,916 bytes before: 20.7% smaller. All 107 approved non-form delivery assets match their prior SHA-256 hashes exactly.

`kumite-expansion-assets.json` records current dimensions, hashes, provenance and byte sizes. The local `forms-revision-v2/art-direction-and-prompts.json` retains the complete prompt set; `generated-sources.json` and `installed-sources.json` retain master-to-delivery provenance.

## Verification

All eight three-form lineups were visually inspected at large and small card scales. The existing component fixture displayed all eight fighters for each stance at 1280×800 and 389×843, with intact proportions, no missing images and no horizontal page overflow. This is local synthetic component evidence, not authenticated player or physical-device evidence.

The 14 focused Kumite expansion, cosmetic asset and Story asset tests passed with zero failures or skips. Runtime source code is unchanged by this revision. Earlier implementation verification remains documented separately.

Review source assets under `artifacts/squabblemon/public/assets/characters/forms`. Approved Dojo sprites, movie title lockups, puzzles and earned alternate art are unchanged.

## Anatomy correction 3

Bushedo Brown’s Squabble backfist was replaced with a grounded elbow strike to clarify both shoulder and arm connections. Chonk Lee’s Squabble knee was redrawn with moderate perspective, a visible belt line, separate legs and both feet. Auburn hair, outfit, anime inking and dynamic action remain intact. These two changes leave the other 129 delivery files hash-identical. Their combined delivery size fell from 532,202 to 343,262 bytes. The two forms were checked in the local component preview at 1280×800 and 389×843; 14 focused regression tests passed with zero failures or skips. Full prompts and master provenance are retained locally under forms-anatomy-v3.
