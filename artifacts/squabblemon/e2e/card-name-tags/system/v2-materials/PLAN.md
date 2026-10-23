# Squabblemon V2 — rarity borders, foil stock, and selective accents

Status: proposed material system built around the approved layered-card composition. The companion HTML is an interactive material sketch, not the production renderer or a change to any card's rarity. Existing six-card audition remains the layout baseline.

## 1. The direction

The character and element establish identity. Rarity establishes the physical card material. Keep the jagged anime print, original artwork, current Hemi Head numbers, fitted Blzee postal name, and black rules paper. Give that composition a coherent physical backing and a rarity-colored border. Increase foil coverage, pattern depth, and reflective complexity as rarity rises.

Three separately controlled surfaces do the work:

1. **Border:** the clearest rarity signal and the strongest reflective surface.
2. **Backing:** a foil stock behind the illustration and elemental print, visible through deliberately authored openings.
3. **Accents:** postal band, postal paper, Motion plate, gold fist, and selected elemental highlights. These get their own masks and strengths.

Legendary is the warm gold collectible. Mythical is its richer crimson counterpart, with the approved small circular cosmic pattern and finer prism glints. The vintage holographic trading-card feeling comes from depth behind the figure and light moving through the stock, not from repainting the character or adding a full-card rainbow wash.

This updates the earlier plan: postal paper and selected UI plates are now allowed to be foil. Their lettering and numerical glyphs remain opaque, stable ink above the material. The black rules field stays matte.

## 2. Complete rarity ladder

The live local source audit contains seven tiers. The engine key `Epic` is presented to players as **Super Rare**. Do not rename stored rarity keys, alter pull odds, or imply a stat benefit.

| Rarity | Border | Backing behind the art | Postal label | Other foil accents |
|---|---|---|---|---|
| Super Common | Warm gray pressed edge; dry ink; no spectral foil | Opaque charcoal stock with coarse paper grain | Familiar blue/red postal print; matte ivory name field | None; printed gold fist and yellow Motion |
| Common | Pale silver/pearl edge, quiet satin catch | Fine dark paper; very slight neutral sheen | Matte print and ivory field | No rainbow or moving glitter |
| Uncommon | Emerald lacquer edge with fine engraving | Dark coated stock; sparse spot varnish | Thin varnish on band and tiny rarity stamp | Small gold-fist glint; Motion remains flat yellow |
| Rare | Cobalt metal with colored holographic microflakes | Blue holographic stock with dense irregular spectrum flakes and darker gaps behind the figure | **Blue band becomes cobalt foil; white becomes light pearl foil**; black name stays readable | Select gold knuckle edges and elemental highlights; keep Motion yellow and mostly matte |
| Super Rare / Epic | Amethyst metal; larger broken prism facets | Deeper silver/violet foil with larger, less frequent facets; more depth than Rare | Prismatic blue band and stronger pearl field; separate pattern from Rare | Broader fist/element spot foil; faint amber varnish on Motion, not a new Motion color |
| Legendary | **Rich holographic gold**: deep bronze, warm gold, champagne peaks, engraved fist details | **Gold holographic backing** with dense gold microflakes, colored diffraction, and a broad controlled light sweep | Retain recognizable blue/red postal identity; warm pearl name field, metallic band and gold rarity accent | **Yellow Motion plate becomes yellow-gold foil**; gold fist becomes embossed foil; element tips catch matching light |
| Mythical | **Crimson holographic metal**: oxblood shadows, ruby midtones, rose/silver highlights, fine prism glints | **Crimson opal foil**, dense multicolored facets and more layered reflection than Legendary | Foil band, cool/rose pearl name field, crimson rarity accent; retain dark name ink | Strongest controlled fist/element foil. Motion remains unmistakably yellow-gold with richer reflection; Hands stays white |

The hierarchy changes material, not just opacity. Rare has fine colored flake stock; Super Rare has larger fractured planes; Legendary has warm gold microflakes and depth; Mythical has crimson opal stock and denser prismatic flashes. White stripes are not an acceptable foil texture. Lower tiers must still look deliberately designed when motion is disabled.

