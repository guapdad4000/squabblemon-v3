# Punch on Patrol cabinet v1

Generated with the built-in imagegen tool on 2026-10-08. The Fade Market cabinet provided geometry/style; Officer Oink tier one provided character identity. Both reference images were inspected before generation.

- PNG master: `punch-on-patrol-cabinet-v1.png` (1459 × 1078 RGBA).
- Runtime WebP: `artifacts/squabblemon/public/assets/boss-raid/punch-on-patrol-cabinet-v1.webp`; quality 90, alpha quality 100, no resizing or background editing.
- Center CRT opening and outside canvas have real transparency.
- Live screen uses left 16.74%, top 29.5%, width 66.6%, height 50.5%, with its edges tucked behind the bezel.
- Visible identity is **Punch on Patrol**; existing internal boss-raid routes and saved-game keys remain stable.

## Final generation prompt

```text
Use case: precise-object-edit / stylized-concept.
Asset type: transparent production arcade cabinet bezel for the Squabblemon Fadecade game "PUNCH ON PATROL".
Image 1 is the edit target and exact cabinet geometry/style reference (Fade Market). Image 2 is a supporting character reference: cartoon corrupt pig police boss Officer Oink.
Create a NEW sibling arcade machine frame matching Image 1's very wide front-facing cabinet proportions, hand-inked anime fighting-game/graffiti collage style, chipped paint, chunky black outlines, beveled metal, Japanese arcade stickers, lower branded plate, and circular glowing speakers. Keep Image 1's frontal shape and screen opening proportions. Keep canvas aspect about 1200:887, and the screen opening at left 16.74%, top 28.66%, width 68%, height 51.7%. The entire central CRT opening must be a genuinely EMPTY TRANSPARENT RECTANGULAR CUTOUT with alpha 0, so our live game interface shows through it. The outer background must also be fully transparent with alpha 0. No glass, no black fill, no scene, no controls or artwork inside this hole.
Replace all Fade Market branding with very large readable marquee text, exactly "PUNCH ON PATROL", arranged as PUNCH ON above PATROL, graffiti fighting-game typography. Small Japanese subtitle exactly "パンチ・オン・パトロール".
Palette: arresting police navy/cobalt, white chipped panels, caution yellow/gold, electric red/blue warning lights. Make it visually belong beside the existing blue Fade Market, red Block Takeover and pink Girl Fade cabinets, while being distinctly police themed.
Decorate only the frame: clenched-fist police patches, a small stylized Officer Oink head sticker derived from Image 2, siren shards, caution stripe accents, urban graffiti. Left rail readable stickers "5 BOSSES" and "6 ROUNDS"; right rail "毎日挑戦" and "BOSS RAID". Lower centered plate text exactly "SQUABBLEMON". Two round speakers at bottom corners with red and blue luminous rings. Keep stickers neat and title legible.
All emblems must be clenched fists. NO CROWNS anywhere, including tiny stickers. No royalty symbols. No real brand logos. Do not copy crowns from other game art. Do not put a full-height Officer Oink character in the opening. Do not add a backdrop or a complete game screen. This deliverable is solely the transparent cabinet FRAME, fully visible with no cropped corners, same scale/proportions and empty center as Image 1.
```

## Final badge correction prompt

The selected master includes this follow-up to enforce fist emblems on the two small hat badges. It preserves the initial cabinet layout.

```text
Use case: precise-object-edit.
Edit the attached Punch on Patrol arcade cabinet. Change ONLY the two tiny gold badges on Officer Oink's police hats (upper-left head sticker and lower-right head sticker): replace their star/sun-like emblems with crisp small GOLD CLENCHED-FIST emblems, fitting the same badge circle and position.
Keep EVERYTHING else absolutely identical: all text and typography including PUNCH ON PATROL and Japanese subtitle; character faces; colors; materials; cabinet shape; lights; all decorative fist stickers; screen-opening position and size; 1459x1078 canvas and front-facing framing.
Preserve the true transparent outer background and transparent central CRT opening exactly. No fill in the opening. No crowns, no royalty symbols, no star emblems. Do not redraw or rearrange the cabinet. This is a tiny badge correction only.
```
