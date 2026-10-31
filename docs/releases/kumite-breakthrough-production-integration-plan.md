# Kumite Breakthrough: production integration supplement

Status: integration in progress, October 29, 2026. Isolated branch `codex/kumite-breakthrough-integration` starts from fetched `origin/main` `77f44c8b597a908202d5f65b8ecc293e4b47f5d6`. No push or deployment is implied by this document.

## Mandatory launch gate — user decision, October 29

No public launch, including CPU beta, restricted-pool exhibition, loaner-only entry or private player beta, until every current deck-legal collectible card is playable and usable. Today that is all 301 canonical definitions, plus the runtime tokens/summons their effects create. The current 45-card renderer is an internal development audition only.

The public Kumite entry is hidden, both direct routes redirect to the hub, and default room creation/service admission reject while locked. The DEV-only synthetic fixture uses an explicit internal renderer. URL parameters, account flags and local storage cannot open public entry.

Release requires every current canonical ID to have a concrete conversion and per-card activation, targeting/choices, rejected-input/no-charge, interaction, lifecycle, Last Stand, replay and presentation proof. Matching catalog/adapter/engine/room fingerprints and explicit launch approval are also required. Adding301 registry keys, completing all starter decks, or supplying a generic no-op fighter does not satisfy this gate. Any new card or changed effect invalidates older evidence.

The coverage worklist and audit are in `kumite-breakthrough-all-cards-launch-gate.md` and `output/kumite-breakthrough-card-coverage-20261029/catalog-inventory.json`.

## First implementation boundary

The first build ports the approved 40-card audition to production-owned source, adds five adapters (Baby Momma, Closet Nerd, Bus Pass, Soul Food, Cognac Bottle), and uses final canonical catalog stats and identity. The five supported starter recipes are `block`, `slide`, `receipts`, `crashout`, and `vibes`. There are 45 reviewed adapters out of 301 collectible definitions. This is an internal CPU audition; partial coverage is not eligible for any public beta.

The player flow uses the primary Kumite entry, a lazy Breakthrough route, existing account decks and deck-selection persistence, the existing editor, and the approved renderer. Unsupported cards remain visible with specific reasons. Support cards are actions; they never become marching zero-Hands fighters. The hero is retained as the visual captain. This slice uses normalized base stats; account training, upgrades and ordinary battle hero bonuses are not applied.

The room-domain foundation defines per-seat sequencing, retry fingerprints, a trusted server clock, private views and an atomic persistence contract. It is not a running multiplayer service. Live rooms still need a durable adapter, room ownership/fencing, authenticated transport, two-account proof and a terminal reward transaction. CPU practice cannot award trophies or roadmap credit. The fixed 590-point audition receipt must not appear on the player route.

The sections below retain the full integration target. Verification results and unresolved release gates are recorded separately in `kumite-breakthrough-integration-verification.md`.

## Product decision

Breakthrough becomes the dominant playable entry in Kumite. Kumite remains the umbrella for the realtime mode, weekly bracket, dojo raid, story and fighter road. Players bring their existing saved decks through the existing deck picker and editor. The separate practice crew builder, scenario controls and seed picker remain development tools.

The first production entry should feel like an arcade mode select: large authored Breakthrough art, a yellow/black action stripe, their actual deck box, and a clear PLAY action. No explanatory dashboard or new deck-storage system.

## Baseline and scope

- Original audition checkout: d2c3dcd5 with concurrent dirty work, preserved unchanged.
- Integration baseline: fetched origin/main 77f44c8b, Kumite expansion with full anime chapters and Roger announcer. A managed isolated checkout protects the original audition and other agents.
- Cached origin/main contains 301 collectible gameplay definitions: 278 characters, 13 supports, 10 blockbusters. Cosmetics/alternate appearances and owned copies are separate from this count.
- The approved audition grew from 20 to 40 explicit realtime adapters. The first integration adds five, for 45; cost/Hands/type come from the final release catalog. Older checkout differences are not a reason to rebalance cards.
- Existing decks already use ten unique cards, ownership validation and a hero selected from those ten. Breakthrough also uses ten unique cards; no deck-size migration is needed.
- Five of the 15 exported release starter recipes are complete within this 45-card slice. The other recipes and custom decks need further reviewed adapters; a saved-deck picker alone does not make them playable.
- Never merge the entire dirty audition checkout into main. Port the tested scope into a clean branch based on current main, reconciling new upstream changes first.

