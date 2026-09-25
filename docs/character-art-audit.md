# Character artwork audit — September 25, 2026

All 202 collectible cards resolve to existing local artwork files. The 16 Elemental Bond placeholders have now been replaced with the user's supplied September 25 character illustrations. No generic WAVE portraits remain in that batch.

Source mapping, hashes, and processing provenance are in `artifacts/squabblemon/reference/elemental-character-artwork.json`. All 16 supplied PNGs already contained transparent alpha. Import preserves that alpha and all props with proportional WebP encoding; no background removal or redesign was needed. Stable artwork IDs remain unchanged, and cache revisions were refreshed.

The latest 18 new characters and replacement Live Streamer illustration all have supplied artwork. Seventeen supplied images needed background extraction; the male and female streamers already had transparency. Blockbuster posters intentionally retain their backgrounds.

## Background extraction

Method: built-in imagegen, one edit per opaque character, followed by WebP encoding with preserved alpha. Original Downloads files remain unchanged. Asset/source mapping and edited PNG provenance are in `artifacts/squabblemon/reference/blockbuster-artwork.json`.

Prompt set: background-extraction; remove only the white/gray background and ground shadow; output genuine transparent alpha; preserve the original complete character, identity, pose, clothes, colors, linework, text, and all props; no redesign, cropping, added elements, or baked checkerboard.