**Reading “the red version” precisely:** Mythical's border, backing, and rarity accents become crimson. Do not turn Water fire-red, replace the original gold fist with a red fist, or recolor the yellow Motion/white Hands system. Those carry other meanings.

## 3. The border and the transparent areas

Create one shared 63:88 physical-card silhouette. Its shape and layout bounds remain the same at every rarity; higher tiers change the material rather than becoming larger. Start the visible border around 1.5–2% of card width, with a 3–6 CSS px usable range, and tune against real 144/192/320 px card sizes. These are audition targets, not approved measurements.

The border is a continuous outer frame around the elemental composition, including a closed lower edge. Let selected ink cuts overlap it, but retain enough visible border to read rarity at a glance. Avoid a second nested frame and the colored component lips already rejected elsewhere. This is the card's physical frame, not an accent stripe attached to a UI container.

The backing fills transparent holes **inside** that card silhouette. Pixels outside the card remain transparent. Do not resurrect the oversized rectangular glow that was just removed from the pilot. Borders and backing must share the same silhouette, radius/corner cuts, and foil coordinate system.

**Important asset issue:** the current Fire master has alpha around its irregular outside edge, but much of its charcoal interior is opaque. The ten-background sheet is also not an exported transparency/mask set. Simply placing a gold texture beneath those images will barely reveal it. Final assets need:

- A clean physical-card backing silhouette.
- Elemental ink separated from the quiet substrate, or a deliberate grayscale window mask that opens selected substrate areas while preserving printed lines and halftone.
- Opaque black rules paper, opaque original character pixels, and properly registered safe regions.
- A small visual comparison showing the alpha alone on light and dark backgrounds. Fake checkerboards, gray gutters, and neighboring atlas pixels are release failures.

Do not multiply-screen the entire original image to manufacture transparency. That would lift black outlines, wash out art, and change the approved appearance.

## 4. Foil zones and protected ink

| Zone | What changes | What remains protected |
|---|---|---|
| Outer border | Highest reflectivity and the clearest rarity color | Shape, hit area, selected/focus outline |
| Inner backing | Dark substrate plus tier-specific holographic pattern | Character silhouette, source artwork, black outlines |
| Elemental background print | Selected flame tips, waves, veins, feathers, cracks | Dominant element color and ink structure; no all-over recoloring |
| Postal blue band | Cobalt foil from Rare upward; tier-specific reflection | White FADE EXPRESS text and source rarity caption |
| Postal white paper | Pale pearl foil from Rare upward, warmer for Legendary and rosier for Mythical | Black Blzee name, red/blue postal marks, short-name fitting and long-name wrapping |
| Motion badge | Yellow-gold foil for Legendary/Mythical; restrained varnish below | Yellow recognition, black number and MOTION label, exact current value |
| Hands badge | Matte white baseline across all rarities | Black base number, green gain, red loss, status legibility |
| Elemental fist | Embossed gold with tier-dependent spot reflection | Gold identity, knuckle silhouette, black anatomy lines |
| Element tail | Small highlights following the actual element | Plant/Earth, Poison/Dark, Normal/Electric distinctions |
| Rules and ability copy | Black textured paper, stable ink | No foil, glow, shimmer, grain motion, or glare across the text |

One shared light position drives every reflective zone. Border and background can have different roughness and pattern scales, but highlights must travel in the same direction. Fist, badge, and postal foil should feel like parts of the same tilted object.

Priority when the card is visually busy: border first, backing second, emblem third, postal paper fourth, Motion fifth. Reduce the last accents first; never sacrifice readable numbers or character identity to preserve a decorative effect.

## 5. Layer order and mask contract

Bottom to top:

1. Physical silhouette, neutral opaque base, and subtle contact shadow.
2. Rarity backing: base metal color, static grain/engraving, then directional reflection.
3. Rarity border, with the same lighting and separate roughness.
4. Elemental background ink. Authored windows reveal the backing; designated motif highlights can carry spot foil.
5. Original character artwork at its current contain-fit and position. No shared foil tint on skin, clothes, or faces.
6. Gold fist and elemental tail, each with an authored highlight mask rather than a rectangular image overlay.
7. Matte rules paper and real rules text.
8. Postal paper material, band material, postal printed marks, then Blzee name and rarity caption.
9. Motion/Hands plate materials, then their numerical and text glyphs; wordmark and semantic status above those.
10. Focus, selection, disabled state, and interaction feedback independent of rarity.

