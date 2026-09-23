---
name: Squabblemon physical UI language
description: The user-approved presentation language for menus, overlays, buttons, and immersive controls.
---

Treat controls and information panels as physical objects from the Squabblemon world: street signs for primary actions, torn paper for feature panels, floating paper/tape labels for tab menus, layered venue props for navigation, and original cel-shaded arcade art for character-led flourishes. Use the real paper textures for outer navigation and feature surfaces, but keep dense grids, battle cards, dialogs, and form controls restrained. Parallax should create obvious depth while retaining reduced-motion and mobile-safe alternatives. Dr. Fade can act as the DJ/host around music controls.

**Why:** The user wants the remaining polish to feel like a high-end fighting game rather than regular rectangular application UI, and explicitly approved bulletin-board staging, stronger venue parallax, ripped-paper panels, and Dr. Fade DJ art.

**How to apply:** Reuse the established visual primitives on future screens before inventing new container styles. Prefer floating paper labels over a continuous software-style tab bar. Keep live text and controls in accessible HTML above decorative art; never bake required labels into generated images or let foreground art cover controls.

On the Safehouse, keep floating room labels dark and understated, but use long torn-paper banners for the detail panels opened by clicking room objects.

**Why:** On 2026-09-23 the user rejected the scattered paper treatment on the room, then clarified that the longer banner-style popup panels were the part they liked. Do not interpret rejection of the room labels as rejection of those detail banners.

**How to apply:** Keep the Safehouse scene prominent with compact dark translucent markers and light text; retain wide torn sheets and dark ink for opened detail panels. Leave paper treatments elsewhere unchanged unless requested.

Collection and deck-management screens should use one flush, full-height composition without a focus/expand mode.

**Why:** The user found the expand control unnecessary because it only changed the wallpaper, and the reserved space made the Deck Builder action bar appear to float too high.

**How to apply:** Let decorative scenes cover the full screen, keep scrolling inside the content region, and pin essential deck actions to the true bottom edge on desktop and mobile. Do not reintroduce wallpaper-only expansion.

The supplied inspector paper and tape JPGs contain baked checkerboard margins, not transparency.

**Why:** Applying the whole images as panel and tab backgrounds exposed checkerboards on the Fighter ID, despite using the correct original textures.

**How to apply:** Use a central crop or sufficient background overscan for opaque material surfaces. Inspect the rendered image corners rather than assuming the source's checkerboard indicates alpha.

Do not reuse the narrow kraft strip with the large right-side cutout (`ripped-strip-kraft.webp`) on controls. Prefer a full-width paper strip.

**Why:** The user explicitly rejected that cutout on Friend fades and asked to replace it everywhere it appeared. This was a rejection of that specific shape, not of paper buttons generally.

**How to apply:** Keep paper-button variation, but select art with a continuous paper surface behind the full label rather than bringing this retired option back.