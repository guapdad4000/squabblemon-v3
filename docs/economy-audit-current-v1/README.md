# Squabblemon economy and cosmetic monetization audit

**Current-source edition 1 · 2026-09-27**  
Inspected runtime revision: `5f86e9608f28e48f22879cf5fc5aa61ee1c7b654`.
This is an audit and decision proposal, **not permission to rebalance, sell
anything new, change checkout, deploy, or alter accounts**.

## Verdict

**Keep the deterministic reward authority and the cosmetic presentation systems;
do not describe the existing commercial design as cosmetic-only.**

- **Healthy:** authenticated solo rewards are replay-verified and receipt-backed;
  wallet mutations share the profile lock; finite story duplicate promises remain
  intact; packs roll rarity before tier-local new-card protection; cosmetic
  crafting has deterministic prices; reactions have permanent ownership, free
  starters, cooldown, opponent-hide and reduced-motion support.
- **Confirmed mismatch with a cosmetic-only objective:** real-money fulfillment
  credits the same Clout that buys randomized gameplay packs, recruits, card XP,
  move tiers, saved-deck convenience and Stockz stakes. Normalized online move
  tiers do not remove paid roster access or paid PvE acceleration.
- **Current pacing differs materially from the historical audit:** the foundation
  is 24 owned cards, not ten; current story has 101 battles and up to 219 finite
  tickets, not 123; check-ins, Growth Lab and daily shop claims add substantial
  income. Duplicates feed six restricted wallets, not a flat universal award.
- **Unclear rather than proven unbalanced:** online matches pay no Clout/card XP,
  high-tier cosmetics have much longer acquisition tails, early collection
  milestones are immediately eligible, and large promotion grants dominate
  organic income. These are design decisions requiring evidence, not proof of
  poor retention, abuse or commercial failure.
- **Recommended first wave:** exact, direct reaction-pack entitlements, then exact
  signature scene/sticker/banner-finish bundles for already-owned characters.
  Keep earned routes. No premium wallet initially; no gameplay items or randomized
  paid content. Do not directly sell existing pack-pool variants: even deterministic
  sales can accelerate pool exhaustion and its Clout fallback.

**Owner decisions first:** approve the strict paid boundary and prospective
legacy transition; decide whether online-only players should progress outside
rank; choose desired organic cosmetic cadence; approve a small pricing/content
experiment, not a full catalog rollout.

## 1. Evidence boundary and coverage

The working tree was clean at the inspected revision. Only audit documentation,
offline model/diagnostic scripts and agent audit-method memory are deliverables.
Historical reports and fixtures are preserved byte-for-byte. No account data,
secrets, provider settings, payment operations, deployment or migrations were
read or changed. Existing payment evidence is cited, not repeated.

| Evidence class | What this audit establishes | What it does not establish |
| --- | --- | --- |
| Current source | Amounts, eligible routes, persistence writes, catalogs, guards and conversion paths at the revision above | That the same revision/configuration is deployed |
| Pure-rule diagnostics | Seeded production pack generation, exact formulas, claim-state fixtures, rank fixtures and source assertions | Production concurrency, real session delivery, exploit prevalence |
| Source simulations | Conditional first-session/7/30-day wallet and acquisition outcomes | Player measurements, actual session length, retention or profitability |
| Historical payment record | A dated September 24 live purchase is recorded in the verification document | Whether checkout is enabled now, current balances or positive-tax coverage |
| Uninspected operations | Explicitly unknown | No inference from available credentials, old flags or an app screenshot |

Coverage artifacts, with exact amounts and source references:

| Area | Primary evidence |
| --- | --- |
| Every wallet/progression track, dormant fields, earns/spends, missions, promotions, full per-node story grants, resets and retry identity | [Machine-readable ledger](ledger.json), [ledger explanation](ledger-notes.md) |
| Training, tutorial, story, activities, Arcade, friendly/ranked humans/bots, exits and rematches | [Mode matrix and XP trace](modes.md), [mode data](modes.json) |
| Current gacha, all collection cohorts, spending priorities, tails and finite supply | [Simulation results](simulation.json), [methods/assumptions](simulation-notes.md), [readable result tables](results-summary.md) |
| Existing cosmetics, current sticker organization, payments/refunds and ranked product proposals | [Paid boundary](paid-boundary.md), [catalog/proposals](cosmetics.json) |
| Baseline reproducibility | SHA-256 input manifests in ledger and simulation; commands in section 8 |