## Navigation and links

| Surface | Destination / behavior |
|---|---|
| Safehouse Kumite hotspot and main Fight tab | `/game/kumite`, subtitle "Breakthrough & tournaments" |
| Kumite hub primary full-width feature | PLAY BREAKTHROUGH → `/game/kumite/breakthrough` |
| Breakthrough lobby | Existing account deck picker; PLAY, PRACTICE, FRIEND MATCH, later RANKED; edit deck preserves return destination |
| CPU match | `/game/kumite/breakthrough/practice` |
| PvP room | `/game/kumite/breakthrough/matches/:code`, reconnectable |
| Weekly Bracket | Preserve `/game/kumite?view=arena`; optional future alias `/game/kumite/tournament` |
| Dojo Boss Raid | Preserve `/game/challenges?game=punch-on-patrol&raid=kumite` |
| Break the Bracket story | Preserve `/game/story?season=special-kumite-break-the-bracket` |
| Fighter Road & Films | Keep current mastery, unlock-road, eight-episode story and movie paths |
| Result | RUN IT BACK → same mode/selected deck; secondary CHANGE DECK / BACK TO KUMITE for production, replacing lab NEW DEAL |

Hub order: Breakthrough primary; Weekly Bracket, Dojo Boss Raid, Story, Fighter Road/Films secondary. Do not silently replace the rules of existing weekly tournaments. A later weekly Breakthrough competition needs its own explicit ruleset and preserves in-flight brackets and archives.

## One deck system

Reuse `CompactDeckPicker`, `usePersistentDeckSelection`, `profile.savedDecks`, owned starter recipes and `useDeckPersistence`. Account deck shape stays `{id, name, heroCardId, cardIds}`. Reuse the existing deck editor; do not copy the audition's `CREW_STORAGE_KEY` into account state.

Lobby flow:

1. Load profile and legal saved decks using existing ownership/catalog validation.
2. Restore the player's last selected account deck.
3. Resolve the same ten catalog IDs through a versioned Breakthrough compatibility layer.
4. Show their actual deck name, box art and captain/hero. Deck-box click edits it and returns to this mode.
5. If a deck has an unsupported card, keep it visible and list the exact reason with EDIT DECK. Never silently swap cards, falsify effects, or hide the player's whole collection.
6. Provide a curated loaner only inside the internal development audition. It is not an exception to the all-card launch gate. Do not overwrite the saved deck.
7. Match request sends `deckId`, not client-supplied card stats, upgrades or ownership.

All legal account decks across every canonical definition must be supported before any public release. A 45-card pool remains development-only.

### Compatibility contract

Create shared `resolveBreakthroughCard` / `validateBreakthroughDeck` APIs composing normal deck validation with a compatibility registry. Each catalog ID must be marked supported, deliberately restricted with a visible reason, or awaiting implementation. Unknown IDs/effects fail closed; generic positive Hands plus art is not an effect adapter.

The registry records canonical card ID, effect adapter, rule-conversion version, legal target requirements, deploy/timed/defeat triggers, transformation behavior, summon behavior and proof tests. Catalog stats come from canonical release data, not duplicated roster JSON. The release catalog applies creative kits and five balance/elemental override passes before construction; import the final catalog instead of raw wave definitions. Use existing catalog-to-engine identity helpers (`catalogCardById`, `catalogIdsToEngineIds` and inverse mapping); eight audition identities differ from engine IDs, so display names or ad hoc slugs are not safe dispatch keys. Snapshot relevant versions at match creation so a balance update cannot reinterpret an active room.

Preserve hero identity in selection and the account deck. Recommended first competitive policy: hero remains the deck's visual captain until a separately approved Breakthrough hero rule exists; no hidden passive inferred from normal battle behavior.

Recommended competitive beta policy: normalized canonical base stats and versioned mode effects, with cosmetics retained. Treat account upgrade bonuses as an explicit future rules choice; never accidentally inherit or discard them. These are proposed defaults for review, not implemented production decisions.

## Full catalog work

The existing turn-based engine's card-ID dispatch and ability modules are reusable sources of truth, but cannot simply be called against the different Breakthrough state shape.

