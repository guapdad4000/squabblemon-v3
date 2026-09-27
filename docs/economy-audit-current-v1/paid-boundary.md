# Paid boundary and cosmetic catalog — current-source audit

Source anchor: `5f86e9608f28e48f22879cf5fc5aa61ee1c7b654`. Source inspection only;
no environment reads, provider calls, checkout, account queries, or deployment.
Catalog exports were imported locally to count authored items, not to execute the
app. This is neither a legal opinion nor a claim about current production flags.
The companion `cosmetics.json` distinguishes current mechanics from proposals.

## Decision

**The implemented payment product is not cosmetic-only.** It sells fungible
Clout. Shards themselves buy cosmetics, but buying Clout can buy gameplay cards,
XP and move coaching, enter Stockz, and buy packs that return more Clout.
Cosmetic-only marketing would therefore misdescribe the implemented boundary.
Recommend direct, deterministic cosmetic entitlements for a small future wave,
not another pack or conversion layered on the existing wallet.

**Direct delivery alone is not sufficient isolation.** Selling an existing
pack-eligible variant adds to `ownedVariants`, removes it from the available
style pool, and can bring forward exhaustion and its 25-Clout fallback. That is
an indirect paid-to-gameplay outcome even without an explicit exchange button.
Do not sell any existing gacha-pool variant unless source-isolated eligibility
and duplicate handling are proven incapable of changing gameplay/Clout outcomes.
The safest future finishes/alternate art are new disjoint deterministic SKU IDs,
not current pack variant IDs. First-wave reactions and signature styles use
`unlockedCosmeticIds`, not the pack's `ownedVariants` pool; keep that separation.

## Source and operational evidence must remain separate

`artifacts/api-server/src/lib/payments/config.ts` exports the following USD
base prices (automatic tax is additional where applicable):

| Offer | Clout | Base USD | Clout/USD | Repeat-only mixed-match equivalent* |
| --- | ---: | ---: | ---: | ---: |
| Pocket change | 500 | 2.99 | 167.22 | 8.06 |
| The stack | 1,500 | 7.99 | 187.73 | 24.19 |
| Full bag | 4,000 | 19.99 | 200.10 | 64.52 |

*At 50% wins/10% draws/40% losses, 62 Clout per verified fade, excluding
missions, account rewards, packs and finite grants. This is not a playtime or
conversion estimate. Largest bundle supplies ~19.7% more Clout per dollar than
smallest; fractional pack equivalents do not imply fractional purchases.

Source `LIVE_APPROVAL` booleans are now true. New live checkout still requires
both `PAYMENTS_ENABLED` and `PAYMENTS_LIVE_ENABLED`, production request-scoped
deployment context/ID and matching trusted HTTPS origin, allowed optional
context env values, policy/support URLs, mode-specific provider configuration,
webhook secret, price IDs and tax code. `payments/service.ts:createCheckout`
and `payments/geography.ts` additionally enforce authenticated account
ownership, adult and US self-declarations, and trusted hosting geography for
new reservations. They do not independently establish age or residency.
Historical retries and signed settlement are separate from new admission.

`docs/corner-store-payments.md` still calls source approval false, checkout
disabled, and hosted testing outstanding in several sections. These are stale
prelaunch statements, not current evidence. The newer
`docs/corner-store-payments-verification.md` section “Live production purchase
evidence (2026-09-24)” records a real $2.99/500-Clout purchase, zero computed
tax, one fulfillment, and webhook 200 on a named deployment. That historical
record supersedes the older “no live charge” assertions **for that purchase**;
it does not prove checkout is enabled today. Positive-tax and actual non-US
network coverage remain unclaimed. No operational evidence was revalidated here.

## Money and conversion graph

