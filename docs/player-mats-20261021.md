# Player mats — Collection 01

Players bring their own half of the battlefield. The opponent’s mat occupies the upper side; the local player’s mat occupies the lower side. The join tracks the district score row as the viewport or field scroll changes. Artwork uses one proportionally cropped background per side. Wide views share a full-board canvas: the rival reveals the upper source half and the player reveals the lower source half. Portrait phones use a wider crop anchored to the top and bottom edges. No mat artwork is repeated inside district lanes and no floating character cutouts are rendered.

## Collection

Five original venues are free: The Corner, Harbor After Dark, Civic Steps, Red Fence, and Rooftop Champions. Existing internal venue IDs are preserved. When both players select the same mat, it renders as one continuous scene.

Twenty characters launch in the first signature collection. All twenty have newly generated character-specific illustrations and clean environment layers in the approved cel-shaded anime style. Each world authors three open play regions. The normal lane controls sit over the continuous scenery; the runtime does not duplicate those regions as lane images.

| Character | Mat | Unlock |
| --- | --- | --- |
| KYLE | Blue Hour | 200 Legendary shards |
| GUAP | All Gold | 280 Mythical shards |
| Captain Jigga | First Class | 280 Mythical shards |
| Ashlee | Island in the Sky | 280 Mythical shards |
| Simmy | After Hours | 280 Mythical shards |
| STOCKZ | Top Floor | 140 Rare shards |
| Foodz | Everybody Eats | 280 Mythical shards |
| BUDDY | Homegrown | 200 Legendary shards |
| Yasuke | Quiet Resolve | 280 Mythical shards |
| John Henry | Steel Yard | 280 Mythical shards |
| Dragonfly Jones | Big Talk | 200 Legendary shards |
| Franklin Duke | Full Contact | 180 Super Rare shards |
| Chonk Lee | No Mercy | 200 Legendary shards |
| Bushedo Brown | Do Not Disturb | 140 Rare shards |
| Undercova Brotha | Under the Radar | 140 Rare shards |
| Dr. Fade | First Fade | Clear Welcome to the Block |
| Abuela | Family Business | Clear Mama Has the Floor |
| OG Uncle | Been Here | Clear OG Uncle’s Visit |
| Church Auntie | Sunday Best | Clear Auntie’s Terms |
| Leroy | The Glow | Clear The Demo Table |

Matching rarity shards are spent first; Universal shards cover the remainder. These initial prices are catalog values. A mat can be purchased without owning its character, and purchasing it never grants that character or changes battle stats. Story mats derive ownership from server-saved completed nodes, so existing clears qualify immediately without another purchase or claim.

## Player flow

- Style opens the mat catalog at `/game/style` (or `/game/style?view=mats`). Character collections share the same hub at `/game/style?view=characters`; old `/game/mats` links redirect there. Express has a direct Style stop, and the Market, inventory and Collection link to this hub.
- Browse the catalog immediately, with All mats / Shop / Owned / Story filters and character or mat-name search. Rarity filtering and shard balances expand on demand. Search and filter choices survive category changes and refresh.
- Select a mat for a full-scene or PvP split preview in a focus-trapped dialog, with its rarity, exact shard payment and unlock/equip action together. Phone previews scroll within a bottom sheet while the action remains visible; closing restores the catalog focus and scroll position.
- Unlock using the existing server purchase transaction, then equip. A lost response retains its original request key and offers purchase recovery.
- Equipment persists in `settings.cosmetics.playerMatId`. Invalid, unknown, or unowned selections cannot be equipped. Legacy profiles resolve to The Corner.
- PvP snapshots the validated mat ID with each member on room entry. Both seats project their own mat to the lower half. Reconnecting preserves that room’s pairing; later equipment changes apply when entering a new room.
- Training uses the full equipped mat. Story, guided tutorial, and Kumite retain their authored presentation.

## Implementation

- Shared catalog, ownership and fallback resolution: `lib/squabblemon-engine/src/playerMats.ts`.
- The existing shop planner, row lock, receipt and Style Shard accounting handle purchases. Story/default mats are rejected by the purchase planner.
- The existing cosmetic endpoint validates equipment; OpenAPI and generated clients include the new field and purchase kind.
- No database schema migration is required: ownership and equipment use existing JSON fields. No gameplay rules version changes.
- Only the mat ID is exposed through online member metadata. No wallet or story history is sent to the opponent.
- Mat rendering is memoized, uses passive scroll observation, and never captures pointer input. The Style hub and its mat catalog are lazy-loaded; character collections share the same route and category navigation.

