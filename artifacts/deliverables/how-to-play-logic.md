# Squabblemon — game logic and How to Play layout

September 17, 2026. This describes the current implementation. No combat, reward, or purchase rules were changed to create the guide.

## The player loop

Rookie Road → receive the 17-card foundation → build seven unique owned characters → finish practice → claim the welcome reward → play story or practice → earn resources → recruit, pull, or train → revise the crew.

| System | How it currently works |
| --- | --- |
| Characters | Each has a Motion cost, base Power, ability, type, fixed rarity, and three move upgrades. Mixing crews and types is allowed. |
| Crew | Seven unique owned characters. Normal opening hand: five; one additional card is drawn each later round while the deck has cards. |
| Battle | Six rounds; one player card or pass per round, followed by the opponent. Win at least two of three districts by Power at the finish. If neither player owns two districts, draw. |
| Motion | Start at 2. Later rounds: round number plus at most 1 unspent Motion carried over; cap 6. Story modifiers can change this. |
| SQUABBLE | Once per match, double a played card’s base Power. The Motion cost still applies; ability effects are separate. |
| Character growth | Participating owned cards earn 30 / 25 / 20 XP for a win / draw / loss. Level 10 cap at 4,500 cumulative XP. Total XP for level L is 50 × L × (L − 1). |
| Coaching | Reach levels 2 / 5 / 8, then pay 150 / 400 / 900 Clout for the next move tier in sequence. Level alone does not purchase coaching. Bonuses depend on successful base ability conditions. |
| Training | 100 Clout for 100 character XP or 225 Clout for 250 XP. Near-cap training is charged proportionally. |
| Finishes | Tagged: 80 Style Shards. Chrome: 140 Style Shards. Own the character to craft/equip. Cosmetic only. |
| Targeted recruits | Choose an unowned Common for 400 Clout. |
| Packs | One ticket or 200 Clout; three reward slots, not three guaranteed characters. |

## Pack anatomy

1. **Character slot:** guaranteed missing character while the pool is incomplete. Roll rarity within the missing pool; if that rarity has no missing characters, select uniformly among all remaining missing characters. Full pool becomes 25 duplicate shards.
2. **Bonus slot:** 45% character, 30% shards (20 or 35), 20% Clout (75 or 125), 5% style, before the style guarantee.
3. **Resource slot:** 70% shards (15, 25, or 40), 30% Clout (50 or 100).

Full-pool card-roll rarity weights: Common 60%, Uncommon 25%, Rare 12%, Super Rare 2%, Legendary 0.8%, Mythical 0.2%. These are conditional card-roll weights, not whole-pack odds. Slot-one effective odds change with the collection.

Duplicate characters become 25 Style Shards. After nine openings without a style, the tenth forces an unowned cosmetic in slot two. A style resets the counter. After all styles are owned, pity ends and the normal 5% style outcome becomes 50 shards. There is no Legendary/Mythical rarity pity. Pulling a style does not grant its character.

## Match rewards

| Outcome | Clout | Profile XP | Rep | XP per participating owned card |
| --- | ---: | ---: | ---: | ---: |
| Win | 40 | 50 | 8 | 30 |
| Draw | 30 | 35 | 4 | 25 |
| Loss | 20 | 25 | 2 | 20 |

Guest/offline practice has no saved account payouts. Normal match payouts do not include tickets. Bounties, collection milestones, and authored story rewards can add rewards; ready claims must be collected. The welcome grant includes 250 Clout, one ticket, 100 profile XP, and 5 Rep.

## Page layout

Public route: `/how-to-play`, relative to the app base path. Linked from public entry and the in-game profile/settings page. It is loaded separately from the entry screen.

1. **Hero:** Hooper, Rastamon, and OG Uncle in front of the corner-store court. Seven-card / three-district / six-round / two-to-win summary.
2. **The loop:** illustrated deck, neighborhood map, championship chain, and foil pack.
3. **Characters:** six selectable character examples using live catalog stats, abilities, rarity, and art; the seven Rookie Road core cards below.
4. **Battle:** a scored example showing how two district wins beat a higher opposing total; Motion, turn flow, SQUABBLE, freeze, silence, and ties.
5. **Gacha:** pack cost, all three slots, duplicates, cosmetic pity, changing effective odds, six illustrated rarity tiers, and direct recruitment.
6. **Upgrades:** separate rarity, gameplay progression, and cosmetics; interactive level preview using the actual XP function and Young Bull’s authored upgrades.
7. **Rewards:** currencies and the current saved-match payout table.
8. **First session:** Dr. Fade and a four-step checklist, with links to the account journey and guest practice.
9. **FAQ:** common misunderstandings about rarity, duplicates, XP, guest play, and stat growth.

Existing artwork only. Responsive layouts at desktop and phone widths; reduced-motion support, keyboard controls, semantic headings, native disclosures, and a horizontally scrollable chapter menu.

## Decisions for the next game-logic pass

These are design observations and proposals, not active rules or additional implemented systems:

- **What does “grading” mean?** This guide covers the existing card upgrade system. No condition grades such as Mint or Gem Mint exist. If collectible grading is wanted, keep it a separate cosmetic/collection property and decide how grades are earned before adding any reroll costs.
- **Rarity versus acquisition:** the foundation includes Mythical OG Uncle; Collection Road awards Legendary Techbro Rich. That is compatible with broad access to gameplay, but rarity is not a reliable measure of acquisition scarcity. Decide whether future chase rewards should primarily be cosmetic variants.
- **Collection completion:** the first pack slot guarantees a new character, so each opening fills at least one missing character until the pool is complete. Character acquisition is finite rather than an endless duplicate hunt. Plan the long-term loop around mastery, new content, and optional cosmetics.
- **Training pace:** all three coaching tiers cost 1,450 Clout, in addition to any purchased XP. Playtest the time to reach levels 5 and 8 before changing these costs. Wins pay 40 Clout and only participating cards earn XP.
- **Trading:** there is no player-to-player card trading system covered by this guide. The Trading Post is a resource shop.

## Source of truth

- Characters, rarities, and starter foundation: `lib/squabblemon-engine/src/data.ts` and `commonCards.ts`.
- Battle rules: `lib/squabblemon-engine/src/gameEngine.ts`.
- Level curve and coaching snapshots: `cardProgression.ts` and `abilityUpgrades.ts` in the shared engine.
- Shop prices and match wallet payouts: `lib/squabblemon-engine/src/economy.ts`.
- Pack generation and collection milestones: `artifacts/api-server/src/lib/collectionEconomy.ts`.
- Character XP and welcome rewards: `artifacts/api-server/src/lib/cardProgression.ts` and `playerRewardTransactions.ts`.

## Validation

- Frontend TypeScript check passed.
- Production frontend build passed in `dist/guide-check`; no deployment performed.
- Entry bundle check passed: 193,428 bytes against the 475 KiB limit.
- Browser checks passed at 1440×1000, 390×844, and 320×740: chapter navigation, six character selections, level milestones 1/2/5/8/10, keyboard slider, disclosures, all images, no page overflow, and no uncaught browser errors.
- Public entry → guide → guest practice navigation passed.
- Evidence: `how-to-play-verification.json` and full-page/viewport captures under `screenshots/how-to-play-*`.