Use normalized card UVs for the frame/backing. Label and stats masks belong to their own DOM components and follow their measured dimensions. A fixed full-card postal mask will fail when GUAP and Racially Ambiguous Transplant use different label widths.

Suggested material regions: `border`, `backing`, `elementInk`, `postalBand`, `postalPaper`, `motionPlate`, `fistMetal`, `elementTail`, `wordmark`. Maintain a protected-content rule for character art, all glyphs, rules paper, Hands, and interaction cues. Runtime layering alone can protect opaque foreground art; bespoke portrait/foreground masks are necessary where a material pass intersects the art plane.

Keep silhouette alpha and foil strength as separate concepts. Opacity holes should not appear when foil is disabled. A matte fallback still renders a complete opaque physical card.

## 6. Element × rarity × edition

The latest local catalog audit verifies **301 cards: 278 characters, 13 supports, and 10 Blockbusters**. There are **10 elements, seven rarities, 100 portrait-layout entries, and two immersive cards**. These are local source counts, not deployment evidence. Full IDs, tier definitions, matrix counts, and source hashes are in `audit.json`.

Build one resolver from actual card data. Its inputs are canonical element, source rarity, equipped edition, artwork layout, surface, and quality settings. Its output is a composition and material recipe. It must not infer rarity from a filename, element color, stat total, or preview selection.

**Ten elements:** Normal, Fire, Water, Plant, Air, Electric, Poison, Light, Dark, Earth. Normalize legacy Rock to Earth. Correct the old wallpaper mapping's Poison/Light/Earth fallthrough when the production resolver is introduced. Unknown data gets a neutral fallback plus a development diagnostic, not an arbitrary gold scene.

**Six edition states:** base plus the five existing cosmetic variants.

| Edition | V2 policy |
|---|---|
| Base | Source rarity's complete frame, backing, and accent recipe |
| Alternate | Change only authorized character artwork; retain rarity and element material rules |
| Tagged | Add the authored tag/stamp treatment in safe regions; keep rarity text and a visible rarity-colored border segment |
| Chrome | Replace metal stock with silver chrome while retaining a readable rarity cue and element print; never stack two full backing shaders |
| Prismatic | Replace the reflection program with reverse-holo spectral stock inside allowed zones; preserve all ink protection and rarity identification |
| Crazy | Preserve authored breakout illustration and safe overflow; fit border/backing to the physical card while character overhang remains explicit |

Precedence: source identity/art → element composition → rarity material → one equipped edition's permitted overrides → protected UI → interaction state. Cosmetic variants never change rarity, stats, ownership, or gameplay.

There are **70 base element/rarity combinations** and **420 resolver combinations including base plus five editions**. These are test combinations, not a request for 420 painted cards. Export reusable element art, masks, seven material recipes, and edition policies.

## 7. Special artwork and every surface

| Case | Handling |
|---|---|
| Transparent character cutout | Full backing can show around the character; original art stays above it |
| 100 portrait-layout cards | Preserve the baked scene. Apply border and exposed margins; add internal foil only with a reviewed art-specific mask |
| Rastamon / Wifey immersive cards | Preserve their authored moving scene and foreground layers; the new card stock sits beneath or around that scene |
| Support cards | Retain support labeling and item identity; do not pretend a fist badge makes the item a character |
| Blockbusters | Keep wide lane-event artwork and event labeling; use an event composition with the same rarity material language |
| Tokens, hazards, bosses | Keep existing encounter/summon identity and current rarity semantics; never invent collectible rarity or ownership |
| Long names | Fit the postal paper to measured glyphs; move the emblem, not the name; test Oz/GUAP/KYLE and the longest source names |
| Long rules | Keep a stable art area and explicit excerpt budget in grids; all authoritative rules stay available in full details |
| Equipped card scene/background | Preserve the player's equipped content inside the art window; the rarity backing surrounds it or fills available transparency. Do not silently discard a purchased/equipped scene |
| Loading/failure | Stable aspect ratio and neutral stock while assets load; keep name, stats, rules, and interactions usable when a texture fails |