## Validation

- 24 server/economy tests passed against a disposable local PGlite database, including retries, concurrent wallet spending, save/reload, story ownership and server-issued member snapshots.
- 76 battle tests passed, including guest-seat reversal, reconnect and Kumite exclusion.
- All 20 character mats passed mobile PvP and desktop training checks (40 cases); previews and rarity filters passed at both sizes. Local Chromium collection and battle checks cover 320×568, 390×844, 768×1024, 844×390, 1280×800 and 1920×1080. Purchases, lost-response recovery, story locks, equipment persistence, scrolling, image sizing and card interaction are checked.
- Frontend and API type checks pass. Production build and configured bundle budgets pass.
- Review captures use isolated browser fixtures. This is not authenticated production multiplayer or physical-device evidence. Production multiplayer and physical-device behavior are outside these local checks.

Run focused checks from the repository root:

```sh
pnpm exec node scripts/test-api-database.mjs player-mats
pnpm --filter @workspace/squabblemon typecheck
pnpm --filter @workspace/api-server typecheck
```

For browser checks, start the frontend Vite server on port 4228, then run `node --import tsx e2e/verify-mat-collection.mts`, `node e2e/verify-mat-lanes.mjs` and `node e2e/verify-player-mats.mjs` sequentially from `artifacts/squabblemon`. The runner accepts `MAT_REVIEW_URL` and `MAT_REVIEW_OUTPUT` overrides.


## Character scene refinement

See player-mat-art-direction.md for the approved cel-shaded style, three-lane geometry and 20 ability-based scene briefs. All 20 original collection scenes now have generated character-specific artwork. Hooper remains an additional concept outside the catalog. Illustrated review exports place characters in the lower corners; clean scene variants support responsive backgrounds without stretching. Transparent cutouts are retained as source assets for possible future cosmetics; they are not used in the mat presentation. Training uses the full equipped mat; PvP retains one half per player.

Generated assets are under public/assets/player-mats/v4. The exact built-in image prompts and durable illustrations are in output/player-mats-20261021/collection-v4 (remaining 18) and art-direction-v3 (approved pilots) in the shared project directory. The battle renders only full-board scene layers, clipped at the score row. Their center line tracks field scrolling. Character cutouts remain archived assets and are not fetched by the battle. The Stylist pairing preview uses clean scenes with the same upper/lower treatment; catalog thumbnails retain the illustrated collection art.

PvP reactions moved from the closed tools menu to immediately left of player Motion. The picker portals to the document body to avoid footer containment/clipping, with 44px trigger, focus return, Escape, cooldown and reconnect messaging retained. The local fixture exercises the real reaction component against a local-only mock channel.

Validation: 12 viewport/mode combinations across 320,390,768,844,1280,1920 widths, plus CPU seat and disconnected reaction cases; card play remains reachable. These are local browser checks, not production matches or physical touch-device proof.

## Explicit mat rarities

Collection 01 contains 1 Common, 3 Rare, 2 Super Rare (internal Epic), 5 Legendary and 9 Mythical character mats. Defaults are Common. Fifteen shop mats cost 140 / 180 / 200 / 280 matching-rarity shards for Rare / Super Rare / Legendary / Mythical. Five story rewards cost no shards, regardless of rarity. Mat rarity is catalog metadata independent of future fighter rarity changes; both quote and debit read the mat catalog.

## Media delivery

All 20 character mats and five default venues have AVIF sources and WebP fallbacks in a versioned `assets/player-mats/v4` directory. The catalog still exposes WebP asset IDs for compatibility. Native `<picture>` sources select the supported format before requesting an image. The battle uses one picture source per distinct background, with no pictures or SVG crops inside the lanes.

The collection uses 640px thumbnails instead of full wallpapers. Character corner cutouts are 256px wide with lossless alpha and preserved proportions; full-size fighter assets remain unchanged elsewhere. Full character wallpapers keep their 1536×1024 geometry. Gallery loading remains lazy, while active battlefield art loads immediately. Unused Hooper concepts and v3 masters are archived outside the deployable public directory.

