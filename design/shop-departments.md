# Shop department design and ownership

Recruit, Training, Fade Market and the Style Closet each own one kind of decision. Their prices, gameplay effects and server endpoints retain the existing economy rules.

## Player-facing layout

- **Training:** three physical session passes, a large selected fighter, a cream coaching ticket with the actual XP/move quote, and one green Train action. The existing gym, Dr. Fade art and animated workout sprites remain. The shard/ticket wallet row, unrelated offers, long guide and extra footer actions are removed.
- **Fade Market:** a richly illustrated neighborhood corner-store counter with mint/red neon, stocked side shelves, warm lights, wood cubbies and clipped handwritten price tags. Clout, Showcase and Reactions remain distinct aisles. Daily Clout and real payment products keep their current receipts; a compact deck-slot service lives at the register. Cosmetic shard/style showcases point to the Closet.
- **Style Closet:** Card finishes sits alongside Player mats and Character styles. The counter has real Tagged/Chrome card previews, the rarity shard wallet, exact matching/Universal shard costs, and a cream stylist receipt with one green unlock action.
- **Recruit:** Neighborhood Recruit is a permanent third sheet beside the original Street Pack and current weekly feature. It preserves the existing choose-one-unowned-Common offer for 400 Clout, with no random roll or change to pack odds. Kumite-exclusive cards remain unavailable. The Recruit paper tab uses the approved fist emblem instead of the retired foil-pack icon.

## Routes and recovery

`src/lib/shopDestination.ts` maps the original purchase intent to its current owner:

| Intent | Current destination |
| --- | --- |
| Training / intensive / moves | `/game/shop?view=training&item=…&card=…` |
| Neighborhood Recruit | `/game/shop?view=packs&banner=neighborhood&card=…` |
| Extra Gang Slot | `/game/shop?view=corner&item=deck-slot` |
| Tagged / Chrome | `/game/style?view=finishes&item=…&card=…` |
| Player mats / character cosmetics / reactions | Existing Closet/workbench/reaction destinations |

Explicit old item links redirect to the current counter. Choosing a department clears the previous department's item. Players can browse another counter while its foreign purchase remains pending; that view blocks a new purchase and offers the original recovery link. No request changes item, card or idempotency key during recovery.

Purchase controls reread the account journal before reserving a new intent. Account/view changes leave unresolved receipts recoverable and suppress stale wallet, notification and audio updates. Confirmed responses clear only their own journal key. Legacy saved ticket purchases have a recovery-only action in Recruit; it never creates a fresh ticket offer. Pack replies persist only their original request identity and cannot overwrite a newer pending request or saved reveal. Late replies after an account change cannot update the current wallet or replay audio/media. All real grants still come from `/api/player/shop/purchases`; cash checkout and tax/refund/eligibility handling retain their existing server contract.

## Responsive surfaces and native interaction

The Market merchandise counter explicitly rejects the shared cover-sized chalkboard panel texture. Its transparent rail exposes the illustrated room. Phone shelves show two complete products with smaller shelf borders, daily badges and price tags. The Closet sticker uses a slim single-line print with a 44 px touch target. Container queries retain two/three products plus a hint at tablet widths and four complete products on wide desktops. Eight widths from 320 to 1920 pass with every product reachable and no document overflow; the final compact phone labels also pass at 320/390/430/540 px.

The game/practice lifecycle scopes native selection, image/link drag and browser context-menu protection to gameplay, including portalled dialogs. Inputs, editable text, deliberate room-code copy fallbacks, card right-click inspection and explicit puzzle drag handles remain usable. Route and immersive viewport boundaries contain X overflow while preserving child rails and ordinary vertical gestures. Gym/Safehouse iframe documents install equivalent native-default protection without pointer/touch/wheel interception. Evidence: `/home/falcon/Documents/New project 9/output/game-surface-policy/README.md` and `/home/falcon/Documents/New project 9/output/fade-market-responsive-v3/README.md`.

## New artwork

Built-in imagegen produced one new 1672×941 corner-store interior. The delivery asset is `artifacts/squabblemon/public/assets/market/corner-v2/interior.webp` (256,546 bytes). It replaces the old layered backdrop rather than loading both scenes. The PNG master is archived outside public delivery. The exact prompt, reference/output hashes and encoding provenance are in `design/media/fade-market-corner-v2/generation.json`. Neon lettering and functional controls remain live UI; the image contains the setting and store objects. New emblems use fists.

## Verification

Frontend typecheck, production build (including bundle budgets and CSS invalidation/panel guards), and the 20 focused routing/journal/finish/recovery source checks pass. The permanent Recruit captures wait for finite entrance animations before recording the settled card print.

Current local evidence directories:

- `/home/falcon/Documents/New project 9/output/fade-market-polish/`: three responsive market flows, daily/cash receipt handling, same-key deck retry, foreign intent/cap behavior and three delayed-response scenarios.
- `/home/falcon/Documents/New project 9/output/training-club-review/`: desktop/phone layout, original workout animation, authoritative mocked HTTP purchases/retries, XP-cap quotes and reduced motion.
- `/home/falcon/Documents/New project 9/output/shop-counter-relocation/finishes/`: source/quote/recovery tests, four viewport finish flows and four Training lifecycle scenarios.
- `/home/falcon/Documents/New project 9/output/shop-counter-relocation/finish-polish/`: final paper/green finish-counter desktop/phone captures.
- `/home/falcon/Documents/New project 9/output/shop-counter-relocation/recruit/`: permanent banner rotation, legacy link migration, actual card right-click details and one-grant same-key purchase recovery.
- `/home/falcon/Documents/New project 9/output/shop-counter-relocation/purchase-recovery/`:12 pack-journal source checks, four legacy-ticket render/recovery checks, seven ticket/pack lifetime flows and two same-account stale-response cases.

These are actual local components with deterministic HTTP fixtures, not live purchases or production/device proof. No new backend rates, prices or gameplay rules are introduced. Verification completed locally before publication and does not itself confirm a production deployment.