Sources are linked from each ledger entry through its `evidence` keys to
`sources` paths and stable symbols. Mode references include line ranges.
The generated story inventory includes exact reward indexes/claim keys,
prerequisites, optional nodes and first-perfect identities. Operator-authored mail
amounts cannot be enumerated from source; schema bounds and claim behavior are
recorded without inventing a live campaign.

### Historical reconciliation

| Historical statement | Current rule/evidence | Treatment |
| --- | --- | --- |
| Ten starter cards | 24-card foundation, ten-card saved mentor crew | Use current ownership, not deck size |
| 158-card pack catalog | 202 cards, rarity counts 9/43/28/49/29/24/20 | Recompute named-card odds |
| 19 chapters / 81 battles / 123 total tickets | 29 / 101 / 219 | Export current transformed story graph |
| Every major story node uses two tickets | First eight chapter closings retain ten; authored total 118 | Authored rewards override inference from a shared constant |
| Five universal shards per pack duplicate | 5/8/12/20/40/80 matching rarity shards | Keep all six balances distinct; universal bonuses remain separate |
| ~28 universally spendable shards per complete pack | Ordinary slots yield 36.6 matching shards across six wallets, plus a separate pity-sensitive universal bonus | Never use the sum as cross-tier affordability |
| Saved-deck cap 12 | Cap 24 | Convenience, not cosmetic |
| Corner Store demo / live approval false | Persisted payments implemented; source approvals true; later dated live evidence exists | Current enablement remains unverified |
| No ranked ladder | Fade Park rank settlement exists | Stale activity copy, not a reason to invent match earnings |

The older “v2” simulator is historical context, **not a current oracle**.
Its runtime-parity assertion still assumes flat universal duplicates and is
not suitable as today's acceptance check. It was not rewritten to disguise
this mismatch.

## 2. Findings and priorities

Severity describes potential player/business impact, not demonstrated frequency.
“Confirmed” means source behavior or stale documentation is established.
“Design concern” means the behavior may be intentional. “Hypothesis” needs
measurement. No finding claims a live exploit or legal violation.

