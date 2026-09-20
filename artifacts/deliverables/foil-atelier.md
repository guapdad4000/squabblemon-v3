# Squabblemon foil atelier

## Material direction
The supplied premium_holo_foil_deck HTML examples demonstrate a rigid box and crimped booster wrapper. Their material techniques are adapted to the existing card face: masked metal, embossed print, independent roughness, cell-based thin-film thickness and studio reflections. Squabblemon artwork and rarity palettes lead the composition.

| Rarity | Finish | Material cue |
| --- | --- | --- |
| Super Common | Pressed stock | warm cut edge and paper grain |
| Common | Pearl satin | brushed silver and a soft pearl reflection |
| Uncommon | Emerald engraving | fine guilloche with emerald sheen |
| Rare | Cobalt diffraction | diagonal diffraction lines and blue interference |
| Super Rare | Amethyst fracture | crystalline facets with violet interference |
| Legendary | Sovereign gold | engraved crowns and warm gold spectral foil |
| Mythical | Crimson eclipse | obsidian-red fractures with amber reflections |

Tagged adds gold-stamped lacquer, vermilion slashes and a gilded name. Chrome adds polished silver, diamond engraving and a cool spectral finish. The original rarity stock still shows beneath each edition.

## Integration
- CardView supplies the shared finish everywhere: collection, hands, boards, rewards, previews and inspection.
- CSS supplies complete static foil on every card. The inspected card additionally loads the local Three.js renderer. No external CDN/import map is needed.
- Physical metal uses MeshPhysicalMaterial with roughness, bump, iridescence and environment maps. A separate optical shader varies the thin-film response across each stock.
- Geometry is two flat faces. Map generation is deterministic and cached (128px cell texture, 384px engraving). Rendering happens only on interaction, resize or visibility changes.
- Portrait centers and lower copy are protected by spatial masks. Tier order is explicitly offset from the catalog's -1..5 range into the renderer's 0..6 range.
- A failed GPU context retains the CSS finish. Repeated inspection, live reduced-motion settings, visibility and cleanup are handled.
- Original / Tagged / Chrome previews require no purchase. Craft/equip controls retain the existing 80 / 140 Style Shard costs and server authorization.
- Earned ability upgrades now have gold inlays and visible rank pips. Gameplay and reward calculations are unchanged.

## Validation
Run from artifacts/squabblemon: node e2e/verify-foil.mjs (or test:foil).
Nine browser checks cover all seven stocks, changing rendered reflections, keyboard/touch control, motion settings, GPU loss/restoration, repeated mount disposal, purchase-free previews and mobile layout. The browser report is screenshots/foil/verification.json.
The comparison fixture is e2e/foil-studio.fixture.html. Captures are in screenshots/foil.

## Publication
Published to https://squabble.today on deployment 6aaf691b52c77dbd5bf1f41e. Production renderer, application code, finish CSS and facet asset match the local build byte for byte. API health 200; anonymous multiplayer remains 401. The 28 gameplay release checks and six-size inspection regression suite passed.
