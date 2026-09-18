# Art decisions and remaining production work

## What is authoritative

02_CHARACTER_ART contains the current named game art. These seven Chapter One identities were visually inspected: Blue (blue bandana, cap, long dark coat), Red (red hair/scarf/coat), Cracked Head (masked, ragged, heavily accessorized creature-like silhouette), Snitch (cap and tan trench coat), Cornball (literal corn/clown visual design), Wifey (dark clothing, pale coat, braids and handbag), Baby Momma (dark clothing, pale jacket, stroller in reference). OG Uncle is included for continuity only and does not speak in Chapter One.

Characters have alpha channels but some cutouts contain fringe/shadow residue. Treat as identity reference; inspect edges before compositing. Do not claim clean multi-pose animation sheets were supplied. Preserve Cornball's existing extravagant design instead of turning him into a generic man in street clothes.

## Alley Runner is not Blue

There is no unique Alley Runner portrait in the game. It currently points to ganger-blue.webp. The packet deliberately does not duplicate that file under a misleading new name. Scene 5 needs a provisional courier identity, distinct from Blue, consistent with the character bible. Mark it for design review before final delivery. Complete the other scenes while this design is pending.

## Background selection

03_BACKGROUNDS/ACTUAL_STORY_BATTLE holds the exact five battlefield plates explicitly selected by current story encounters. They use tall, stylized gameplay layouts. They are the continuity reference for what the player sees during a fight; do not use a mirrored overhead floor as an eye-level dialogue shot.

03_BACKGROUNDS/LANDSCAPE_WALLPAPERS holds nine original supplied PNGs, named clearly. These are usable landscape wallpapers and cinematic look references, not matched camera angles of those five battle plates. Use the per-scene mappings in scenes.json. Build/relight matching eye-level dialogue views as needed. Keep dusk/night progression coherent: the opening is late afternoon but the available corner-store landscape is night; the crown landscape is golden daylight but the finale is night. Do not silently switch time of day between two lines.

The legacy 540×960 story environments and old MP4 cinematics were deliberately excluded. Inspection found abstract magical imagery and settings that do not match this revised script. Their filenames alone are not a reason to use them.

## Props and poses still to create

Existing separate refs: deck stack, portable speaker, sticker phone, championship chain, pack, map. The chain does NOT replace the plastic Crown gag. The speaker does NOT replace an air-fryer box. No ready-made background planes, facial expression sets, rigged characters, or voice/audio tracks are supplied.

Create: vending machine with trapped drink/retrieval flap, dead karaoke mic, OPEN/VIP signs, gold sash and folding-chair throne, extension cable/box, kitchen timer, maintenance barrier, paper plate, memorial program using the correct Cracked Head identity, notebook and recording sleeve, courier bag and clipboard, sparkling-water label/sugar packet, ring light, unopened air-fryer carton/media signage, two phones, gift-wrap carpet, plastic Crown/neck pillow, scheduling board, paper cups, water bottles and chair-pull pose.

Baby Momma's reference includes a stroller. For Scene 8 create a new pose without stroller/child while retaining her identity. Avoid revealing paternity through an invented baby close-up. Preserve masks and unusual silhouettes in every re-pose. Render legible prop writing in compositing instead of relying on generated lettering.

## Scope of this packet

Source art is copied unchanged; no new production poses or missing backgrounds have been secretly generated. Contact sheets are labeled thumbnail previews. Original wallpaper filenames are mapped in ASSET_MANIFEST.json, without exposing the user's personal folder layout. This is a complete organized input handoff with explicit production gaps, not a claim of finished animation assets.
