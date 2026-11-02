# Breakthrough: Anunaki conversion plan

Prepared November 2, 2026 against `origin/main` / `ddf77549cd1323d1ab5b30e6a220e5ef8a8d26ad`. This is a source-inspected implementation plan. It adds no adapters, gameplay, completed acceptance evidence or launch approval.

The October 29 every-card release policy remains binding for public PvP: every current deck-legal collectible and its generated objects must be playable and usable; a restricted-card PvP launch is not the policy. The later shipped release separately permits explicit reward-free CPU practice. See the [current PvP worklist](kumite-breakthrough-pvp-launch-readiness.md). At this baseline the canonical catalog contains **311 cards; Breakthrough has 301 reviewed adapters and 10 missing Anunaki adapters**. `BREAKTHROUGH_PUBLIC_LAUNCH_APPROVED` is false and `BREAKTHROUGH_FULL_CATALOG_EVIDENCE` is null. Completing this plan removes the adapter gap; authenticated PvP, progression, device and deployment gates remain separate.

## Canonical inputs and proposed conversions

The table was verified by executing the final `cardCatalog` export from this baseline's `data.ts`, after `applyCreativeCardKits`, `applyRosterBalance`, `applyFullRosterBuffs`, `applyCrewMatchupBalance`, `applyElementalHandBonuses` and `applyBasePvpBalance`. The final effects/stats below match `anunakiWave.ts`; none of those overrides changes these ten cards. All ten are Normal characters and have matching catalog/engine IDs. Cost / Hands are normalized base values; this plan adds no account-upgrade or hero bonus.

The conversion column is proposed work, not present Breakthrough behavior. “Here” means the fighter's current lane when the effect resolves; strongest/weakest uses existing effective-Hands ordering and deterministic instance-ID ties. Targeted hostile effects go through the existing defended recipient pipeline.

| Card ID; cost / Hands; ability | Final canonical effect | Proposed real-time contract and focused proof |
| --- | --- | --- |
| `nabu`; 1 / 2; I Got Receipts | On Reveal: Place an Ancient Tablet here. | Entrance places one friendly lane Tablet; another placement cannot stack or replace it. Prove duplicate placement and both sides sharing a lane independently. |
| `enki`; 2 / 3; The Blueprint | On Reveal: Place an Ancient Tablet here. Give your weakest other ally here +2 Hands. | Place independently of the +2 to the weakest other actual friendly character here. Existing Tablet or absent ally cannot cancel the other clause. Prove ties, no ally and an already occupied Tablet slot. |
| `utu`; 1 / 2; Into the Light | On Reveal: If an enemy is here, give the strongest enemy −1 Hand; consume your Tablet here for another −1. Otherwise place an Ancient Tablet here. | No enemy: place Tablet. Enemy: consume local friendly Tablet if present and resolve one defended 1- or 2-Hand packet. Canonical consumption precedes the hit, so a blocked hit still spends the Tablet and triggers its consumption observers. |
| `ninhursag`; 2 / 3; The Maker’s Touch | On Reveal: Place an Ancient Tablet here. When your Tablet here is consumed, gain +2 Hands and cleanse a debuffed other ally here. | Entrance places Tablet. Every actual local friendly Tablet consumption notifies each active local Ninhursag: +2, then cleanse the weakest debuffed other actual character. Source death does not remove an existing Tablet. Prove multiple observers, no afflicted ally, inactive observer and Anu payment consumption. |
| `inanna`; 2 / 3; Catch These Divine Hands | On Reveal: Consume your Ancient Tablet here to gain +4 Hands. If there is none, gain +1 Hand. | Consume once and gain +4, otherwise +1. Preserve separate consumption and gain events. Prove enemy Tablet is never consumed and Ninhursag reacts once. |
| `yakub`; 2 / 1; Tapped In With the Ancient Text | On Reveal: Summon a free Caucus Mountaineer here (two if you SQUABBLE Yakub), without their On Reveal. | Spawn one ordinary 3-Hand Caucus, two for the original Squabbled entrance. No Motion, paid-play hooks or Lab Accident entrance. Canonical entrance echoes create one ordinary copy, even from Squabbled Yakub. Prove generated provenance and no extra reveal/chain. |
| `enlil`; 4 / 4; Storm Warning | On Reveal: Give the strongest enemy here −2 Hands. Consume your Ancient Tablet here to make that −4 instead. | With enemy, consume local Tablet first and resolve one defended 2- or 4-Hand packet. With no enemy, do nothing and retain Tablet. Prove interception, Protection/immunity and immutable Hands; no extra packet bypasses defenses. |
| `ereshkigal`; 3 / 3; Downstairs With Me | On Reveal: Give the weakest enemy here −2 Hands. Consume your Ancient Tablet here to gain +3 Hands. | Resolve defended 2-Hand hit if a target exists, then independently consume local Tablet and gain +3. Empty lane or blocked hit cannot cancel the friendly consume/gain clause. |
| `caucus-mountaineer`; 2 / 3; Lab Accident | On Reveal: Deal 1 damage to the strongest enemy here. If the hit lands, 35% chance to summon another Caucus that repeats this effect, up to 8 extras. At the end of each round, gain +1 Hands if your Ancient Tablet is here. | After actual positive damage, use the authoritative seeded effect RNG for one 35% roll; success spawns one ordinary copy which repeats the hit. Stop at a miss, blocked/no-damage hit, absent enemy, inactive/dead arrival or 8 extras. Each copy credits its own damage and keeps a source link. Proposed radiation: each active Caucus with a local friendly Tablet gains +1 at each global 10-second boundary; see decisions below. |
| `anu`; 6 / 8; The Original Plan | Costs 2 less Motion by spending one of your Ancient Tablets (this district first). On Reveal: Consume your remaining Tablets for +3 Hands each, or gain +2 if none remain. | Pure cost quote chooses a friendly Tablet in the paid lane first, then lowest lane; successful atomic payment consumes that exact Tablet before entrance and notifies its local observers. Entrance consumes all remaining friendly Tablets across lanes, notifying each lane's observers, then grants +3 each, or +2 with none. Enemy Tablets survive. Cost failure/cancelled command cannot spend a Tablet. |

