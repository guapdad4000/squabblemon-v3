# Character artwork audit — September 25, 2026

All 202 collectible cards resolve to existing local artwork files. A visual audit of the character asset directory found 16 collectible characters with generic WAVE icons instead of character illustrations:

| Element | Characters needing original artwork |
| --- | --- |
| Water | Gator Boy, Hot Tub Hottie, Gas Station Sushi Chef, Energy Drink Freak |
| Electric | Game Developer, Electrician Foreman, E.V. Enthusiast, Dominican Phone Salesman |
| Plant | OG Vegan, Matcha Freak, Performative Male, A Spare Gus |
| Air | Big City Pigeon, Baby Crying on an Airplane, The Flight Plug, Airheaded Model |

Renamed to the user’s September 25 roster. Original artwork remains pending; see `docs/elemental-character-redesign.md` for the art briefs and move designs. These are the Elemental Bond wave in `lib/squabblemon-engine/src/elementalBondWave.ts`. The files exist, but do not contain finished character art. No replacement artwork has been invented for them.

The latest 18 new characters and replacement Live Streamer illustration all have supplied artwork. Seventeen supplied images needed background extraction; the male and female streamers already had transparency. Blockbuster posters intentionally retain their backgrounds.

## Background extraction

Method: built-in imagegen, one edit per opaque character, followed by WebP encoding with preserved alpha. Original Downloads files remain unchanged. Asset/source mapping and edited PNG provenance are in `artifacts/squabblemon/reference/blockbuster-artwork.json`.

Prompt set: background-extraction; remove only the white/gray background and ground shadow; output genuine transparent alpha; preserve the original complete character, identity, pose, clothes, colors, linework, text, and all props; no redesign, cropping, added elements, or baked checkerboard.