Initial adoption remains **collection, deck builder, and full card details**, including their selected/disabled/locked states. Inspect other consumers of CardView before changing a shared default. Pack reveals, shops, reward cards, and trading surfaces need a separate adoption pass after the collectible layout is accepted. Battle hand and mat retain their approved compact faces; introducing any of these materials there is a later scoped decision.

Inside collection/deck-builder grids, use a static material snapshot and restrained specular highlights. Inspection or the focused hero can run live light. A card should not need hover to communicate rarity, and touch scrolling must not be intercepted by tilt behavior.

## 8. Asset production and implementation ownership

Keep the generated studies as source references. Final masters use the same 1260×1760 / 63:88 registration and named safe zones. Do not ship the cropped ten-card or ten-fist concept sheets.

Deliverables:

- Ten separate elemental ink plates with consistent registration and intentional exposed backing regions.
- Ten transparent open fist/element marks using one exact gold-fist anatomy, plus masks distinguishing metal from the element tail. Produce simplified 24–32 px marks if small-size testing requires them.
- One common physical silhouette and border mask; explicit layouts for portrait/event/immersive exceptions.
- Shared black rules-paper end caps and center, and flexible postal-band/paper geometry.
- Seven rarity material recipes: color ramps, grain/pattern maps, roughness, reflection strength, accent-zone permissions, and static fallback.
- Edition overrides and a manifest recording dimensions, alpha bounds, hashes, source prompts, and revision IDs.
- No baked names, stat values, rarity words, ownership marks, or ability text in the generated art.

Proposed source ownership:

| Area | Responsibility |
|---|---|
| `cardMaterial.ts` | Typed rarity/element/edition resolver and semantic labels sourced from engine definitions |
| `CardStock` | Silhouette, border, backing, and element-print composition |
| `CardPostalLabel` | Flexible paper/band foil under opaque typography and printed marks |
| `CardElementMark` | Gold fist, elemental tail, accessible element name, and spot masks |
| `CardStatBadge` | Existing authoritative values and colors; material strictly below the glyphs |
| `CardFoil` + shared renderer | One material engine and bounded atlas/cache, visibility/quality/reduced-motion handling |
| `CardView` | Composition and gameplay state; resolve explicit V2 surface opt-in |

The current pilot deliberately suppresses old wallpaper, engraving, rarity glow, CSS foil, GPU foil, and imported full-card material when its layers are active. Production must make that an explicit renderer switch. Do not leave two foil stacks fighting through CSS specificity. Keep the old path available behind the feature switch for rollback.

The existing shared renderer has 128×179 tiles in a 4×4 atlas and caches by rarity/edition. Per-card silhouette and element masks complicate that sharing. Prefer caching reusable material fields by tier/edition/quality, then applying masks in composition. If a mask is baked into a cached tile, its revision/layout/element must enter the cache key; otherwise cards can inherit the wrong shape.

Replace the legacy crown texture and stock-map crown motifs with fist engraving. Merely hiding the current CSS crown does not remove the renderer's crown pattern. Inspect both static and live output.

## 9. Performance, motion, and readability budgets

These are proposed acceptance targets to profile, not achieved measurements:

- No continuous per-card animation loop in a collection grid. Static tier materials remain cached and can be shared.
- One inspected/focused card receives active pointer light; allow a second only during a bounded transition. Reuse the shared renderer rather than a new WebGL context per card.
- Start the mobile live-material tier at 30 fps and DPR ≤1.5; the UI and scrolling keep their normal cadence. High quality can increase detail only after measurement.
- No repeated layout reads in a frame loop. Cache card bounds at pointer entry/resize and batch input updates. Pause hidden/offscreen work and dispose observers/listeners on unmount.
- Reduced motion keeps the full still material identity and disables travel, pulsing, idle tilt, and animated sparkle. GPU failure, low-power mode, and texture failure fall back to the same legible static recipe.
- Candidate delivery targets: ≤180 KB for a 756×1056 element plate, ≤35 KB for a 252×352 thumbnail, ≤20 KB for a small emblem, and ≤30 KB per compact mask set. Assess detail after compression. Keep generated PNG masters out of the runtime bundle.
- A decoded 756×1056 RGBA texture uses about 3.05 MiB before mipmaps and copies. Compressed download size alone is not a memory budget. Measure all live textures and limit preloading.
- Compare 100-card scroll traces with the current approved grid. Proposed gate: no more than 10% regression in p95 frame time and no new >50 ms long tasks attributable to foil. Record device, browser, viewport, cold/warm state, and quality tier; tune thresholds if the baseline itself is poor.