Rebuild from preserved approved exports using `scripts/optimize-player-mats.mts` from the frontend directory. Pass the masters directory and report path. `MAT_SHARP_MODULE` may point to a specific Sharp installation; the release uses Sharp 0.35.5 / libvips 8.18.7 for AVIF, quality 55, effort 7, 4:4:4 chroma. Full WebP fallbacks use quality 78 and effort 6; 640px thumbnails use quality 76, and corners use quality 82 and alpha quality 100. The report records dimensions, byte sizes, checksums and pixel-error metrics. This is lossy delivery optimization; approved masters are preserved unchanged.

Run `pnpm --filter @workspace/squabblemon test:player-mat-media` for image contracts/budgets. `node e2e/verify-mat-media.mjs` checks cold image requests, retina thumbnails, per-scene request reuse and native WebP fallback with an unsupported preferred MIME type and recovery from a failed AVIF decode. It does not emulate a physical iPad or claim Safari device coverage.

Measured cold-cache local browser image payload for the gallery fell from 11,493,688 to 1,717,651 bytes (85.06%). Full mat art files are 54.04% smaller in the preferred AVIF format; transparent corner images are 93.36% smaller than their full fighter sources. The tested PvP pairing uses 495,766 bytes for two scenes plus two cutouts. Unchanged card and effect images remain part of the larger match payload; these percentages do not describe all battle downloads.

The optimized release passed two asset contract/budget tests and seven media browser cases, including DPR 3 thumbnails, default portrait selection, unsupported-format fallback and failed-decode recovery. All 20 mats were rechecked in phone PvP and desktop training (40 cases), alongside the six-viewport lane/emote matrix. Approved source exports remain outside the public deployment directory.

## Continuous-background refinement

Local follow-up to the published 6b839b98 release: remove per-lane artwork and floating character stickers, center both source images at the district score row, clip the rival to the upper half and the player to the lower half, and reuse the clean-scene pairing in the Stylist. Training and identical mat pairings render one full scene. No acquisition rules, rarity prices, gameplay or emote behavior changed.

The continuous backgrounds and Stylist pairing preview use a 24% neutral black overlay on scenery only. Cards, district illustrations, scores and controls retain their original brightness. The opacity is controlled by `--mat-dim` in player-mats.css; gallery thumbnails retain the original illustration brightness.

## Phone framing

Portrait phones up to 600px wide frame landscape signature art around the playable field instead of scaling it to the entire screen, header and hand included. The scene height is capped at 1.45 times the field width, with proportional `object-fit: cover` sizing. On portrait phones, rival scenery starts at the true top edge and player scenery ends at the true bottom edge, behind the hand and action button. Both scenes retain the same scale; their reveal masks meet at the district score row. A single scene centers on the visible field. Scale and outer-edge anchoring stay fixed during field scrolling, while the split follows the lanes.

At 390×844, the distinct-mat PvP fixture shows about 49% of the source width instead of 28%, roughly 74% more scenery across the screen. Soft inner-edge masks blend toward the middle without pulling either PvP scene away from its outer edge. The approved 24% shade remains. Defaults with portrait artwork, desktop, tablet and landscape framing are unchanged. No extra images or duplicated scenery are introduced.

Local verification: 12 viewport/mode cases cover framing, proportional image sizing, split alignment, stable scale during scroll, card play and reaction controls. Frontend TypeScript, 76 focused Battle tests, the production build and configured bundle budgets pass. Browser captures are fixtures, not physical-device or live multiplayer proof.

## Lane surface refinement

District lanes use an additional 18% neutral charcoal fill under their existing state gradients. This increases separation from the scenery without reducing the opacity of cards, scores or district artwork. The fill is retained for neutral, controlled, selected and hovered lanes; mat shade and mobile edge anchoring are unchanged.

## Unified Style store refinement

The mat store now lives inside Style, with immediate catalog browsing and two persistent category links: Player mats and Character styles. Signature artwork, rarity and prices are visible on each card. The equipped mat is accessible above the filters. Buying and equipping remain separate explicit actions; existing server-authoritative prices, receipts, Story ownership and character-style requirements are preserved. Mat shopping does not require owning its fighter.

Local validation covers five viewport flows (320×568, 390×844, 768×1024, 844×390, 1280×800), preview/body scrolling, persistent actions, focus return, exact shard spending, equip/reload, Story locks, existing Story clears, category switching, saved filters, recovery after a lost purchase reply, insufficient funds and the legacy redirect. The Express Style entry and character-detail return route are also checked. Review captures use isolated components and mocked API transport with the real purchase planner; they are not production transactions or physical-device proof.