| Edge | Authority and outcome |
| --- | --- |
| USD → Clout | `payments/service.ts:reconcileOrder` validates provider session, intent, charge, mode/currency and totals, locks profile, inserts one unique fulfillment and adds `order.clout` to `profile.softCurrency`. Earned and bought units share that field; no downstream provenance restriction. |
| Clout → gameplay | `lib/squabblemon-engine/src/economy.ts:planShopPurchase`: 100 for +100 card XP, 225 for +250 XP (proportional near cap); coaching 100/250/500 at levels 2/5/8; chosen unowned Common 400. XP and move tiers feed `abilityUpgrades.ts` snapshots, so these are progression, not cosmetic purchases. Mode-specific use of upgrades is a separate battle audit. |
| Clout → convenience | Extra saved-gang slot 350, cap **24** (the old economy doc's 12 is stale). This does not itself grant combat stats but is not a cosmetic entitlement. |
| Clout → randomized gameplay | Ticket 200; single pack 200 or one ticket; ten-pull 1,800 or ten tickets. `collectionTransactions.ts` debits/grants under the profile lock. Five gameplay slots per pack; a Rare+ ten-pull duplicate counts toward guarantee. |
| Packs → cosmetics | Owned gameplay duplicates become matching rarity shards 5/8/12/20/40/80 (Super Common maps to Common); nominal bonus 30% gives 5/10/15 universal shards; nominal 5% grants an unowned variant, with ten-pack eligible style pity. |
| Packs → fungible Clout | Nominal 65% bonus gives 25/50; exhausted featured-style result gives 25 and resets pity. Pity overrides nominal bonus probabilities. A hypothetical paid “cosmetic pack” reusing this resolver would therefore leak into gameplay even if all gameplay cards were already owned. |
| Direct sale of pack variant → changed future pack outcomes | Adding an existing variant to `ownedVariants` reduces the eligible style pool and can accelerate exhausted-style Clout fallback. Direct sale is therefore not inherently safe; forbid it under the strict boundary without proven source isolation. |
| Shards → cosmetic entitlements | `styleShards.ts`, `cosmetics.ts`, `collectionTransactions.ts:craftVariant`, `economy.ts`: matching tier first, then universal shortfall; other tiers cannot substitute. No reverse conversion to Clout is exposed by these implementations. Existing universal shards/legacy receipts retain their meaning. |
| Clout → reactions | Block Talk 300; nine character packs 400 each, no character ownership requirement. Permanent unlock IDs; repurchase refused. The same Clout may have been earned or bought. |
| Clout → Stockz → Clout | `artifacts/api-server/src/lib/stockz.ts`: stake 10/25/50/100, max five starts per UTC day, one unsettled round at a time. Server chooses up/down equiprobably; win returns 2× stake, loss 0 after stake debit. Expected net zero per stake, not guaranteed income. No paid-balance exclusion; returned Clout can buy gameplay. |
| Refund/dispute → order status | `payments/service.ts` records refund amounts/disputes, blocks new fulfillment of reversed payments, but does not automatically deduct an already credited wallet or revoke descendants. Partial refund is money accounting, not proportional Clout regrant/deduction. |

The source does not expose cash-out from Clout. That does not remove the
paid-randomized-content or paid-progression concern. Existing policy's unused
Clout condition requires support review; a unified balance does not reliably
identify which remaining units were purchased after arbitrary spending.
`docs/corner-store-payments.md` correctly calls any wallet correction a separate
approved, locked, documented support action—never an improvised negative balance.

## Implemented cosmetic value and sticker-work boundary

Current exports contain **202 catalog cards / 615 variants**: 202 Tagged at
80 shards, 202 Chrome at 140, 202 Prismatic Reverse Holo at 300, eight
Alternate Art and one Crazy at 180. Do not price every cosmetic as 80/140.
There are **61 available character style sets**, all with sticker packs, and
60 authored banner/deck-cover image pairs; legacy Kyle uses its legacy set.
`CHARACTER_STYLE_ROLLOUT` includes candidates: membership there is not proof of
a finished purchasable set.

Character scenes cost 60 shards, signature sticker packs 100, Silver Lining
banner finish 120. Character ownership and relevant unlocks are checked by
`validateCosmeticLoadout`. Up to three different banner stickers can be equipped;
they need a selected banner. Base character banners require character ownership,
not a separate banner purchase. Deck covers are rendered by `DeckCarousel.tsx`
from the cover character's art, not a separately priced deck-skin SKU.
Sticker avatars are explicitly available to everyone and must not be resold as
exclusive existing entitlements. Standalone paid avatar frames, battlefield
themes, seasonal passes and premium currency are **proposals, not established
offers in this audited catalog**. A decorative frame rendered by a variant is
not evidence of a standalone frame SKU.

Reaction catalog: two free starters, Block Talk's two, and nine four-reaction
character packs (40 total reactions). `reactions.ts:ownedReactions/addReaction`
uses catalog IDs and permanent unlocks, validates ownership and applies a
four-second server cooldown. `BattleReactions.tsx` displays for five seconds,
supports reduced-motion stills and a local “Hide opponent reactions” preference.
The inspected baseline source has a **collection selector**, grouped pack shelves,
named ownership states and previews (`ReactionShop.tsx`). It does **not** have a
persistent favorite/quick-loadout field in `ReactionView` or `BattleReactions`.
The separately assigned sticker-organization work was still merging when this
audit finished. This is a baseline source inspection, not verification of that
task's final merged outcome. Do not promise a favorites/loadout outcome that
is not present at this audit revision.
Banner sticker loadout is implemented but is a different feature.

## Gacha disclosure check

`Shop.tsx` odds dialog consumes `bootstrap.packConfig.odds` and displays the
receipt odds version; `collectionEconomy.ts` uses shared `packRules.ts`
disclosures. These describe 40/20/25/12/2/.8/.2 slot weights (15% Rare+), tier-local
protection, matching duplicate payouts, universal bonuses, pity override,
exhaustion → 25 Clout, and ownership-independent ten-pull fallback. The dialog
explicitly says punching is presentation and rewards are already server-saved.
Local preview says curated sample rewards, not live odds.

No definite numeric drift was found in those current disclosure paths.
The short result headline “One guaranteed Rare+” omits “may be a duplicate”;
the detailed dialog is accurate. Recommend repeating that qualifier beside the
purchase guarantee, and explicitly distinguishing gameplay packs from cosmetics.
The historical v1/v2 audit's universal duplicate/28-shards pacing is not a
current purchasing-power forecast after tier currencies and catalog growth.
This inspection does not establish visibility, reading comprehension or keyboard
accessibility in a running browser.

## Ranked first-wave hypothesis (not approved prices)

Keep first wave to two deterministic products using existing presentation,
with preview, exact contents, permanent entitlement and no duplicate purchase.
USD values below are research hypotheses before tax, **not** computed fair
prices, live offers or entitlement changes. Existing earned routes stay intact.

Every row below inherits **free opponent mute/hide controls and reduced-motion
stills**, readable names/rarity/stats, accessible preview and keyboard labels.
Cosmetics must never change input latency, input animations, animation lockouts,
turn clocks, hitboxes or information available to either player. Static
profile/deck items leave those battle controls unchanged; new effects must obey
them, never sell their removal. Implementation costs include product-specific
work; all paid rows additionally require the shared direct-entitlement payment
and refund boundary described below (medium engineering effort, not free reuse
of Clout fulfillment). Cost ratings are relative planning estimates, not budgets.

| Rank / value | USD before-tax hypothesis and unit | Earned vs proposed paid route | Implementation / content cost | Repeat potential | Readability, accessibility and competitive constraints |
| --- | --- | --- | --- | --- | --- |
| 1 — **first wave**: four-reaction character pack; social identity without character prerequisite | **$1.49–$1.99 per exact four-reaction pack** | Existing 400 Clout (~6.45 repeat-only mixed fades); proposed direct exact pack entitlement, never Clout | **Medium implementation**: order-to-pack entitlement/replay/refund integration. **Low content** for existing four-image sets; medium for newly authored animations and stills. | Finite once per pack; distinct packs only, no consumable reactions | Free starters, free mute and reduced motion, preview all four, named buttons; unchanged cooldown/input animation, no priority or larger battle obstruction. |
| 2 — **first wave**: signature scene + stickers + Silver Lining for one already-owned character | **$2.49–$2.99 per exact three-entitlement bundle** | Existing 60+100+120 = 280 matching/universal shards; proposed direct three entitlements, disclose character prerequisite | **Medium implementation**: item-level ownership, partial-owned quote and refund allocation. **Low content** reusing existing completed sets; medium for a new scene/sticker set. | Finite per character; reject all-owned bundle and quote remaining items, never duplicate compensation | Preserve free avatars/base banner/deck cover; contrast-safe scene and rarity/stats. Free mute/reduced motion remain; no character grant or change to inputs/animations. |
| 3 — **defer**: new disjoint deterministic card finish or alternate art; favorite-card identity | **$0.99–$2.99 per new finish; $1.99–$3.99 per new alternate-art SKU** | Existing 80/140/300/180-shard pack variants remain earned-only for this proposal, **not paid candidates**. New disjoint SKU gets a permanent earned challenge (requirements TBD) and direct entitlement alternative; never adds a current pack ID to `ownedVariants` | **High implementation**: separate equipment/entitlement IDs, pack-outcome isolation tests and refund provenance. **Medium content** for new finishes; **high content** for new alternate art, recognition review and multi-size QA. | Once per new SKU, later distinct art; no random rolls, rerolls or duplicate compensation | Readable rarity frame/name/stats and recognizable character; still preview. Free mute/reduced motion unchanged, no altered input animation, hitbox or combat information. No eligibility, pity, exhaustion or Clout changes in the existing pack pool. |
| 4 — **later research**: new profile banner/frame/background; account identity outside combat | **$1.99–$3.99 per exact coordinated profile set** | No standalone current paid frame/background SKU; propose a permanent earned challenge route with published requirements, cost not yet set; direct entitlement alternative | **Medium implementation**: new profile slots, permissions and fallback rendering. **Medium content**: coordinated art, crop/contrast and responsive QA. | Distinct permanent sets, not rental; retain existing free avatars/banners | Restrict to profile surfaces, preserve text contrast and labels. Free mute/reduced motion and battle inputs/animations unchanged; no stat aura. |
| 5 — **later research**: deck box/cover presentation; crew identity | **$1.49–$2.99 per exact deck-presentation set** | Existing character-derived deck art stays included; propose earned deck-building challenge for new sets (requirements TBD) or direct exact cosmetic entitlement, never a deck slot/card | **Medium implementation**: independent deck-art equipment and fallback. **Medium content**: cover crops/thumbnails and small-screen QA. | Different visual themes only; one entitlement usable across decks, not per-deck repurchase | Outside concealed-card identity; no card-back information advantage. Labels and controls remain legible; free mute/reduced motion and input animations unchanged. |
| 6 — **later research**: optional noninteractive presentation accent, e.g. post-match confetti | **$0.99–$1.99 per permanent effect** | No current independent offer; propose earned achievement entitlement or direct chosen effect, with no currency/reward bonus | **High implementation**: opt-out/reduced-motion enforcement, performance, input and sensory-safety tests. **Medium content**: bounded animation plus static equivalent. | Distinct effects only, no charges per trigger; avoid selling excess visual noise | Free local/opponent hide and reduced motion mandatory; never cover controls, delay results, alter input animations/locks, flash or obscure battle state. Static/disabled option conveys identical information. |
| 7 — **later research**: deterministic cosmetic seasonal collection, not a pass | **$4.99–$7.99 per published exact-content collection** | No current offer; propose permanent earned challenge archive for each item plus direct bundle/individual purchase. Costs TBD; no paid XP, streak repair or time-limited claim pressure | **High implementation**: item-level partial ownership/refunds, archive and catalog cadence. **High content**: coherent multi-item art, stills, accessibility and cross-surface QA every release. | New distinct collections; no expiry/subscription, no duplicate compensation; don't forecast cadence before production capacity is known | All constituent rules apply: readable rarity/stats, free mute/hide and reduced motion, unchanged battle/input animations and timing; no gameplay rewards or exclusive information. |

There is no evidence here for conversion, willingness to pay, retention,
price elasticity or cadence. These are small discoverable tests, not revenue
forecasts. Avoid loot boxes, consumable reactions, paid streak repair, paid XP,
power bundles, or subscription pressure as “cosmetic monetization.”

## Recommended boundary design and safe transition

**Prefer direct entitlements.** Quote exact catalog item IDs and ownership;
reserve immutable account-bound orders; fulfill once under the existing lock;
store payment-to-entitlement provenance. Duplicate completion/replay must return
the same result, never cash-equivalent compensation. Existing earned unlocks
must prevent paid duplication. A character-scoped cosmetic sale requires the
character already owned but may never bundle or refund into a gameplay card.
Only sell entitlement IDs disjoint from existing gacha eligibility. An ownership
change itself can alter future rewards: “no conversion endpoint” is insufficient.
Existing pack-eligible finishes/alternate art must not be sold directly unless
source-isolated eligibility and duplicate handling have been proven not to
change gameplay/Clout outcomes. Prefer new deterministic SKU IDs with separate
equipment metadata and no writes to pack ownership/pity. Apply this restriction
to individual products, bundles, seasonal collections, refunds and earned/paid
duplicate resolution alike. First-wave reaction/signature unlocks must continue
to avoid `ownedVariants`; future implementation needs regression proof of that.

A nonconvertible cosmetic wallet is possible but higher risk: additional ledger,
refund allocation, pricing cognition and balance liabilities. It must buy only
deterministic allowlisted cosmetics. No Clout, tickets, XP, cards, recruitment,
slots, Stockz, randomized packs, gifts/transfers, reverse exchange, or
exhaustion refunds into existing currencies. It cannot reuse today's universal
shards blindly: those already participate in historical pack accounting.
Do not force a paid wallet on players solely to create leftover balances.

Transition is prospective and requires owner approval, not this audit:

1. Stop **new** Clout orders at an announced cutoff after approved replacement
   products/policies are ready. Do not disable signed settlement for old orders.
2. Preserve all legacy Clout, earned balances, ownership, receipts, pity and
   contractual claims. Do not infer “paid remaining” from current balance, replay
   historical packs to reconstruct provenance, confiscate, or bulk convert.
3. Honor pending old orders against their immutable quote and isolate their
   provenance in audit reporting. Legacy Clout can still reach gameplay:
   describe the transition as “new purchases cosmetic-only,” not an instantly
   pure whole economy.
4. New refunds return money through the provider and affect only specifically
   attributable new paid entitlements under approved policy. Never compensate
   a duplicate/revoked cosmetic with Clout, pack tickets, random rewards or XP.
   Never revoke an independently earned entitlement. Keep partial refunds and
   disputes reviewable, with item-level allocation and no negative gameplay
   wallet. Old Clout refunds retain separate reviewed legacy handling.
5. Before activation, test new checkout/fulfillment/replay/concurrent earning,
   owned-item rejection, stale clients, refunds and every transitive conversion
   path. No runtime or provider changes are authorized by this document.

## Findings ordered by impact

| ID | Severity / confidence | Evidence, impact, recommendation |
| --- | --- | --- |
| PB-1 | High / high | Fulfillment → unified `softCurrency` → training/recruit/packs. Cosmetic-only claim is false for current product. Move new sales to direct deterministic entitlements; retain truthful legacy disclosure. |
| PB-2 | High / high | `stockz.ts` stakes and pays unified Clout with no origin filter. Paid currency can fund a chance-based loop returning gameplay-spendable units. Exclude it structurally from all future paid cosmetic products; obtain specialist policy review, not a legal conclusion from this audit. |
| PB-3 | High / high | Pack bonus and exhausted-style compensation return Clout. Reusing the resolver OR selling existing pack variants that reduce its eligible style pool violates the strict boundary. Require disjoint deterministic entitlements and regression proof that paid ownership/refunds cannot change pack gameplay/Clout outcomes; no current pack-variant sale without proven source isolation. |
| PB-4 | Medium / high | Refunds preserve already fulfilled Clout, unified balance loses remaining provenance. Support cannot assume unused paid amount from wallet alone. Keep legacy manual approved review; add item provenance only to new product design. |
| PB-5 | Medium / high | Operations doc says approvals false; source true and later doc records live purchase. Release operators could follow contradictory instructions. Supersede stale sections with dated evidence hierarchy, without claiming current flag state. |
| PB-6 | Medium / high | 615 variants include 180/300-shard items; current tier currencies are not universally fungible. Old 28-universal-shards cosmetic pacing is misleading today. Use current per-tier costs and ownership scenarios. |
| PB-7 | Low / high | Short Rare+ headline lacks duplicate qualifier; detailed shared odds are accurate. Repeat qualifier near commitment; no evidence of altered odds claimed. |
| PB-8 | Low / high | Task-184 source has grouping/selection, not persistent reaction quick-loadout. Marketing/roadmap must distinguish implemented grouping from proposed favorites and from banner sticker equipment. |