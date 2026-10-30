# The Anunaki Arrival — campaign and reward contract

The permanent campaign is `special-anunaki-arrival`: eight sequential chapters, 56 required nodes, 32 battles and eight clue puzzles. Every chapter has two dialogue scenes, four fights and one puzzle. All chapters use the established Story route, server completion, checkpoint/dialogue receipts, lazy chapter delivery and authored star objectives. Optional mastery is a reward objective and never a prerequisite for another chapter.

The premise: Cracked Head sells Captain Jigga a defective time machine. Jigga offers Yasuke a ride to his original time; RETURN sends them too far back, into the first Anunaki arrival. The campaign follows the repair, Caucus’s escape, a debt to the landing site and Yasuke’s choice to repair the breach before leaving. The ending returns them to the city with Cracked Head claiming the machine worked.

| Chapter | Stable ID | Story | Completion reward |
| --- | --- | --- | --- |
| 1 | anunaki-01-no-refunds | Utu’s landing field; discover the RETURN fault | Yakub mat |
| 2 | anunaki-02-tapped-in | Yakub’s lab; summons, weakening, tablet growth | Yakub |
| 3 | anunaki-03-instructions | Enki’s repairs and Nabu’s coordinates | Yakub stickers and four animated reactions |
| 4 | anunaki-04-something-got-out | Pursue Caucus safely; negotiate his help | Caucus Mountaineer |
| 5 | anunaki-05-divine-hands | Inanna’s arena and Enlil’s storm corridor | Three pack tickets |
| 6 | anunaki-06-life-has-a-price | Ereshkigal’s gate and Ninhursag’s restoration | Anu mat |
| 7 | anunaki-07-wrong-millennium | Stay to stabilize the damage; gate rehearsal | 500 Clout; raid training opens |
| 8 | anunaki-08-original-arrival | Hold the original arrival; return to the city | Anu; Standard raid opens |

## Twenty-four roadmap milestones

Each chapter contributes three steps: win two distinct local battles; finish the chapter (and all previous chapters); earn 10 of its 12 battle stars for optional mastery. The route contains eight mastery milestones, two player mats, three fighters, three earned deck covers, five sticker packs, six pack tickets and Clout. Yakub and Anu sticker packs also unlock their four animated reaction sets. Other signature packs remain cosmetic; they do not grant the banner fighter.

All 13 previous roadmap milestone IDs and `anunaki-event:arrival:<id>:v1` receipts remain valid. Previously granted rewards stay granted, regardless of the new requirements, and cannot be granted a second time. New accounts count this campaign’s 32 battle IDs and eight chapter IDs only; original Season One progress does not satisfy the roadmap. Duplicate owned permanent rewards award the existing 25-shard compensation once. Already-claimed retries return no new grant.

Server claims lock the player profile and save the permanent receipt, card/cosmetic ownership, tickets, currency and duplicate shards in one transaction. Client progress and reward amounts never authorize a claim.

## Explicit campaign economy

This campaign intentionally does not inherit the legacy per-node payout contract. Each of its 32 battles grants 75 Clout once; each chapter’s closing dialogue grants 100 Clout and one ticket once. That is **3,200 Clout and eight tickets** for campaign completion. The roadmap adds **1,650 Clout and six tickets**, including optional mastery. Total: **4,850 Clout and 14 tickets** before pack bonuses or monthly pull milestones.

Anunaki battle stars earn the eight optional roadmap rewards rather than an extra ticket for each perfect battle. Existing campaigns retain their existing payouts and perfect-clear ticket awards. Replay, retry, dialogue skip and puzzle skip use existing permanent receipts and cannot farm another payout.

Temporary story reinforcements teach all ten characters without granting seven banner-exclusive collectibles. They are once-only encounter allies, not permanent inventory grants. Every required interaction can be attempted with owned foundation cards and the temporary ally.

## Earned deck covers

Roadmap covers use `style:enki:deck-cover`, `style:inanna:deck-cover` and `style:nabu:deck-cover`; the Standard raid cover uses `anunaki-raid:cover`. Earned cover ownership is independent of the featured fighter. The existing cosmetic equip endpoint validates `settings.cosmetics.deckCoverId`, and the Deck Workbench selector applies it to all deck boxes. Selecting “Character cover” clears the override. A legacy cosmetic write that omits the new field preserves it.

## Delivery and verification

Authoring is in `lib/squabblemon-engine/src/storyAnunaki.ts`. Chapter identities are in `anunakiStoryIds.ts`; the season is registered in `storySeasons.ts`. The production browser receives one revisioned external JSON chapter on route intent. All 12 prepared story plates are used between maps, arrivals and closing scenes. There is no fake generated movie: the existing cinematic metadata remains valid for existing playback architecture while authored Story dialogue uses the dedicated plate.

The campaign is permanent. The Anunaki gacha calendar is separate and controlled by the banner rules; holding the release does not consume the campaign or its rewards.

## Boss raid presentation

Anu now uses the same battlefield, hand, formation inspection and action controls as Punch-On Patrol and Kumite through a native-rule presentation adapter. The shared top stage centers an animated boss over its illustrated arena, followed by animated enemy actors and the three districts. The complete visual hierarchy, animation contract and future power-up integration plan are in [shared-raid-cinema.md](shared-raid-cinema.md). New drawn chat reactions replace the previous still-motion versions without changing reward IDs or ownership.