Turn-based reference details come from `gameEngine.ts`: `anuDiscountTablet`, `reactToConsumedTablet`, the Anunaki branch in `resolveAbilityBase`, paid placement and `radiateCaucusAtRoundEnd`. These are behavior references, not callable Breakthrough adapters.

## Decisions to close during implementation

These conversions are not approved balance changes. Record the adopted rules in the module descriptions and tests before marking the cards reviewed.

1. **Radiation clock:** adopt the established global 10-second pulse, with no deployment-time pulse or catch-up duplicates; continue in Last Stand. Define that a deployment exactly after a boundary first radiates at the next boundary. Check order against a Tablet consumed on that same authoritative tick. No browser timer owns this rule.
2. **Generated Caucus lifecycle:** follow existing real-time summoned fighters: march, fight, count timeout Hands and breach; never enter hand/queue/returns or saved decks. Canonical Caucus remains collectible; its generated instances must retain `origin: 'summon'`. Unlimited normal district populations remain unchanged; the chain cap bounds one effect, not total lane capacity.
3. **Anu discounts:** retain canonical non-stacking intent: spend a Tablet only when its 2-Motion reduction beats the eligible alternative; a tie preserves it. Breakthrough currently composes several other discounts, so explicitly test and document the comparison to Plug/Buddy/Transfer Ticket and authored Music/Contract/Special discounts without changing other cards' prices. Quote and payment must choose identically; taxes remain payable and cannot be bypassed.
4. **Copy/echo/return semantics:** author Scammer's copied ongoing Ninhursag/Caucus behavior and suppression of copied entrance effects; retain immutable identity for Anu's printed cost ability. Echoes are ability resolutions, never paid deployment. Returns must not duplicate Tablets, reset a currently resolving chain cap, retain generated units as collectible returns or reapply Squabble. Resolve any difference from established module contracts explicitly.

## Integration seams and implementation order

1. Add `src/breakthroughAnunaki.ts` with ten explicit adapters/descriptions, typed context, cloneable runtime, lane Tablet operations, source-aware consumption reactions and bounded chain handling. Use existing gain, cleanse, active-kit, hostile strike, seeded RNG and explicit summon helpers; do not duplicate their defenses. Tablets are lane resources, not zero-Hand fighters: no movement, combat, collision, timeout value, breach or recycle. At most six exist across both sides.
2. Wire `breakthrough.ts`: descriptions/type union; optional runtime in `GameState`; deep clone/checkpoint defaults; entrance outcome; atomic Anu quote/payment; shared pulse; source events and cleanup. A successful paid deployment still materializes immediately; media never gates it. Use ordinary event provenance for each damage, gain, spawn and consume, including source/recipient after interception. Keep in-flight checkpoint compatibility explicit under the new versioned ruleset.
3. Register `ANUNAKI_ADAPTERS` in `breakthroughCatalog.ts`; preserve final canonical stats, art and IDs. Change the current ten-card rejection regressions to exact full-catalog parity, while retaining unknown/unowned/duplicate/token and invalid-input purity checks. Add the new behavior module to `BREAKTHROUGH_RULE_INPUT_SHA256`, refresh affected hashes and advance the ruleset. Keep launch approval false and evidence null until the independent release review is complete.
4. Extend `breakthroughRoom.ts` with a whitelisted public Tablet projection containing only visible side/lane/resource information. Checkpoint/retry/replay must preserve its state. Never expose the raw Anunaki module runtime, opponent hands/queues or RNG. Keep the public room gate closed.
5. Extend `BreakthroughArena.tsx` / its existing resource presentation with equipped canonical Tablet art, readable ownership/readiness, consume feedback, exact Anu price and summon distinction. Reuse the existing approved asset; record its derivative/provenance if a new delivery size is needed. Tablet marks cannot cover lane input or make occupied-lane taps inspect instead of deploying a selected card. Include reduced motion, sound preferences, accessibility names and room-view restoration.
6. Complete the focused matrix below, then all-card smoke, required release build, types and browser/device evidence. Re-run source-bound coverage and discard older 301-card evidence as launch proof. Record the new candidate revision and working-source hashes with each artifact.

