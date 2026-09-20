# Featured and Mythical character collections

Published September 20, 2026: https://squabble.today/game/style

Deployment: 6aafb1ac42f408e0625f46da

## This rollout

14 new collections, 56 original sticker designs, and 15 available collections including KYLE. Every new collection has a four-sticker atlas, an included animated character banner, an optional Silver Lining banner finish, a card scene, and an unlock presentation. Existing canonical portraits, environments, and special animations are reused.

Featured newcomers: STOCKZ, Ashlee, Captain Jigga, Church Auntie.

Additional Mythicals: GUAP, Simmy, Foodz, Yasuke, John Henry, Leroy, OG Uncle, Last Train Conductor, Midnight Mayor, Block Party Titan.

Counter remains excluded because there is no approved character portrait. Remaining Legendaries are the next rollout; Epic collections are not part of this release.

## Player flow

Open the Bag, Collection, or Market and select Character collections. Search or filter the catalogue, choose an owned fighter, then unlock and equip cosmetics.

- Four-sticker pack: 100 Style Shards.
- Signature card scene: 60 Style Shards.
- Silver Lining banner finish: 120 Style Shards.
- Base character banner: included with character ownership.
- Mix up to three owned stickers from different packs on any available owned character banner.
- Each card scene keeps independent ownership and equipment. Cosmetics do not alter combat strength.

## Art production

Generated with the built-in image generator using canonical character artwork as the reference. No local API key was used. Each character uses one transparent 1024×1024 WebP atlas with four padded cells. OG Uncle and Block Party Titan received corrective passes before export.

Exact prompts, generation sources, correction prompts, and crop information: [prompts.json](E:/Apps/code/minimax/Squabblemon/output/imagegen/character-packs/prompts.json).

Master images: E:/Apps/code/minimax/Squabblemon/output/imagegen/character-packs/

Runtime assets: E:/Apps/code/minimax/Squabblemon/artifacts/squabblemon/public/assets/cosmetics/<character>/stickers-v1.webp

Export script: E:/Apps/code/minimax/Squabblemon/scripts/export-character-packs.mjs

## Verification

- Shared, frontend, and API TypeScript release checks passed.
- Seven asset/economy/persistence tests passed against the isolated local test database.
- New collection browser regression passed: filters/search, mixed stickers, ownership, reload persistence, mobile layouts, rarity copy, and reduced motion; no page errors.
- KYLE's nine existing browser checks passed, including retry-safe purchase recovery, all cosmetics, mobile and gacha reveal.
- Release gates: 9 summon regressions, 19 multiplayer/KYLE checks, 6 cosmetic/asset checks passed. The production build intentionally skips the DB-mutating test, which passed on the isolated database.
- Live asset, build, API health and authentication results: [production verification](E:/Apps/code/minimax/Squabblemon/screenshots/character-packs/production-verification.json).

Browser evidence: E:/Apps/code/minimax/Squabblemon/screenshots/character-packs/

Purchasing and persistence were tested locally against the isolated database, not with live player purchases.

## Canonical GitHub reconciliation
The 14 additional packs and collection browser are preserved in the GitHub checkout alongside Dr. Fade, the guided tutorial, and the shared PvP battle. The collection browser verification now launches its own local server and uses mocked player HTTP; it has no direct database connection. Asset and cosmetic ownership rules are release gates.
