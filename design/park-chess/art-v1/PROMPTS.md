# Check the Block generated art

Generated with the built-in imagegen tool on 2026-10-08. Runtime formats preserve generated alpha and composition; conversion uses Sharp WebP quality90 (pieces92), alpha quality100, effort6.

Selected masters: pieces.png, park-table.png, cabinet.png. The atlas is2172×724, six square362px cells per row; rowsWhite/Blue thenBlack/Red; columns pawnYN, rookBouncer, knightSimmy, bishopJohnHenry, queenAshlee, kingGUAP. All12 silhouettes fit fully inside their cells. The final user correction makes Guap the king and keeps Ashlee as queen. Fist emblems replace crowns.

## Initial piece atlas

```text
Use case: stylized-concept.
Asset type: transparent production sprite atlas of Squabblemon human chess pieces for "CHECK THE BLOCK".
Create ONE wide 3:1 landscape atlas, exactly SIX evenly spaced columns by TWO evenly spaced rows, with square cells, ideally 3072x1024. Each cell holds one isolated full miniature figure on a small circular base, with generous transparent padding and no overlap into another cell. Background fully transparent alpha0, including all gaps. No painted backplate, no checkerboard, no labels/text, no gridlines.
Camera is a true high TOP-DOWN 80–90 degree view looking down on collectible hand-painted human miniatures standing on a chessboard, NOT standing front-facing portraits. Show the tops of their heads/hats, shoulders, hands, shoes and circular bases from above. All same camera, similar tabletop scale; heads and hands slightly exaggerated for readability at 40–90px. Crisp hand-inked anime fighting-game illustration, Marvel-vs-Capcom energy, bold black contour lines, cel-shaded highlights and urban fashion, matching supplied Squabblemon references.
Input references:1 Bouncer black security vest (rook),2 Simmy white shirt/leopard furry hat/rose (knight),3 John Henry navy overalls/red bandana/hammer (bishop),4 Ashlee curly hair/olive streetwear/gold boots (queen),5 Folks black ripped jersey24/white sneakers/handwraps (king/crew leader). The pawn is YN, a young navy-hoodie street kid in a black cap holding orange soda, black pants and white sneakers. Reinterpret these exact identities as overhead tabletop figures, no full portrait copies.
Column order for BOTH rows must be exactly: YN pawn, Bouncer rook, Simmy knight, John Henry bishop, Ashlee queen, Folks king. Keep distinctive silhouette and reference identity for each role. Top row WHITE side uses ivory base rim, small blue team accent; bottom row BLACK side uses charcoal base rim, small red team accent. Same character identities across both sides, change only team base/accent and subtle stance.
No conventional chess sculptures, no horses, no castle towers. These are all SQUABBLER CHARACTER figures. Fist emblems only on clothing/bases. NO CROWNS anywhere, especially king/queen; no royalty badges. No swords, no gore. Whole base and figure fully contained within each square cell; do not clip heads, feet or circular bases. Important: six columns/two rows = twelve separate transparent character assets, exact alignment and equal square cells.
```

## Piece padding correction

```text
Use case: precise-object-edit.
This is the production Squabblemon chess sprite atlas. Change only spacing: shrink and center each of the TWELVE existing figures with its circular base by about15% inside its own cell, providing generous fully transparent padding on ALL FOUR SIDES. Keep exact same six columns/two rows and 3:1 canvas2172x724. Each square cell362x362 must have at least24px completely clear transparent margin around its character and base. NO figure, hammer, bandana, glove, hat or base may touch or cross any cell boundary or canvas edge.
Preserve every character identity, overhead camera, colors, artwork, team base rims, blue top row and red bottom row, and the column order pawnYN/rookBouncer/knightSimmy/bishopJohnHenry/queenAshlee/kingFolks. Preserve fully transparent background. Do not add labels, lines, tiles or background. No crowns. Do not introduce additional figures. Only give these12 miniatures safer spacing and complete silhouettes.
```

## Park table environment

```text
Use case: stylized-concept.
Asset type: fullscreen anime urban-park chess environment for Squabblemon "CHECK THE BLOCK".
Reference image supplies the Oakland Fade Park identity, warm sunset palette, handpainted urban landscaping and graffiti. Create a NEW view from directly ABOVE looking down 90degrees on a neighborhood park CHESS TABLE plaza, not the reference's horizon view. Landscape16:9 composition, hand-inked cel-shaded anime fighting-game environment, bold contour lines and painted textures, sharp attractive lighting.
One broad square stone picnic chess table is centered, seen exactly top-down with a completely CLEAN BLANK tabletop so our actual interactive8×8 board can overlay it. Do NOT paint a chess grid, any chess pieces, UI, numbers or labels on this center table. A lightly worn warm concrete surface with thick wood/stone rim and small clenched-fist corner stamps is ideal. Keep central60percent of scene calm and unobstructed. Table fill center, surrounding park visible at edges.
Peripheral urban Oakland park details from above: worn concrete paths with chalk marks, green benches, brick planters with leaves, chain-link court fence, small basketball-court corner, discarded soda cup and skateboard nearbench, patches of grass and warm streetlamp pools. Sparse grounded environmental details, no giant people, no crowd, nothing over central table. Golden-hour amber lighting contrasted with blue shadows and restrained graffiti color. This should feel like an actual cool outdoor chess spot inside Squabblemon, not a casino or medieval game room.
NO crowns anywhere, including graffiti; replace every emblem with clenchedfists. Do not copy crown marks from the reference. No photorealism, no glossy plastic, no conventional chess sculptures. No branded ads and no readable UI text. Deliver background only, with complete composition and no transparency.
```