## Required eight-part acceptance for each of the ten cards

Store actual evidence references per canonical ID; checking all boxes in prose is not evidence. The same eight checks remain required for all 311 cards under the current release gate.

| Release check | Minimum Anunaki-specific cases |
| --- | --- |
| `activation` | Real reducer deploy with final canonical cost/Hands; correct empty/occupied Tablet branches; Yakub normal/Squabbled; Caucus hit/roll/cap. |
| `targeting` | Strongest/weakest effective Hands and ties; actual friendly characters versus tokens/resources; lane and side ownership; Anu lane preference and price alternatives. |
| `rejected-input` | Wrong side/lane, absent hand card, insufficient Motion, repeated command, stale quote and invalid intent preserve original state, hand, Motion, Tablet and RNG. |
| `interaction` | Protection, immunity, bodyguard and cannot-lose-Hands stop unauthorized damage/chain credit; actual recipient/source metadata; multiple Ninhursag, cleanse observers, copied kits, echo and delayed/cancelled entrance. |
| `lifecycle` | Source defeated/moved/returned; Tablet persists until consumption; observer follows its current lane/active state; generated Caucus never recycles; no double consumption or paid-play hook. |
| `last-stand` | Legal deployments/consumption/summons and adopted radiation remain available; scheduled draws remain locked; timeout/breach accounts for real fighters only. |
| `deterministic-replay` | Same command journal/seed produces identical full state; JSON checkpoint mid-chain setup/before pulse/before Anu restores exactly; duplicate/reordered retry cannot repeat payment or RNG. |
| `presentation` | Actual arena and per-seat room view show the right Tablet state, art, price, amounts, chain and ownership; touch/drag bursts remain immediate and controls reachable at required viewports, then on physical phones. |

## Exact verification entry points

Run from the candidate repository root with its installed dependencies. These commands identify the existing gates; they have not been run as Anunaki conversion proof in this planning change. Add the proposed focused test file to `criticalSuites` in `scripts/release-checks.mjs` so local and deployment builds both require it.

```sh
# After the proposed focused suite exists and is registered:
NODE_ENV=test node --import ./artifacts/squabblemon/e2e/supplied-battle-fx.setup.mjs --test lib/squabblemon-engine/breakthroughAnunaki.test.ts lib/squabblemon-engine/breakthroughCatalog.test.ts lib/squabblemon-engine/breakthroughFullCatalog.test.ts lib/squabblemon-engine/breakthroughRoom.test.ts lib/squabblemon-engine/breakthroughRelease.test.ts

# All current Breakthrough engine/helper regressions (supplemented by build lifecycle tests):
pnpm run test:breakthrough

# Mandatory complete source suite, production bundle, Story delivery and existing JS/CSS budgets:
node scripts/release-checks.mjs --build --evidence output/kumite-breakthrough-anunaki/release-build.json

pnpm run typecheck:libs
pnpm --filter @workspace/squabblemon run typecheck
pnpm --filter @workspace/api-server run typecheck
git diff --check
```

Browser work must add a maintained Anunaki scenario to the existing Breakthrough fixture and record 320×568, 390×844, 844×390, tablet and desktop: visible Tablet placement/consumption, affordable/insufficient Anu quote, Yakub summons, chain feedback, crowded immediate consecutive plays, reload projection, keyboard, enlarged text and reduced motion. No existing generic viewport or turn-based Anunaki runner proves these new real-time scenarios. Record command, revision, fixture/server, viewport, renderer, cache/network conditions and artifacts; add the new executable runner to the release inventory when implemented.

The existing native Anunaki/base-PvP runners (`scripts/test-anunaki-native.mjs`, `scripts/test-anunaki-mixed-browser.mjs`, `scripts/test-payments-database.mjs --anunaki-browser`) guard different journeys. They may detect a shared regression, but cannot certify a Breakthrough transport, durable store, lease, authenticated reconnect, anti-farming settlement or trophy receipt that does not yet exist. Those remain explicit PvP implementation and staging/device release work after the catalog conversion.

See [current every-card gate](kumite-breakthrough-all-cards-launch-gate.md), [production integration contract](kumite-breakthrough-production-integration-plan.md) and [engineering standards](../../design/engineering-standards.md). Keep historical 301-card results labeled historical; adapter presence alone never opens public entry.
