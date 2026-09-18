# 10-Ticket Ten-Pull — Gacha Upgrade Spec

**Ship target:** Squabblemon: City Never Sleeps — Gacha + Story reward loop
**Audience:** Engineering, design
**Status:** Implemented in engine + api-server + client.

## TL;DR

- The pack gym now offers **two CTAs**: 1 ticket (single) and 10 tickets (ten-pull).
- The ten-pull is an **upgraded** experience — triple-combo punch, 30 hits, bigger K.O., and a 6×10 reveal grid with a guaranteed Rare+ highlight.
- **Every major story node** (chapter finale reward beat) grants **10 Street Pack tickets** — exactly one ten-pull.
- Each pack opening still has its own **pity progress**; a 10-pull will roll 10 packs with one shared pity so at least one featured variant or 50-shard bonus is guaranteed.

## Why

The previous "1 ticket = 1 pack" flow gave players nothing to save for, and the
punching-bag animation only had one intensity. Major story nodes granted a
single ticket that felt under-tuned for the moment the player earned it. This
change turns each chapter finale into an upgraded reward: one payout unlocks
the ten-pull, which doubles down on the punching-bag presentation and hands
back 60 cards.

## Defaults I picked (flagged, easy to flip)

- **Cost:** flat 10 tickets (or 1,800 Clout) — no bulk discount. Discount
  can be added by editing `STREET_PACK_TEN_PULL_CONFIG.ticketCost` in
  `artifacts/api-server/src/lib/collectionEconomy.ts`.
- **Major story node = chapter finale reward beat.** Battle nodes still grant
  1 ticket on 3-star clears (the existing "3 stars → ticket" loop is kept
  intact). Finales are: `block-crowned` (Ch1), `red-tapes-let-her-grieve`
  (Ch2), `og-uncles-visit` (Ch3), `the-real-receipts` (Ch4), `the-family-blessed`
  (Ch5), `function-after-hours` (Ch6), `the-block-changes-hands` (Ch7),
  `crown-community-meal` (Ch8).
- **Guaranteed Rare+** in every 10-pull haul. Pity already triggers at
  `pityLimit - 1 = 9`, so the 10th inner pack forces a featured variant. As
  belt-and-suspenders, `generateStreetTenPull` re-rolls one Rare+ if no Rare+
  drops naturally across the 10 inner packs.
- **Hit cap:** single = 12 hits, ten-pull = 30 hits (3 per click).
- **Auto-rush tempo:** single = 260ms, ten-pull = 180ms (faster dismantle feel).

## Engine changes

`lib/squabblemon-engine/src/story.ts`
- New constant `TICKETS_PER_MAJOR_STORY_NODE = 10`.
- `block-crowned` reward amount bumped from 1 → 10.

`lib/squabblemon-engine/src/seasonChapters.ts`
- New `majorNodeTickets()` helper reads `TICKETS_PER_MAJOR_STORY_NODE` so
  every chapter finale reward reads from the same knob.
- Chapter 2 reward-kind nodes (runtime augmentation) now use
  `majorNodeTickets()` instead of hard-coding amount 1.
- Chapter 8 finale `crown-community-meal` switched from inline `{ amount: 1 }`
  to `majorNodeTickets()`.
- Chapter finales 3–7 (`og-uncles-visit`, `the-real-receipts`,
  `the-family-blessed`, `function-after-hours`, `the-block-changes-hands`)
  now include a 10-ticket reward alongside the existing chapter-key.

## API server changes

`artifacts/api-server/src/lib/collectionEconomy.ts`
- New `STREET_PACK_TEN_PULL_CONFIG = { ticketCost: 10, softCurrencyCost: 1800,
  rewardsPerPull: 60, oddsVersion: 'street-pack-ten-v1', pullCount: 10,
  rarePityBonusPerPull: 1 }`.
- New `ALLOWED_PULL_COUNTS = [1, 10]`, `isPullCount`, `tierForPullCount`
  helpers.
- New `generateStreetTenPull()` that chains 10 `generateStreetPack()` calls,
  threads pity between them, and force-rolls a Rare+ if no Rare+ drops
  naturally (the highlight that the UI badged as GUARANTEED).

`artifacts/api-server/src/lib/collectionTransactions.ts`
- `openStreetPackForPlayer` now accepts `pullCount` (1 or 10). For 10 it:
  - Charges 10 tickets or 1,800 Clout.
  - Routes through `generateStreetTenPull`.
  - Persists ONE opening row with 60 rewards and the ten-pull odds version.
  - Emits a clearer 400 message when the player can't afford a ten-pull.

`artifacts/api-server/src/lib/playerState.ts`
- `serializePackOpening` now derives `pullCount` from the persisted
  `oddsVersion` (no DB migration): `street-pack-ten-v1` → 10, else → 1.
