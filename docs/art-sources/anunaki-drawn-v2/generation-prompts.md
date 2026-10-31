# Anunaki drawn animation sources

Generated on October 29, 2026 with the built-in `image_gen` tool, requesting true transparent backgrounds. These source sheets are retained so the result can be inspected and re-encoded. They replace the earlier single-image affine animations for these eight chat reactions.

## Yakub chat sheet

References: `assets/characters/yakub.webp` for identity; `assets/reactions/character-pack-v1/guap/spritesheet.png` for the existing store's drawn animation layout and outline style.

Prompt: Production game chat reaction cel-animation spritesheet. Yakub is a brown-skinned ancient Black scientist with a huge cranium, large Afro side puffs, thick round black glasses, ancient Sumerian scientist robes/lab coat, and blue-and-gold turquoise collar. Draw exactly sixteen distinct waist-up hand-drawn anime cel poses on an equal 4-column × 4-row transparent grid. Consistent character scale, fixed camera, crisp dark outlines and a thin white sticker cutout edge. Row 1: smirk, chuckle, big open-mouth closed-eye laugh with tears, recovering laugh. Row 2: stern brows, raised clenched fists, shouting with steam, stern recovery. Row 3: surprise, widening eyes and mouth O, palms raised and exclamation marks, uneasy recovery. Row 4: knowing smile, hand moving toward temple, salute and wink with sparkle, thumbs-up. Each frame must change the drawn face, hands and arm pose; do not wobble, zoom or duplicate a still. Keep the identity, glasses and hair throughout. No crowns, words, labels, grid lines, scenery or background plate. Every figure fits inside its cell on true transparent alpha.

## Anu chat sheet

References: `assets/characters/anu.webp` for identity; the same Guap store spritesheet for format only.

Prompt: Exactly sixteen newly hand-drawn waist-up reaction sticker cels on a regular 4 × 4 transparent grid. Anu is a mature masculine muscular blue-skinned Anunaki warrior with a full black beard, long black braided locs and gold bands, cyan glowing eyes, engraved wide golden Egyptian-inspired collar and cuffs, and a bare blue muscular chest. Same identity and costume across all frames. Crisp expressive anime fighting-game cel shading with dark outlines and a thin white cutout edge. Row 1: smirk, laughing hand on chest, huge open-mouth laugh and fist raised, recovering grin. Row 2: folded arms stern, raised clenched fists, shouting with flaring eyes and blue arcs, recovering. Row 3: eyebrow raised, wide eyes mouth O, open palms and golden exclamation, stunned recovery. Row 4: smile, hand to temple, salute and wink with gold sparkle, thumbs-up. Distinct drawn faces, mouths, hands and arm poses in every cell. Fixed camera and scale, transparent gutters, complete figures within cells. No crowns, labels, floor, scenery, background fill or transformed duplicates.

## Anu boss sheet

Reference: `assets/characters/anu.webp` for identity and costume.

Prompt: Finished 2D anime fighting-game boss animation spritesheet, exactly four columns × four rows. Anu is the mature blue-skinned warrior with full black beard, long black gold-banded locs, cyan eyes, engraved gold collar/cuffs, bare muscular chest, white/dark-blue ancient kilt, brown rope sash and leather sandals. Sixteen distinctly hand-drawn full-body cels, same fixed three-quarter forward camera and scale, all hair/hands/feet contained in each cell. Clear cel shading, simplified readable sprite detail, no white sticker border. Row 1 idle: ready stance, chest rise and fingers flex, blink and weight shift, settle. Row 2 windup: knees bend fist pulls back, shoulders turn, cyan charge forms, deep ready stance. Row 3 strike: hip turn, halfway arm extension, massive fully extended foreshortened cyan punch, follow-through dissipating energy. Row 4 recoil: defensive forearms up at impact, backward recoil, crouched recovery, upright guard. Real changing anatomy/limb poses; no transformed duplicate still, no blended bodies or ghost images. No floor, scenery, crowns, labels, grid lines or background fill; true transparent alpha.

## Encoding

The final Anu chat sheet was regenerated with the same identity reference and a spacing-focused instruction: exactly sixteen separate figures, four columns by four rows, generous empty transparent padding on all four sides of every cell, no touching/overlapping characters or props, with the same four laugh/rage/shock/respect sequences. The initial source and the first spacing edit are retained beside it as unshipped source iterations.

`anunaki-npc-sheet-a.png` and `anunaki-npc-sheet-b.png` were also generated through the built-in `image_gen` tool using the original character portraits as identity references. Their rows contain Utu/Enki/Nabu/Ninhursag and Inanna/Enlil/Ereshkigal/Caucus Mountaineer respectively, four distinct full-body poses per row. Runtime encounter loops use those actual drawn cels. Anu's encounter sprite reuses the full-body boss idle cels.

`yakub-fullbody-sheet.png` is a dedicated four-column, one-row full-body encounter strip, generated with the original Yakub portrait as identity reference. It depicts his flask-ready stance, glasses adjustment, a golden reagent poured into an ancient book, and a recovered raised-flask pose. All four poses have real drawn changes, remain transparent, and preserve his ancient scientist costume. It replaces the temporary chat-bust encounter sprite while the chat pack remains unchanged.

`scripts/encode-anunaki-drawn-frames.py` performs only extraction, uniform fitting, padding and encoding. A minimal-alpha seam follows the transparent gutters where generated packing differs from the requested exact grid, preserving the heads, hands, feet and props without collecting pieces of neighboring characters. It creates six-frame reaction/idle loops from four genuine drawn source cels and four-frame single-play boss actions. It does not invent animation frames with affine transformations. Reaction IDs and reward entitlements stay stable; URLs are revisioned to avoid old cached media. The script requires Python 3, Pillow and NumPy.
