# Anunaki raid actor source prompts

Generated with the built-in `image_gen` tool, with `transparent_background: true`. The attached original PNGs supplied by the user are the character references. These sheets supply drawn cels, not transformed stills. The encoder records the slicing/alpha treatment separately.

## Sheet A

Source: `exec-ad751df7-2afb-4ad3-9498-12cfbc0b8f6e.png`.

References, in order: `grok-image-e241db1b-ae6b-46f7-b035-6c2bd84042be.png`, `grok-image-6f6b76d2-84e4-4342-a212-ac1254e65653.png`, `grok-image-85eac870-15ae-4834-912b-2cc30decf856.png`, `grok-image-ec2c630b-ec95-4a62-83c8-d0f09145c1b6.png`.

```text
Create a production 4-column x 4-row sprite sheet of 16 SEPARATELY DRAWN animation cels, portrait canvas 1024 by 1536 or 2:3 aspect ratio, transparent RGBA background. Use the four attached original character designs faithfully. EACH ROW is one different character, top to bottom: row 1 Utu (reference1 blue young man, long black blunt bang locs, gold sun disk, white loincloth), row 2 Enki (reference2 blue male inventor, long black braids tied back, tool belt, white/taupe robes, golden schematic), row 3 Nabu (reference3 deep blue male scribe with white gold blindfold, black braided updo, white navy robes, green tablet satchel, golden stylus), row4 Ninhursag (reference4 blue woman, long flowing black braids with gold beads, white/navy robes, creation magic in her hands, potion belt). Preserve all 4 identities, distinct outfits, skin colors, black hair, jewelry, props, Egyptian/Sumerian design and cel shaded hand drawn anime fighting-game style. Fists only for any insignia, no crowns. For each row: cel1 relaxed battle stance, cel2 changes weight and hand pose with blink, cel3 an expressive spell/attack gesture using their signature prop, cel4 recovers toward cel1 with visible different hand and face. These must be actual redrawn action frames, never shifted/scaled/rotated copies of a still. Four clearly different poses per character. Whole bodies including feet visible in every cell, consistent scale and foot baseline within each row, centered in each cell with 8 percent transparent gutter so slicing a uniform4x4 grid clips nothing. No perspective grids, no panels, no labels, no words, no background, no cast ground plane or floor. Keep individual aura/prop magic close to the body, do not cross cell boundaries. Clean transparent alpha and sharp silhouette edges, rich ink linework, clear facial expressions. No white sticker border on these full-body raid actors.
```

## Sheet B

Source: `exec-85b6c86b-ee8e-4958-ab79-3d4a2a0b2c0b.png`.

References, in order: `grok-image-4a071997-ff75-4a58-86a6-94f1696347d1.png`, `grok-image-46b1c4bc-ea20-46eb-96b7-17dc1846e1d3.png`, `grok-image-364b08b2-c325-44db-9885-76b4375a858b.png`, `grok-image-0fb0cc96-5464-4c0c-b7ed-092d3c80bb9f.png`.

```text
Production hand-drawn cel anime fighting-game sprite sheet on a genuinely transparent RGBA background, portrait2:3 canvas1024x1536. EXACTLY4columns and4rows,16separately drawn FULLBODY cels. Consistent character identity. Row1 INANNA: reference1 muscular blue woman with long black gold-beaded braids, huge golden fist gauntlets, white/navy/gold wrap. Row2 ENLIL: reference2 huge blue muscular man with very long black curls and beard, golden fist-emblem chest plate, navy kilt, electric fists. Row3 ERESHKIGAL: reference3 dark indigo woman with flowing black twists, black/purple/gold robes, crescent staff holding black purple crystal. Row4 CAUCUS MOUNTAINEER: reference4 pale white bulky caveman with big white hair/beard, brown fur clothes/boots and stone club, green Yakub lab waist tag. Keep their race/skin/hair/outfits and distinctive silhouettes faithful. Every row four ACTUAL separately DRAWN action cels: cel1 battle idle, cel2 weightshift plus changed arm and blink, cel3 iconic strike/spell/swing pose, cel4 recovery stance. Do NOT translate or rotate a single still. All hands/faces/cloth must be different percel. IMPORTANT PACKING: each cell256x384. Keep the entire character inside the INNER200x310 area of its cell, centered at (128,192); leave at least28transparent pixels left/right and at least35transparent pixels top/bottom. All hair, feet, weapons and spellglows must remain within these limits. No overlapping or crossing gridboundaries, no touching next row. Small crisp wholebody sprites, NOT huge cropped figures. EXACT equal grid spacing. NO gridlines, NO labels/text/captions/panels, no scenery, floor, background color, white outlines or sticker borders. Transparent alpha outside the individual character/spell. Clean black line art, crisp celshading, Egyptian/Sumerian jewelry. Only FIST emblems, NEVER CROWNS.
```

The tool did not maintain the requested uniform gutters exactly. The retained encoder uses alpha-aware seams, and the extraction contact sheets were inspected for complete heads, feet and props before export.

## Yakub full-body actor

Source: `exec-e7c00e79-814d-482b-80aa-33e3bab89dec.png` (one row, four columns). Reference: `grok-image-18a2fe8e-3e04-406c-a443-0afd62a204fb.png`.

```text
Create a production enemy actor SPRITE SHEET of this exact Yakub character: four separately drawn FULL BODY animation cels, ONE ROW and FOUR COLUMNS evenly spaced on a wide landscape1536x1024 canvas, transparent RGBA background. Each column is a narrow fullbody sprite with all feet and hair fully inside its own quarter of the canvas. Keep a 35px transparent gutter all around each cel and generous transparent gap between figures. Faithfully preserve the attached original: brown skin, exaggerated large cranium, afro puffs at sides, thick round black glasses, white mysteriously stained lab coat over Egyptian/Sumerian white navy gold robes, gold turquoise collar/bracers, brown belt and leather sandals. Same colors and exact face/head/hair/outfit identity in all4cels. Cel1 neutral scientist battle stance holding golden potion flask. Cel2 changes stance while adjusting glasses, flask near chest. Cel3 leans forward pouring golden spark magic from flask with other hand opening book. Cel4 recovers holding flask with a smug knowing expression. Clearly different drawn face, hand, hair and robe positions each cel, never shifted/scaled copies. Fullbody cel shaded hand drawn anime Marvel vs Capcom fighting game illustration, clean black ink outlines. No white sticker border, no labels, text, panel lines, background, floor, scenery or shadows. No crown symbols, use fist emblems only. These are transparent isolated fullbody combat actors that will be animated as one loop.
```