| Family | Required realtime rule and proof |
|---|---|
| Entry damage, buffs, heals, steals, protection | Exact source/target, actual damage/credit, immunity, cleanup and deterministic order |
| Round-end/start/once-per-round | Explicit seconds, pulse origin, cooldown, stacking, pause semantics and no browser-timer authority |
| Targeted choices | In-battle selection before/at deploy, cancellation policy, server-valid targets; no hidden animation lock |
| 13 support cards | Non-marching action-card behavior, legal target and Motion cost; never force zero-Hands cards into fighter units |
| 10 blockbusters | Telegraphing, board effects, targets, bounded VFX, proper resolution and timing |
| Summons, tokens, Buddy-style objects | Instance IDs, lane placement, capacity, breach eligibility, timeout value and recycle/ownership rules |
| Movement, swaps, push, escape | Collision order, passage rules, no moving enemies past the base accidentally, instant legal deployment |
| Copy, transform, alternate forms | Base ID vs instance identity, cooldown inheritance, active effect cleanup, defeat/recycle reset |
| Deck/draw/discard effects | Private data, deterministic shuffles, final30s draw lock, return queue and simultaneous resolution |
| Location/district-dependent effects | Three lanes remain; specify equivalent lane modifier or visible restriction instead of silently disabling |
| Held-card auras / silence / freeze / burn | Timer origin, refresh policy, cleanse categories, source-death and match-end behavior |

Tokens must have explicit non-deck lifecycle: the audition currently recycles every removed fighter and lets every unit march/score, so a summon cannot be inserted as a generic fighter without new eligibility flags. All 23 release noncharacters have zero power and need genuine action-card handling.

For every card: successful activation, failure/blocked case, interaction with a second effect, death/recycle, timeout/Last Stand and replay determinism. Every existing authored starter/saved legal deck must validate under the chosen release policy. Balance simulation does not replace player tests.

## Server and PvP architecture

Add a distinct `mode: 'kumite-breakthrough'` room type and command adapter. Existing online room protections are useful; the existing turn-based `play` / `end-turn` contract is not a realtime implementation.

Server owns: roster resolution, ownership, seed, authoritative match clock/ticks, deploy ordering, costs, cooldowns, Last Stand, hidden draws and final result. Client sends sequenced deploy intent with room ID, card instance ID, lane and Squabble intent; never trusted elapsed time or result/points.

Reuse authentication, participant authorization, row locking/transaction protections, request-ID deduplication, command fingerprints, revision checks, surrender/rematch patterns and private-view redaction. Persist mode/rules/balance version, initial deck snapshots, start clock, seed, complete accepted command journal and terminal receipt. The audition's 512-command trace cap is not a durable match journal.

Transport choice requires measured two-client deployment latency. Existing800ms polling is not demonstrated adequate. Recommended direction is an authoritative realtime service/stream with optimistic local deployment reconciled by command ID; rejected inputs restore the exact hand slot and Motion. Deployment must never wait for a VFX promise or a preceding card animation.

Reconnect must restore hand, board, resources, pending effects and clock without duplicate deployments or replaying every old effect. Define background/disconnect grace, forfeits and rematch roster locking. Rate limits must allow legitimate rapid multi-card deployments while rejecting replayed/malformed commands.

Never return raw `GameState`: it exposes both hands/queues. Build per-seat public views and spectator-safe views explicitly.

## Progression, trophies and roadmap

Breakthrough has its own trophy points and records, separate from regular ranked points and the weekly bracket. The current result's fixed590-point preview is presentation only and must be removed/replaced with a server receipt in production.

Define a versioned Breakthrough reward table, anti-farming policy and season thresholds before competitive rewards. Server grants once per real completed room, transactionally and idempotently. No reward from imported traces, dev scenarios, local wins, duplicate requests, or abandoned warmups.

Roadmap credit is an explicit mapping from authoritative Breakthrough events: completed match, actual deployed fighter, valid win, real damage/blocks, eligible crew. Do not accidentally increment weekly-final/dojo mastery requirements. Preserve current Kumite raid/mastery, alt-art, film receipts and unlock presentation guards. Register active Breakthrough battles with `KumiteUnlockGate` so movies do not interrupt play.