| ID / type | Severity / confidence | Evidence | Impact | Recommended action |
| --- | --- | --- | --- | --- |
| A01 · confirmed boundary mismatch | High / high | [Fulfillment and conversion graph](paid-boundary.md#money-and-conversion-graph) | Paid Clout reaches cards, XP, moves and randomized gameplay | Move only future sales to disjoint deterministic cosmetics after approval; retain truthful legacy disclosure |
| A02 · confirmed indirect route | High / high | [Pack eligibility/exhaustion](../../artifacts/api-server/src/lib/collectionEconomy.ts), [boundary design](paid-boundary.md#recommended-boundary-design-and-safe-transition) | Paid ownership of pack variants can bring forward the 25-Clout exhausted bonus | First wave must not touch `ownedVariants`; later designs need disjoint IDs or proven conversion isolation |
| A03 · confirmed paid chance exposure | High / high | [Stockz](../../artifacts/api-server/src/lib/stockz.ts), ledger Stockz distributions | Fungible purchased Clout can be staked and returned as gameplay-spendable Clout | Exclude Stockz structurally from future paid value; specialist policy review before any new design |
| A04 · confirmed historical drift | High / high | Generated ledger, current model and historical comparison above | Old pacing understates current finite/recurring income and misprices tier cosmetics | Use this versioned baseline; never silently revise historical promises/fixtures |
| A05 · design concern | Medium / high | [Persisted online settlement](modes.md#persisted-completion-matrix) | Online-first players gain rank but no match currency/XP or Growth battle progress | Explicitly disclose current mode rewards; owner decides progression parity before implementation |
| A06 · design concern | Medium / high | Ledger starter/Road; simulation tier targets | Immediate Road claims and restricted shards can make progression labels or aggregate wallet totals misleading | Keep separate balances and show matching affordability; measure redemption before repricing |
| A07 · design concern | Medium / high | Ledger promo catalog: KYLE/CITYLEGENDS | 60,000 Clout +25 tickets jointly dwarf organic play | Separate promo cohorts; review future availability without confiscation |
| A08 · design concern | Medium / high | [Rank surrender/bot fixtures](modes.md#completion-quits-clocks-and-retries) | Immediate forfeits and repeat bots award rank; 184 pure bot wins can exceed 2,200 RP | Decide bot ceiling/competitive eligibility; do not infer actual abuse |
| A09 · confirmed accounting limitation | Medium / high | [Refund/dispute graph](paid-boundary.md#money-and-conversion-graph) | A refunded fulfilled order keeps Clout; remaining paid units cannot be inferred from one mixed wallet | Keep legacy approved support review; use item-level provenance for future cosmetics |
| A10 · confirmed documentation conflict | Medium / high | Payment operations versus dated verification/source flags | Contradictory prelaunch statements can mislead operators | Use dated evidence hierarchy; reconcile operational documentation separately from activating anything |
| A11 · confirmed disclosure gap | Low / high | Shop detailed odds versus short Rare+ headline | Guarantee may be mistaken for a new card | Repeat “may be a duplicate” at commitment; detailed numeric odds currently match |
| A12 · hypothesis | Medium / low | Multiple daily claims, finite catalogs, modeled balances | Claim fatigue, future cosmetic saturation, willingness to pay are unknown | Privacy-safe cohort measurement and small approved experiment, not revenue forecasts |

Additional low-severity ledger notes cover dormant `cosmeticCurrency`, pack-key
retry semantics and stale activity text. Each companion finding records its
evidence, impact, severity, confidence and action. They are not separate
authorizations to fix runtime code.

## 3. Currency and progression summary

| Track | Earn/use boundary |
| --- | --- |
| Clout (`softCurrency`) | Matches in eligible solo modes; claims/story/promos/mail/payments/pack rebates/Stockz. Buys both gameplay and cosmetics/convenience |
| Tickets | Claims/story/promos/mail/shop; one pack or ten tickets for ten packs; no ten-ticket discount |
| Universal Style Shards | Bonus slots, finite duplicate promises, claims/promos/mail. Can cover any eligible cosmetic shortfall |
| Common / Uncommon / Rare / Epic / Legendary / Mythical shards | New pack duplicates pay 5/8/12/20/40/80. Super Common uses Common wallet; no cross-tier exchange |
| Account XP/level | Match + welcome + authored `street-xp`; level = 1 + floor(XP/250), no designed cap. Every tenth level has a separate 250-Clout/one-ticket/50-universal-shard claim |
| Card XP/level/move tiers | Owned participants only; 30/25/20 XP per solo W/D/L, cap 4,500/level 10. Bought XP and coaching are gameplay progression |
| Street Rep | 8/4/2 per eligible W/D/L and five welcome Rep; identity/display. No debit or admission threshold found |
| Fade Park RP/rating | Ranked settlement only; separate from Rep, XP and wallet. Human RP +25/+5/−15, bot +12/+2/−6, floor zero |
| Dormant `cosmeticCurrency` | Persisted/serialized, no active issuance or spending located; **not** a ready premium currency |

Account level 10 starts at 2,250 XP: about 58.4 reward-bearing mixed-outcome
matches at 38.5 XP/match before welcome/story. Subsequent ten-level milestones
need another 2,500 XP (~64.9 such matches). These are rate equivalents, not
measured playtime or guaranteed stopping counts. Account level otherwise serves
identity in the audited mode paths; it is not a card move prerequisite.

Card levels 1–10 require total XP
**0, 100, 300, 600, 1,000, 1,500, 2,100, 2,800, 3,600, 4,500**.
The move gates are:

| Goal | Card XP prerequisite | Additional coaching Clout, cumulative | Continuously participating mixed-match rate |
| --- | ---: | ---: | ---: |
| Tier I, level 2 | 100 | 100 | 3.92 matches |
| Tier II, level 5 | 1,000 | 350 | 39.22 matches |
| Tier III, level 8 | 2,800 | 850 | 109.80 matches |
| Card level cap | 4,500 | No extra fee to level; 850 for all moves | 176.47 matches |

At 60% actual participation those XP match equivalents divide by 0.6;
at 80%, divide by 0.8. A card left in hand receives no XP. Natural XP does not
automatically purchase new move tiers, except preserved legacy missing-tier
normalization. Snapshots freeze upgrades at match start. Current online and
fair/neighborhood/draft/boss combat normalize upgrades; standard PvE uses them.
Owned roster choices still matter online.

Training is 100 Clout for 100 XP or 225 for 250, prorated **only near the cap**.
Eighteen intensive purchases reach cap from zero for **4,050 Clout**; all moves
add **850**, total **4,900**. Spending 400 on a reaction instead buys neither a
400-Clout recruit nor two singles, and delays that training budget. Buying 1,800
in ten-pull access displaces 4.5 character reaction packs. These are opportunity
costs in the shared wallet, not proposed paid offerings.

## 4. Earning, caps and mode consequences

The [full mode matrix](modes.md) is authoritative for whether a match reaches a
persisted payout. Standard solo W/D/L is **80/60/40 Clout, 50/35/25 account XP,
8/4/2 Rep, zero tickets**, plus eligible participant card XP. Tutorial is zero;
welcome is separate. Story replay pays the standard new-match reward, but not
its finite first-clear reward twice. Arcade draws pay zero across progression;
wins/losses use standard payouts, with two UTC entries and no extra chain purse.
An incomplete solo exit is not a payable loss.

Friendly online pays **zero** wallet/XP/Rep/rank. Ranked humans and bots pay
**rank only**, including active surrender/timeout; friendly rematches remain
rewardless and ranked rematches are refused. Guests/offline earn no persisted
account rewards. Do not apply `battleEarnings()` to all modes by analogy.

Seven fully qualified consecutive days can add **3,750 Clout, five tickets and
50 universal shards before match payouts**: check-in 1,000/2/25, daily shop
350, daily mission pairs 1,750, weekly mastery 300, five-match weekly two
tickets, seven-plant garden 350/1/25. This is a qualification/claim boundary,
not a promise for a player who loses every match or misses days.

Login cycles over seven days; missing a day restarts its streak. Garden plants
persist across gaps and require that day's check-in plus verified show-up/win
mission progress; watering is explicit and once per UTC day. Missions expire
at UTC day/Monday boundaries; level milestones and finite story claims do not.
The first-login/new-player pair adds 350 Clout/four tickets; the new-player
window ends seven days after account creation. Rookie welcome + mission add
250 Clout/two tickets/100 XP/five Rep separately.

Current authored story totals: **14,450 account XP, 750 Clout, 118 tickets**,
plus up to **101 first-perfect tickets**, ordinary battle earnings, duplicate
compensation, level milestones and the separately gated Chapter-5-available
starter Mythic claim (Homeless Guy +1,000 Clout +three tickets). Solving or
skipping a puzzle grants its authored reward once. Chapter 2's Courier backfill
shares the historical claim identity: count it once.

Stockz has zero expected net income: up to five 10/25/50/100-Clout stakes per
UTC day, one unsettled round, 50/50 double-or-zero gross payout after eight
seconds. Five 100 stakes have possible net −500 to +500 with standard deviation
about 223.6 Clout if independently completed. Budget constraints change how many
rounds a poor wallet can actually start. No observed player behavior is implied.

Receipt retry protection and profile-lock usage were traced in source. The
new diagnostics do not claim to prove cross-connection serialization; existing
native PostgreSQL payment evidence remains a separate historical result.

## 5. Gacha and pacing

See [generated numeric tables](results-summary.md) and the
[model assumptions](simulation-notes.md) for exact sample counts and outputs.
All random pack outcomes run the current pure production generator, not the
old flat-shard simulator.

- Five gameplay slots have base rarity odds **40/20/25/12/2/0.8/0.2%**.
  Rare+ is **15% per slot**, **55.6295% per single pack**.
- Ten pulls naturally contain Rare+ **99.9704%** of the time; a fallback makes
  it **100%**, but a duplicate satisfies this guarantee. Only the last gameplay
  reward is replaced; its prior debit/grant accounting is removed and the bonus
  survives. Fallback weights are Rare/Epic/Legendary/Mythical **80/15/4/1**.
- Slots one and two prefer an unowned card **within the rolled rarity only**.
  This is neither a guaranteed new card nor cross-rarity promotion. Within-pack
  avoidance of repeated card IDs is not protection against already-owned cards.
- Featured style is nominally 5%; eligible style pity forces the tenth pack.
  Its renewal mean is **8.0253 packs**, effective long-run style share **12.4607%**
  while the pool remains nonempty. Pity overrides ordinary bonus probabilities.
  A fresh ten-pull guarantees at least one eligible style, not a particular one.
- Style pool is **615 finite variants**, selected unowned without gameplay-card
  ownership being required for the drop; equipping/crafting checks ownership.
  Exhausted featured rolls pay **25 Clout**, never a new style. Pity resets.
- Complete ownership's ordinary slots produce expected matching balances
  **15 Common, 10 Uncommon, 7.2 Rare, 2 Epic, 1.6 Legendary, 0.8 Mythical per pack**.
  Add universal bonus separately; there is no 36.6-universal-shard income.
- With only one Mythical missing, its single-pack chance is about **0.42948%**:
  p50/p95 acquisition **162/697 packs**, no finite gameplay-card guarantee.
  This is a near-complete case, not a new player's full-collection forecast.

Nominal versus pity-adjusted bonus values, per-tier effective ten odds, named
card tails, finish affordability distributions, style exhaustion and coupled
wallet journeys are recorded in machine-readable results. Expected value is
not a guaranteed minimum. p05/p50/p95 are outcome quantiles, not confidence
intervals. All model session counts assume two/six matches per active casual/
engaged session; **session minutes are unmeasured**.

The first-session/7/30-day grid separates new/mid/near/complete collection states,
casual missed logins, engaged play, online-only settlement and save/pack/training
priorities. Mature collection scenarios deliberately start with zero incremental
wallet/XP and prior onboarding claims consumed, not purported live-player
balances. Organic models exclude purchased/promotional money and generic mail.
The finite campaign scenario is an explicit upper-content path, not average
seven-day play. No pack rebate makes opening packs a positive-Clout loop:
the maximum 50-Clout bonus is below even the 180-per-pack bulk cost.

## 6. Cosmetic-only commercial recommendation

**Choose direct exact entitlements**, not paid Clout, paid shards, randomized
cosmetic packs, paid progression or convenience. A separate nonconvertible
cosmetic wallet could work, but adds balance/refund complexity and unused-value
friction without first-wave benefit. Existing dormant `cosmeticCurrency` is not
evidence that these boundaries already exist.

The [ranked seven-category proposal](paid-boundary.md#ranked-first-wave-hypothesis-not-approved-prices)
covers reactions, finishes/alternate art, profile banners/frames/backgrounds,
deck presentation, effects and deterministic seasonal collections. Each entry
states player value, a **USD-per-item/bundle hypothesis**, earned availability,
content/implementation cost, repeat-purchase limits and accessibility constraints.
Only two products are recommended for first-wave evaluation:

1. **Four-reaction character pack — $1.99 USD hypothesis**, existing 400-Clout
   earned route retained. Exact permanent contents, no character required.
2. **One owned character's scene + signature stickers + Silver Lining bundle —
   $2.99 USD hypothesis**, current 280-shard earned route retained. Do not grant
   the character or sell the free base banner/avatar/deck cover.

No claim of “optimal” pricing or revenue is made. A sustainable proposal requires
new desirable art, not charging again for the same owned item. Prefer optional
evergreen additions and small themed collections; avoid false scarcity, rental,
consumable reactions, paid streak repair or reward tracks carrying gameplay value.

**Strict indirect-boundary rule:** first-wave unlocks belong to the separate
signature/reaction entitlement catalog. They must not remove variants from the
gameplay pack's eligible pool. Later finishes/alternate artwork should use new
disjoint cosmetic IDs. Selling existing pack-eligible finishes, even directly,
can accelerate the Clout exhaustion fallback and is therefore **not approved by
this proposal** without a proven non-converting redesign.

For any product, paid/free equip must leave combat state, information visibility,
input windows, turn timers and animation duration unchanged. Preserve rarity
labels/frames, contrast and readable silhouettes; no visual concealment or
opponent-forced effects. Free mute/hide and reduced-motion/static alternatives
remain available. Collection previews must clearly show exact contents.

### Safe transition, if separately approved

- Set a prospective end to new Clout sales only after replacement/policy approval.
  Do not disable settlement for existing orders or cancel promised grants.
- Preserve every Clout balance, prior ownership, receipt, pity and story promise.
  Do not reconstruct remaining purchased Clout or rarity balances from old logs.
- Honor pending legacy orders at their immutable quote. State **“new purchases
  are cosmetic-only”**, not “the whole legacy economy has always been cosmetic-only.”
- For new products, retain item/order provenance, reject duplicate buys, and
  return refunds as provider money under approved policy—not Clout, tickets,
  XP, shards feeding conversions, free cards or random replacement rewards.
  Never revoke an independently earned entitlement.
- A future cosmetic wallet, if chosen instead, needs a deterministic allowlist,
  no transfers/gifts/exchange to existing currencies, no Stockz, no convenience,
  and no exhausted-pool compensation into gameplay. Refund only original money/
  eligible cosmetic units with exact provenance. No automated negative gameplay
  wallets or reinterpretation of old receipts.

These are proposed design constraints, not instructions to operate payments.
Current checkout availability remains unverified.

## 7. Decision roadmap and proposed numerical targets

These are **candidate acceptance targets**, not rebalance approvals.

| Priority | Keep/change/investigate | Proposed target and reason |
| --- | --- | --- |
| P0 | Change future paid boundary | Zero reachable paid→Clout/ticket/card/XP/move/rank/convenience/Stockz paths, including exhaustion and refunds; require graph/fixture proof before release |
| P0 | Keep legacy promises | 100% historical receipt/balance/ownership preservation; no balance reconstruction or confiscation |
| P1 | Evaluate two-product first wave | Exact two product families; initial $1.99/$2.99 USD hypotheses, earned routes unchanged; verify entitlement usefulness before adding a wallet |
| P1 | Decide online progression | Explicit owner choice between rank-only disclosure and separately designed earned progression; do not silently assume equal payouts |
| P1 | Investigate cosmetic pacing | Candidate target: one chosen 400-Clout reaction within 1–3 returning engaged sessions, one ordinary chosen finish within 1–2 engaged weeks, measured per tier—not aggregate shards |
| P1 | Keep competitive accessibility | 0 changes to combat state/timing/information; free mute and static equivalent for every animated paid item |
| P2 | Evaluate supply cadence | Trial ceiling of 1–2 new cosmetic collections/month only if content cost and demand support it; no claim this cadence is profitable |
| P2 | Evaluate rank integrity | Owner decision on bot point ceiling/surrender eligibility; measure result reasons before changing deltas |

The reaction target is generous relative to first-session one-time grants and
must be measured on **returning organic** accounts separately. High-tier finish
tails and online-only income can violate a simple time target; that is a reason
to measure/discuss, not automatically increase rewards. Short-lived promo wallets
must never determine organic price tuning.

Missing telemetry: mode/outcome/active duration; actually played card count;
claim eligibility versus claim completion; earned/purchased/promotional inflows
separately; sink and shard-tier redemptions; eligible style pool remaining;
permanent item acquisition/equip/use; bot/timeout/forfeit settlement; refund
resolution and attributable paid entitlements. Aggregate by coarse cohort and
date, minimize stable identifiers, exclude raw dialogue/payment PII and apply
retention/access limits. Existing collection-reward and reaction-use follow-ups
already cover parts of this measurement; this audit ships no analytics system.

Owner approvals needed: commercial boundary/cutoff and legacy policy; online
progression intent; organic goal cadence by tier; first-wave assortment and USD
experiments; content budget/cadence; age/region/tax/refund specialist review.
No profitability, conversion, retention, abuse or legal-compliance conclusion is
supported by the source alone.

## 8. Reproduce and verify

From repository root, no database/provider credentials required:

```sh
node --import tsx scripts/src/economy-current-ledger.ts --check
node --import tsx scripts/src/economy-current.ts --iterations=10000 --journeys=100
node --import tsx --test scripts/src/economy-current.test.ts scripts/src/economy-current-ledger.test.ts scripts/src/economy-current-modes.test.ts
pnpm --filter @workspace/scripts typecheck
node scripts/render-economy-audit.mjs
```

Seed `0x185c0ffe` (408686590). Generated source hashes detect current-rule drift;
HEAD is recorded as run metadata, not silently treated as the frozen old economy.
To intentionally refresh the source ledger, review the differences first and run
`node --import tsx scripts/src/economy-current-ledger.ts --write-ledger`.

See [verification record](verification.md) for final executed commands, results,
unchanged-runtime proof and known limits. The downloadable HTML embeds readable
sections and machine-readable evidence; it is not a new application or store.