Readability gates:

- Black names/numbers remain opaque and do not change with the light. Keep the postal paper pale and yellow Motion bright enough throughout the sweep.
- Normal text targets 4.5:1 contrast; qualifying large text targets 3:1. Measure against the lightest/darkest local material states, including intersections of texture and specular highlights.
- No full-card flashing. Small glints cannot become a synchronized screenful of flashes.
- Mythical red is a collectible material, not damage feedback; dynamic damage numbers/status remain semantically separate.
- Visible focus/selection uses a separate outline and is never confused with rarity shine. Hit targets stay stable; labels never steal clicks.

## 10. Execution order and approval gates

### A. Lock the material ladder on the approved layout

Use one figure and one Fire print to compare Rare, Super Rare, Legendary, and Mythical at the same size and light position. Clearly label these as material swatches, not changed catalog rarity. Show all seven tiers as a still ladder. Test every foil zone independently with on/off controls, then together.

Gate: the gold and crimson cards feel substantially more valuable, Rare and Super Rare remain distinct, the art still dominates, and the postal name/stats remain clear. The companion bench covers this design discussion with approximate CSS material sketches; it does not settle final shader quality.

### B. Export the real masks and material masters

First finalize Fire backing/border, separate print, postal surfaces, and fist masks. Review alpha on light/dark pages and against the assembled pilot. Then apply the same contract to all ten elements. Keep the all-black rules region and original character art protected.

Gate: no opaque charcoal blocking the intended foil window; no rectangular halo, gray gutter, clipped elemental tail, or art tint. Exports share registration and fit at 24/32/48/72 px emblem sizes.

### C. Implement a single opt-in V2 material path

Wire the resolver, split the decorative UI surfaces from their glyphs, adapt the shared foil renderer/cache, and preserve static fallbacks. Apply only to the agreed collectible surfaces. Reconcile all five editions before moving the default.

Gate: actual source rarity and stats are unchanged; old material stacks do not render under V2; reduced-motion and GPU-loss views keep the same information and complete card silhouette.

### D. Full matrix and stress verification

Generate 70 base swatches and deterministic coverage for all 420 element/rarity/edition combinations. Do targeted visual review of every base tier plus difficult pairings: Fire Mythical, Water Mythical, Light Legendary, Electric Legendary, Poison Epic, Dark Epic, Plant Uncommon, and Normal Rare. Each must preserve element identity despite similar rarity colors.

Exercise source examples across all artwork layouts and card kinds. Check short names, longest names, long rules, 0/9/10/99/100 stats, buffed/debuffed Hands, selected/unavailable states, slow fonts, missing assets, keyboard focus, touch scroll, inspector close/return, and all supported editions.

Viewport set: 320, 390, 430, 768, 849, 1024, 1280, and 1536 CSS px, plus short landscape. Inspect actual card widths rather than only window widths. Add physical iPhone/iPad/Android checks before a mobile-performance claim.

Gate: visual fit, contrast, normal interactions, source-value parity, bounded memory/renderer work, and the agreed scroll baseline all pass. A screenshot proves appearance at one state, not the full light sweep or device performance.

### E. Promote the approved surfaces

Move the opt-in through collection → deck builder → full details, with a rollback switch and versioned media. Only then plan pack/reward/shop adoption and discuss whether battle should receive a restrained rarity edge. Stage tested scope only if a release is requested.

## 11. What this pass delivers

- Current local source audit with card counts, full matrix, and relevant source hashes.
- Complete seven-tier plan, nine material zones plus a separate cosmetic border slot, protected-ink rules, and a full element/edition/special-artwork policy.
- An interactive material bench with the actual FOLKS artwork, same art/layout across swatches, light slider, zone toggles, gold/crimson comparisons, and mobile layout.
- Proposed implementation ownership, export checklist, performance/readability gates, and rollout sequence.

