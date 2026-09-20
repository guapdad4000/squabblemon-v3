# Element deck leaders — September 20, 2026

This release upgrades existing characters. It adds no characters and keeps every card, training, variant, cosmetic and saved-deck ID.

## Cards

| Card | Type / rarity | Motion / Hands | Added or expanded ability |
| --- | --- | --- | --- |
| Church Auntie | Light / Epic | 3 / 4 | While on board, the first protection block on a friendly Light character each round grants that target +2 Hands. Covered still grants an ally +2 and protection on reveal. |
| Night Shift Medic | Light / Epic | 3 / 4 | All Clear removes Freeze, Silence, Burn, Weaken and Lock from every other local ally. While on board, the first friendly Light character actually cleansed each round gains +2 Hands. |
| Pirate Radio DJ | Electric / Epic | 3 / 2 | While on board, the second Electric character played that round gains +1 Hand and refunds 1 Motion. Keeps both its reveal buff and in-hand Electric bond. |
| Promoter | Air / Epic | 3 / 3 | While on board, the first friendly Air unit to move each round gains +2 Hands. Keeps the hand reveal and conditional discount. |
| Gamer | Dark / Epic | 3 / 3 | While on board, the first newly applied Silence or Weaken each round gives the weakest friendly Dark unit +2 Hands. Keeps City Tour's reveal. |
| Counter | Dark / Mythical | 4 / 2 | While on board, once per round a newly applied Silence or Weaken protects the weakest unprotected friendly Dark unit. Keeps its own protection and cost-based reveal gain. |
| Captain Jigga | Air / Mythical | 5 / 4 | Each Steward also gives the weakest other friendly Air character in its district +1 Hand. This excludes Jigga and tokens, so existing Air teammates earn the benefit. Both Stewards keep their individual art and distinct enemy attacks. |
| Ashlee | **Plant** / Mythical | 5 / 3 | If Plant allies occupy all three districts after Ashlee arrives, the weakest Plant ally in each gains +1 Hand. Keeps Guyana, local crew buffs and enemy pressure. Guyana remains Earth. |
| Last Train Conductor | Water / Mythical | 4 / 3 | A successfully moved passenger is also cleansed. Water passengers gain +4 Hands total; others keep +3. Lock and County Jail still prevent the ride. |
| Foodz | Light / Mythical | 3 / 2 | Board cleanse recognizes all five debuffs. Its weakest Light target needing that cleanse gains an extra +1, alongside the existing district buffs. Healthy allies never earn the recovery bonus. |

Epic is displayed as **Super Rare** by the game's existing rarity treatment. Church Auntie remains in the free rookie foundation. Existing owners automatically use the new catalog definitions.

BUDDY retains the affordable Dark Mythical-hunter kit released previously; FOLKS and the existing Fire deck are unchanged. TRON retains its crew buff and refund. New Plant, Earth and Poison characters, a Water Epic, and an Electric Mythical are outside this release.

## Resolution rules

- Reactions require an active leader on the board. Freeze, Silence or Weaken disables a leader; merely keeping it in hand does not activate the board ability.
- Each leader ability has one shared use per side per round, including Scammer copies. Independent leaders can combine, such as Medic and Auntie or Gamer and Counter.
- Bonuses settle after the triggering action and its training upgrades, with their own authoritative battle event. A defender's shield reward cannot make a blocked attack earn successful-hit upgrades.
- Successful movement includes district rides and forced movement. Failed movement does not consume Promoter's reward.
- Electric counts actual character plays across the whole round. Supports and summoned tokens do not count. DJ may itself be the second Electric play, but entering later cannot refund an earlier play. Motion stays capped at 9.
- Dark triggers require a transition from not Silenced/Weakened to that status. Reapplying an existing status, blocked attempts, Freeze alone, or a knockout with no surviving Silence target gives no reward.
- Cleansing preserves positive statuses. Natural expiration and restoring negative Hands without clearing a debuff do not trigger Medic.
- Per-round state survives JSON saves and is included in replay snapshots. AI search resolves the same effects when presentation events are suppressed.

## Verification

- 400 gameplay, card-art, battle-rendering, replay and balance tests plus 3 bundle checks.
- 67 focused Light and element-deck checks are part of the normal test suite and production release gate.
- 134 API/database tests passed against an owned in-memory database, including preservation of old Rare receipts, owned copies, deck slots, training, cosmetics and wallet balances.
- Browser checks cover all ten updated cards at 320, 390 and 1280 pixels: portraits, Epic frames, element labels, expanded ability text and no page errors.
- Netlify production build validates types, both multiplayer seats, the API bundle and public entry size.

For the reusable card preview, run `pnpm exec tsx e2e/serve-element-preview.ts` from `artifacts/squabblemon`, then `pnpm exec tsx e2e/verify-element-preview.ts` in another terminal. The preview is development-only and generates temporary harness files.
