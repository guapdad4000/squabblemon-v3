# Fadecade art preparation

Run `node scripts/prepare-fadecade-art.mjs` from the repository root. The script uses the
existing Squabblemon `sharp` dependency and writes web-ready assets to
`artifacts/squabblemon/public/assets/fadecade/`.

The inputs are preserved unchanged. The two runner uploads are byte-identical; the script
checks their SHA-256 digests and processes only the canonical `1790162145579` copy. Alpha
cleanup is based only on the supplied alpha channel, never on pixel color, so original black
ink and dark screens remain intact. Very faint exterior alpha is cleared and visually solid
251–255 alpha is normalized. The opaque room and road sheet are intentionally not background
removed.

`manifest.json` records output dimensions, atlas geometry, road source crops, and normalized
inner-screen bounds for the cabinets. The glass aperture in all five cabinets is transparent
while the surrounding inner bevel is retained, so live HTML can sit underneath the shell.
The preparation script also generates `src/lib/fadecadeArt.json` with cabinet dimensions and
screen bounds for the application bundle. An asset test keeps that metadata aligned with the
public manifest; this avoids importing a public asset as JavaScript in Vite.
Animation atlases run left-to-right. Runner frame order follows the source’s top row and then
bottom row; `idle.webp` is frame 1 and all 16 frames are also emitted individually.

Road output contains 32 separator-free texture tiles. `road.webp` is row 1/column 1 (vertical
yellow line), `sidewalk.webp` is row 3/column 1, and `crossing.webp` is row 4/column 1. Other
tiles are numbered by row-major source position.

For visual inspection, the script writes a checkerboard contact sheet to
`/tmp/fadecade-contact.png`.

## Character flags and banners

Run `node scripts/prepare-fadecade-chrome.mjs` to prepare just the later supplied
side flags and banners. The full preparation command runs this step too. The two
flags are split at the source sheet's midpoint and trimmed independently. The
banner canvases are trimmed to their visible artwork. Original black outlines and
yellow live-text surfaces remain intact; no color-key background removal is used.

`src/lib/fadecadeChrome.json` records exact cropped dimensions and conservative
text-safe rectangles as percentages. Keep live dark text within those rectangles;
character faces, fists, crowns, and border ink are not text areas.

The side flags and lower stats banner retract behind the flagship as it leaves
view; their movement follows the arcade's scroll container, not document scrolling.
Both the system and in-game reduced-motion preferences leave the labels stationary.
Cabinet setup opens in an artwork-framed dialog without changing the room layout.

## Fadecade soundtrack

The supplied “Oakland Chrome and Curls — Track 1” by Treblo is used only while
browsing the Fadecade. Its original OGG and a browser-compatible MP3 copy live in
`public/audio/modes/`. It uses the existing music player's gesture, volume, mute,
and hidden-tab handling. Battles and results take over the same player; returning
to the arcade restores its song, and leaving restores the next screen's music.