# Layered battle art

The supplied OpenArt environments are optimized into `public/assets/layered/`.
`sources.json` records every original filename and the crop coordinates for the
existing UI atlas. Re-export with `node scripts/prepare-layered-art.cjs` from the
workspace root while the original Downloads folder is available.

## Composition

- Battle: environment, contrast mask, subtle dust, districts, cards, illustrated
  score plates, live controls, and temporary ability overlays.
- Cards: type-specific environment, atmosphere, character cutout, rarity finish,
  illustrated rim, live name/stats, and existing status effects.
- Ability reveal: matching environment, speed-line treatment, enlarged character,
  and live ability text. Its lifetime follows the existing presentation timeline.
- Crew selection: deck-specific location, leader, readable copy, and illustrated
  roster thumbnails.

`src/battleVenues.ts` retains deterministic venue selection. Explicit story
battlefield art still takes precedence. `src/lib/cardFinish.ts` maps card types
and crews to the new locations. The remaining locations are available for future
story and menu compositions without loading them into every screen.

`src/styles/layered-art.css` owns the illustrated decoration. It uses border-image
for stretchable control housings and hollow card rims. Text, numbers, focus,
disabled states, and click targets remain native interface elements. Decorative
layers do not intercept input; dust respects reduced-motion settings.

## Verification

`node scripts/check-layered-art.cjs` checks desktop, phone, and landscape play,
asset requests, visible action bounds, ability layers, and reduced motion. It
uses the existing local preview at port 4179 and saves screenshots under
`screenshots/layered-art-*`.