## Arcade cabinet

```text
Use case: stylized-concept / precise-object-edit.
Asset type: transparent Japanese arcade cabinet FRAME for Squabblemon chess game "CHECK THE BLOCK".
Image1 is the exact wide frontal arcade cabinet geometry and graphic style reference (Fade Market). Image2 supplies the new overhead Squabbler chess figures and team colors. Make a sibling cabinet in the same chunky hand-inked anime fighting-game / urban graffiti collage style, chipped painted metal and thick contour lines.
Keep Image1's wide1200:887 frontal proportions and very large central rectangular CRT cutout, approximate left16.74%,top28.66%,width68%,height51.7%. Both the outer background and ENTIRE central screen opening must be fully transparent alpha0. The hole is genuinely empty: NO glass, black fill, board, pieces, characters, controls or game UI inside. Only produce the frame and marquee.
Large readable marquee text EXACTLY "CHECK THE BLOCK", CHECK THE above BLOCK in punchy graffiti arcade typography. Small Japanese subtitle "チェック・ザ・ブロック". Palette: park forest green, cream concrete, warm gold, charcoal navy; small blue/red team accents. Checkerboard trim, park-leaf decals, tiny overhead Folks/Ashlee miniatures as stickers outside the screen. All emblems are clenched fists, including chess king/queen role decorations. Absolutely NO crowns, no crown-shaped conventional chess pieces, no royalty symbols, no swords. Use fist-led chess motifs instead.
Left rail readable stickers "5 TIERS", "THINK", "MOVE", "CHECK". Right rail "公園チェス" and "1 WIN = 1 TICKET", tiny ticket graphic. Lower centered brand plate text exactly "SQUABBLEMON". Two round lower corner speakers with green and gold glowing rings. Complete frame fully visible, no cropped corners. Keep signage bold and orderly, screen hole rectangular and empty, geometry like the other Fadecade cabinets. No full scene or background.
```

## Cabinet decoration correction

```text
Use case: precise-object-edit.
Edit ONLY two decorative details on this CHECK THE BLOCK cabinet, preserving all other artwork and geometry.
1. The small yellow/gold crown-like mark immediately to the right of the words CHECK THE, above the large fist sticker, must be replaced with a small GOLD CLENCHED-FIST stamp in the same position. Absolutely no crowns or royalty symbols anywhere.
2. Replace the pointed green leaf decals around the frame with ordinary broad rounded OAK LEAF / park-tree leaf decals, matching a neighborhood park. Avoid cannabis/marijuana-shaped leaves.
Keep the cabinet shape, screen cutout, exact1459x1078 canvas, all typography and Japanese lettering, CHECK THE BLOCK title, checker trim, characters, ticket, lower SQUABBLEMON plate, colors and speakers unchanged. Preserve the completely transparent outer background and completely transparent center CRT opening. Do not fill the screen. Only these tiny decorative corrections.
```

## Final identity correction: Guap king and Ashlee queen

```text
Use case: identity-preserve / precise-object-edit.
Edit Image1, the existing transparent six-column/two-row Squabblemon chess atlas. Image2 is GUAP's exact identity reference.
Change ONLY the sixth/rightmost column in BOTH rows (currently Folks in jersey24): replace those two king miniatures with overhead miniatures of GUAP. GUAP has neat braided cornrows/long braids, clear-frame rectangular glasses, a short moustache/goatee, a plain WHITE T-SHIRT, tattooed arms, chunky gold chains, loose black trousers and shiny black shoes. Use the reference face/hair/clothes. Gold necklace pendants MUST have small clenched-fist emblems instead of crown emblems. Do not include the reference's crown-shaped gold aura or crown-shaped jewelry. A tiny restrained gold glow near his fists is okay only inside the cell, with no background.
Keep the same elevated top-down tabletop miniature camera, art style and scale as the other figures. King stands on the same ivory/blue base in the top row and charcoal/red base in the bottom row. Keep each replacement fully inside its square cell with generous transparent margins.
IMPORTANT: ASHLEE in the fifth column is the QUEEN and must remain absolutely unchanged in both rows. Likewise keep columns1–4 YN/Bouncer/Simmy/JohnHenry unchanged. Keep exact column order p/r/n/b/q/k, six equal columns, two rows,2172×724 canvas with362×362 square cells. Preserve true transparent background and cell gaps. Do not move or resize other figures. No text labels or gridlines. No crowns anywhere. This edit only makes GUAP the KING, while ASHLEE remains the QUEEN.
```

## Guap fist pendant correction

```text
Use case: precise-object-edit.
Keep this entire12-piece chess atlas identical. Make ONLY the tiny gold necklace pendant on the two GUAP figures (sixth/rightmost column, top and bottom rows) visibly read as a GOLD CLENCHED FIST. A compact sculpted fist pendant with four knuckles and a tucked thumb. Do not use a crown, crown outline, three-point badge or royalty symbol on the pendant. Keep Guap's glasses, braids, plain white tee, black pants, pose and circular team base unchanged.
Keep Ashlee queens and all other pieces absolutely unchanged. Maintain transparent background, six columns/two rows with generous clear margins and square cells. Target exact2172x724 canvas. No new text/background or altered base emblems. This is only a precise fist-pendant correction.
```