It does not modify the approved six-card design, game data, production styles, ownership, gacha odds, or the deployed app. No new raster artwork or production shader is claimed by this material sketch.


## 15. Prismatic revision — latest direction

The current local audition replaces the old stripe/ring pass with an original, deterministic vector flake field. Irregular saturated facets, a tier-colored substrate and a broad spectrum reflection share the existing pointer-light coordinates. The card center opens onto this backing while authored elemental edges and original character art remain layered above it. This is an audition implementation; registered production masks and device performance profiling remain required.

### Wordmark

Place the existing Squabblemon mark centrally between the top Motion and Hands plates, in the safe region from 31% to 69% of card width. It is fully opaque. Ordinary tiers use white ink, Legendary uses gold foil, and Mythical uses silver holographic foil. Mythical's frame stays crimson. The logo's source shape remains unchanged and never uses replacement lettering. Keep it below interaction cues and away from both stat plates. Do not let a cosmetic border recolor or hide it.

### Extra borders bought for Clout

Keep `borderCosmeticId` separate from rarity, element, character form and edition. The preview includes two proposed trim treatments, Prism and Black Chrome, to prove coexistence; these are visual concepts, not newly created shop SKUs, prices or ownership entitlements. Current source also has edition finishes crafted with Style Shards; do not silently relabel or migrate that economy to Clout.

- Reserve the outer 1.1% width for cosmetic trim within the existing card footprint. Retain the next inner strip of the rarity frame, the printed rarity label and its wordmark recipe. An accessory must not turn a Rare into an apparent Legendary.
- Base renderer order: substrate → rarity foil → elemental ink → character → label/rules/stats → cosmetic edge in its reserved mask. All layers use the same silhouette and light. No independent full-card glare stack per purchased frame.
- Resolve compatible ownership server-side before equip. Unknown, expired, unsupported or missing border art falls back to the rarity frame; artwork and game values still render. Preserve the saved cosmetic selection if a surface cannot render it.
- A border cannot expand card bounds, mask numbers, intercept pointer events, imply a bonus, or change the element. It cannot alter the selected/focus outline. Use fists rather than crowns in any authored motifs.
- A border is independently removable; changing editions or previewing a form must retain its choice. Keep current edition meanings and existing saved cosmetics intact during migration.
- Budget one cosmetic edge pass. Static grid cards use a cached finish, with active light only on the inspected/focused card. Border sampling joins the same renderer, not a new canvas/context per item.
- Expand coverage from the existing 420 base element/rarity/edition combinations by the number of supported border states, including none. Review Fire/Mythical with Prism, Light/Legendary with Black Chrome, the longest postal names, portrait art, both Buddy forms and mobile details. Validate ownership/equip and save/reconnect separately before selling any new item.

### Buddy forms

Buddy's collectible/base element is **Plant**. A Squabbled play transforms his battle instance into **Earth** and uses his existing rock-fist artwork. Keep the legacy normal-form wire enum `earth` for old match compatibility; the authoritative `type` distinguishes Plant from Earth. The two-round Earth modifiers expire as before; his Earth element does not revert on expiry.

Full collection details have a compact Normal · Plant / Squabbled · Earth control. It updates the original illustration, elemental plate/fist, ability text and base Hands together, without spending Squabble, changing inventory or changing an equipped finish. The Squabbled preview shows double printed Hands (6), explicitly before the +2 Earth battle effect; live battle details continue showing actual match state. Switching back restores the untouched Plant catalog data. This initial form control is for Buddy's two authored forms; no invented transformations are added to other characters.

### Local revision validation

Evidence and the scoped validation report are in `prismatic-revision/`. Engine tests cover normal Plant, Earth transformation, permanent form after timed-effect expiry, input immutability and multiplayer serialization. Browser checks cover the preview switch, art and labels, opaque gold/silver wordmarks, preserved stats under cosmetic trim, battle presentation exclusion, and phone/desktop layouts. This is local evidence, not a production release or physical-device performance claim.