- `PlayerBootstrap` now exposes `tenPullConfig` alongside the existing
  `packConfig`.

`artifacts/api-server/src/lib/storyTransactions.test.ts`
- `block-crowned` final test updated to assert `profile.packTickets === 10`.

## API spec + generated types

`lib/api-spec/openapi.yaml`
- `PackConfig` left alone (single-pack config still ships).
- New `TenPullConfig` schema (id, name, oddsVersion, pullCount, ticketCost,
  softCurrencyCost, rewardsPerPull, rarePityBonusPerPull).
- `PlayerBootstrap` now `required`s `tenPullConfig`.
- `PackOpening` gains `pullCount: integer`.
- `OpenPackInput` gains optional `pullCount: integer 1–10` (default 1).

`lib/api-client-react/src/generated/api.schemas.ts` and matching `dist/`:
- Added `TenPullConfig`, `pullCount` on `PackOpening`, optional `pullCount`
  on `OpenPackInput`, `tenPullConfig: TenPullConfig` on `PlayerBootstrap`.

`lib/api-zod/src/generated/types/{tenPullConfig.ts, packOpening.ts, openPackInput.ts, playerBootstrap.ts, index.ts}` and matching `dist/`:
- Mirrored the above changes.

> Note: this machine has no node on PATH, so the files were patched by hand
> to mirror what orval would generate. Run `pnpm orval --config
> lib/api-spec/orval.config.ts` from a machine with node to regenerate
> cleanly.

## Client changes

`artifacts/squabblemon/src/pages/game/Shop.tsx`
- New `PullSize = 1 | 10` and `HITS_PER_PULL` / `HITS_PER_CLICK` knobs.
- New `Phase` values: `tenPunching` (between `punching` and the knockout
  phases) and `tenKnockout` (K.O. with the upgraded overlay).
- `PackGym` now renders **two CTAs**: 1-ticket single and 10-ticket ten-pull.
- The ten-pull CTA carries an `UPGRADED · RARE+ GUARANTEED` tag and a
  `.studio-action--ten` style (gold border, glow shadow).
- Hit cap rings the user up to 30 with three hits per click; auto-rush
  tempo drops to 180ms.
- `indexOfRarestReward` finds the highest-rarity reward in the haul so it
  can be tagged "GUARANTEED RARE+".
- Reveal dialog: 6×10 grid layout with `.gym-results__item--rare` outline +
  `.gacha-results__badge` tag on the highlighted reward.

`artifacts/squabblemon/src/pages/game/Story.tsx`
- Story reward label for `pack-ticket` amount:10 now reads
  "10× Street Pack Tickets · One upgraded ten-pull" so the player reads the
  bundle as the ten-pull CTA.

`artifacts/squabblemon/src/styles/gacha-stage.css`
- New selectors under `data-pull-size="ten"`:
  - `.gacha-stage__payments` (single + ten CTA stack).
  - `.studio-action--ten` (gold-edged, glow).
  - `.gacha-stage__payment-tag` ("UPGRADED · RARE+ GUARANTEED").
  - Combo HUD scales up + golden gradient text while ten-pulling.
  - New `gacha-ten-pulse` keyframe gives each punch click a 320ms pop.
  - K.O. overlay stretches to the wider ten-pull layout and uses a gold
    gradient on the "K.O. ×10" headline.
- New `.gym-results__grid--ten` 6×10 grid (5 cols on tablet, 3 cols on phone,
  6 cols on landscape).
- New `.gym-results__item--rare` outline + dashed offset for the
  GUARANTEED reward.
- New `.gacha-results__badge` for the "GUARANTEED" tag.

`artifacts/squabblemon/src/lib/packJournal.ts`
- `PendingPackRequest` now persists `pullCount` so a mid-punch refresh /
  retry sends the same intent (1 or 10) the player originally tapped.

## Acceptance

- A new player who clears Chapter One `block-crowned` ends up with
  `packTickets += 10`. Story screen labels the reward "10× Street Pack
  Tickets · One upgraded ten-pull".
- The Pack Gym now shows two CTAs. The 10-ticket CTA is disabled if the
  player can't afford 10 tickets (or 1,800 Clout) and enabled otherwise.
- Tapping the 10-ticket CTA:
  - Deducts 10 tickets server-side, returns one opening with 60 rewards
    and `oddsVersion: street-pack-ten-v1`, `pullCount: 10`.
  - Drives the new punching phase: 30 hits, triple-combo per click, K.O.
    overlay upgraded, and the reveal dialog shows a 6×10 grid with the
    rarest reward badged "GUARANTEED RARE+".
- Every 10-pack haul contains at least one Rare+ card. Confirmed by
  `generateStreetTenPull`'s belt-and-suspenders reroll.
- Story 3-star battle clears still grant 1 ticket (loop unchanged). Only
  chapter-finale reward beats grant 10.