# Friends beta QA update

Published September 17, 2026 at https://squabble.today. Deployment: [6aac71d8acf6353cc5d9b680](https://app.netlify.com/projects/squabblemon-triple-lane/deploys/6aac71d8acf6353cc5d9b680).

## Changes

- Fixed match completion rejecting PostgreSQL JSONB district snapshots when property order changed. The exact values and allowed fields are still validated. This fixes the reported story save 409 without trusting client-reported wins.
- Street Packs now contain five distinct card pulls plus one bonus for the existing 200 Clout or one-ticket price. The first two pulls each guarantee an unowned card while any remain. Owned pulls convert to 25 Style Shards. Bonus odds: 70% shards, 25% Clout, 5% cosmetic style, with the existing tenth-pack style guarantee. Receipts retain their version and retries never reroll.
- Added 20 illustrated, playable, trainable characters: 10 Common, 5 Rare, 5 Mythical. The collection now contains 65 cards. Existing accounts and saved crews are preserved; new characters enter the pack pool and the new Commons can be recruited through the existing shop.
- Replaced the proposed Neon Dragon, Rooftop Runner, and Queen of Echoes with Leroy (Mythical), OG Dominican (Rare), and Big Zoey (Mythical), respectively, before release.
- Promoter now wears an unbuttoned shirt, aviators, skinny pants, and carries bottles and a clipboard. Wifey wears a floral sundress and sandals. Updated portrait hashes prevent stale cached images.
- Rastamon now uses the visually verified Vine Reaper clip (char11); Snow Bunny uses the visually verified Ice Queen clip (char10).
- Removed unused preload hints and reduced safehouse environment blur to fit the renderer's supported sample budget. The extension-origin listener warnings in the submitted log are outside the game.

## Roster

Common: Bodega Cat, Crossing Guard, Laundromat Regular, Corner Busker, Corner Coach, Night Cashier, Dog Walker, Mural Apprentice, Chess Regular, Rooftop Gardener.

Rare: Pirate Radio DJ, Dance Circle Captain, Night Shift Medic, Subway Magician, OG Dominican.

Mythical: Last Train Conductor, Midnight Mayor, Big Zoey, Leroy, Block Party Titan.

All new cards have authored reveal abilities and three coaching tiers. Wave 5 now supplies dedicated video cutscenes for all 20 expansion cards, with procedural effects retained as the fallback. See `../squabblemon/reference/special-moves.md` for the complete mapping.

## Verification

- All 20 abilities verified for both players, including missed conditions, freeze, silence, protection, and blocked movement.
- Complete matches with expansion crews replay identically through authoritative reward verification.
- All catalog portraits pass dimensions, useful alpha transparency, uniqueness, and cache revision validation.
- Isolated database/HTTP check: a legal story win saves, unlocks Blue Side Pressure, and a retry returns the same reward without crediting twice. The fixture uses a fully trained rookie crew.
- Pack boundary odds, two-card collection protection, duplicate conversion totals, near-complete collections, style pity, six persisted rewards, and concurrent retry charging verified.
- Existing story transaction and standard/multiplayer engine regression checks pass. Database test suites run sequentially because the embedded test database does not isolate concurrent wire-protocol sessions reliably.
- Browser check: 65-card collection, Leroy inspector with the correct art/ability, and all six preview-pack rewards render. No warning/error messages were captured in the pack screen.
- Production release type checks, API bundle smoke checks, and client build passed. Entry JavaScript remains 189.8 KiB. Live health returns 200; unsigned player and multiplayer requests return 401. All 22 updated/new portraits match their verified local content hashes, and live HTML matches this release.

Artwork prompts, original generated PNGs, and final asset paths are recorded in `friends-beta-art.json`. Originals remain intact.

## Wave 5 follow-up

All 20 dedicated expansion videos are now published. See [Wave 5 release and verification](wave5-special-moves.md). The original QA deployment above remains the record for the gameplay and artwork changes.