Keep the requested Ascended Hands / Intergalactic Fade Master / God Boxer extension as an explicit normal-PvP progression task; its artwork is not proof the rank economy or thresholds are integrated.

## Presentation contract

- Entry and results: no hand, next-card stack, Motion controls or Squabble footer.
- Active battle: hand/controls appear immediately and retain fixed slots for rapid drops.
- Win: pristine yellow cloth. Loss: battered crimson-splashed, frayed counterpart with the same canvas/roller geometry. Draw: neutral/pristine.
- W/L slam, score, rematch, trophy/receipt and compact real stats. No prose wall. Account rewards reflect only real receipt values; audition shows a single PREVIEW label.
- Player avatars stay where they are over SM marks. Existing Hemi/Blzee, fist emblems, art, flame bars and supplied FX remain.
- The yellow scroll is a replaceable animation layer. UI can wait visually for its reveal; engine/network input and resolved outcomes remain independent.
- Production lobby uses authored full-bleed mode art and the established physical deck picker. Developer seed, tuning, compatibility diagnostics, and effect scenarios never appear in the player route.

## Delivery sequence and gates

1. **Baseline + product shell:** port scoped audition into a clean current-main branch; add lazy production route, primary Kumite feature and existing account deck picker. Pass login→hub→select saved deck→edit→return navigation, mobile, Back and rematch tests. Keep rewards off.
2. **Catalog adapters:** canonical resolver, conversion table and all-card compatibility inventory. Prove all legal release decks, targeting, supports, blockbusters and transformation cases. No no-op fallback.
3. **Internal solo integration:** complete CPU match with real deck, pause/resume, Last Stand, all outcomes and saved mode selection. Do not publish until every collectible card and its gameplay/presentation proof pass.
4. **Internal two-seat verification:** authoritative rooms, private payloads, simultaneous inputs, duplicate commands, latency/loss, reconnect and forfeits tested with two authenticated clients. Validate fast drag bursts on actual phones.
5. **Progression:** separate Breakthrough receipt/table/trophies/leaderboard; idempotent road missions; upgrade and hero policy locked. Practice reward policy explicitly chosen.
6. **Release proof:** full app/backend checks on clean baseline, real-device multi-match performance, matching deploy revision and API readiness, two-account end-to-end progression proof. Only then promote public ranked CTA.
7. **Tournament adoption later:** optional weekly Breakthrough ruleset after existing tournament/archive/mastery migration is specified and tested.

Suggested first implementation slice: primary Kumite entry + production lobby + shared saved-deck selection + compatibility reporting, alongside adapter coverage for the five complete starter recipes. The lobby shell remains internal until the all-card gate passes. This immediately resolves discoverability and the duplicate-deck-system confusion without pretending the remaining realtime card effects and server integration are complete.

## Verified source map

- `artifacts/squabblemon/src/pages/game/Kumite.tsx` (working tree and cached main): hub, starter/saved deck validation, existing mode links.
- `artifacts/squabblemon/src/components/CompactDeckPicker.tsx`, `pages/game/Decks.tsx`, `lib/deckSelection.ts`, `lib/useDeckPersistence.ts`: existing selection and deck persistence.
- `lib/squabblemon-engine/src/data.ts` (`validateSavedDeck`) and `types.ts`: account catalog/deck rules.
- `lib/squabblemon-engine/src/breakthrough.ts`, `artifacts/squabblemon/e2e/breakthrough/roster.ts`, `crewLoadout.ts`: isolated runtime and approved audition source; production modules now live under `src/components/breakthrough` and the canonical registry under the shared engine.
- `artifacts/squabblemon/src/pages/game/GameApp.tsx`, `pages/game/routeModules.ts`: route/lazy-module ownership.
- `artifacts/api-server/src/routes/collection.ts`, `routes/multiplayer.ts`, `lib/onlineMatches.ts`, `lib/kumiteRewards.ts`: saved decks, current turn-based online protection and reward boundary.
- `lib/db/src/schema/onlineRooms.ts`, `lib/squabblemon-engine/src/multiplayer.ts`: room persistence and seat-private views.
- Expanded Kumite hub, Story/raid/mastery links and unlock guards must be reconciled from current main, not copied wholesale from the older working page.
