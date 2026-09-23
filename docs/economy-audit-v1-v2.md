# Squabblemon progression economy audit: frozen v1 baseline and finalized v2

This is a source audit and deterministic model, not a live-account audit. It does
not infer player behavior, payment conversion, or developer abuse. The v1 column
reproduces the immutable pre-rollout fixture at revision
`e3069d1437f23412743a1811a6d2a9ff9459f4a1`; v2 reads the finalized shared
rules. Existing balances, ownership, claims, pity, and story saves are not
converted.

## Reproduce

```sh
node --import tsx scripts/src/economy-audit.ts --iterations=100000
node --import tsx --test scripts/src/economy-audit.test.ts
```

Seed: `0x5a17c0de` (`1511506142`). Each pack-state experiment uses 100,000
independent accounts so collection state does not drift during a one-pack
scenario. The v1 fixture records the source revision and five Git blob hashes
in `scripts/src/economy-audit.ts`; it never resolves `HEAD`, so committing the
audit cannot silently turn v2 into its own “before” state. V2 welcome and mission
amounts are imported from the shared browser-safe economy exports.

| Frozen source | Git blob |
| --- | --- |
| [`lib/squabblemon-engine/src/economy.ts`](../lib/squabblemon-engine/src/economy.ts) | `ff763626f593dcde70ea67029217a9bdacb9a8a2` |
| [`artifacts/api-server/src/lib/collectionEconomy.ts`](../artifacts/api-server/src/lib/collectionEconomy.ts) | `0b2421e5085102914b157dd36f2105eb249dcc8b` |
| [`artifacts/api-server/src/lib/playerState.ts`](../artifacts/api-server/src/lib/playerState.ts) | `dbbcc5724f128bf7066ffbafeeb6d64fe207d004` |
| [`lib/squabblemon-engine/src/data.ts`](../lib/squabblemon-engine/src/data.ts) | `a4b1b8c19c82b9c2757c666aa4b9dc67e3ff60bd` |
| [`lib/squabblemon-engine/src/seasonTwo.ts`](../lib/squabblemon-engine/src/seasonTwo.ts) | `c7a7dd05ce08e813865d516ecee7d2fe0d0b405f` |

## Recommendation in one table

| Rule | Frozen v1 | Finalized v2 | Pacing reason |
| --- | ---: | ---: | --- |
| Verified fade Clout, W/D/L | 40 / 30 / 20 | **80 / 60 / 40** | A 50/10/40 outcome mix moves a 200-Clout pack from 6.45 to 3.23 matches. |
| Profile XP, W/D/L | 50 / 35 / 25 | 50 / 35 / 25 | Keep account identity separate from wallet rebalance. |
| Rep, W/D/L | 8 / 4 / 2 | 8 / 4 / 2 | No evidence supports changing reputation pacing. |
| Participating-card XP, W/D/L | 30 / 25 / 20 | 30 / 25 / 20 | Keep character growth stable while coaching prices fall. |
| Pack / ten-pull | 200 / 1,800 Clout | **200 / 1,800** | 10% bulk discount remains; increased play income supplies access. |
| Coaching I / II / III | 150 / 400 / 900 | **100 / 250 / 500** | 1.25 / 3.13 / 6.25 wins at v2, versus 3.75 / 10 / 22.5. |
| Pack / Collection Road duplicate card | 25 shards | **5 shards** | Removes the automatic 125-shard floor from a complete-collection pack. |
| Finite story reward duplicate card | 25 shards | **25 shards** | Preserve the authored, already-issued story reward promise; this is intentionally not the repeatable pack rate. |
| Bonus shards | 15/25/40 at 70% | **5/10/15 at 30%** | Makes cosmetics goals rather than overflow disposal. |
| Bonus Clout | 50/100 at 25% | **25/50 at 65%** | Average pack rebate rises from about 19 to 24 Clout without becoming a positive loop. |
| Featured style | 5%, style pity at 10 | **same** | Preserve the clearly separate cosmetic pity. |
| Base rarity weights | 40/20/25/12/2/.8/.2 | **same** | Preserve tier odds; fix selection semantics instead. |
| Rare+ fallback | rarest missing first | **Rare/Epic/Legendary/Mythical 80/15/4/1; card uniform within tier** | Stops a guarantee from preferring Mythical without turning ownership into hidden protection. |
| Major story node | 10 tickets | **2 tickets** | Reduces all-story authored tickets from 100 to 42. |
| Starter ownership | 21 cards | **10-card playable mentor core** | Onboarding remains playable without pre-completing collection goals. |

Rarity order in the table is Super Common, Common, Uncommon, Rare, Super Rare
(`Epic` persisted identifier), Legendary, Mythical.

## Complete source ledger

### Repeatable earns

| Source | What is earned | Claim/repeat behavior | Authority |
| --- | --- | --- | --- |
| Verified saved practice/story/eligible modes | v1 W/D/L: 40/30/20 Clout, 50/35/25 profile XP, 8/4/2 Rep; zero tickets | Per server-verified completion; a completed match returns its stored receipt | [`lib/squabblemon-engine/src/economy.ts`](../lib/squabblemon-engine/src/economy.ts), [`artifacts/api-server/src/routes/player.ts`](../artifacts/api-server/src/routes/player.ts) |
| Participating owned cards | W/D/L: 30/25/20 card XP per distinct actually played card, capped at 4,500 XP / level 10 | Per verified completion; cards left in hand get none | [`artifacts/api-server/src/lib/cardProgression.ts`](../artifacts/api-server/src/lib/cardProgression.ts), [`lib/squabblemon-engine/src/cardProgression.ts`](../lib/squabblemon-engine/src/cardProgression.ts) |
| Daily Show Up | 100 Clout for one completed fade | Daily, explicit claim, midnight UTC reset | [`artifacts/api-server/src/lib/playerState.ts`](../artifacts/api-server/src/lib/playerState.ts) |
| Daily Take A Room | 150 Clout for one win | Daily, explicit claim | same |
| Weekly Main Character | 2 tickets for five completions | Weekly, explicit claim, Monday UTC reset | same |
| Weekly Clear the Air / Make Room / Try Something New | 100 Clout each | Weekly, one qualifying verified fade each | same and [`lib/squabblemon-engine/src/career.ts`](../lib/squabblemon-engine/src/career.ts) |
| Packs | Card unlocks, duplicate shards, style or shard/Clout bonus | Costs currency/ticket; cryptographic production RNG | [`artifacts/api-server/src/lib/collectionEconomy.ts`](../artifacts/api-server/src/lib/collectionEconomy.ts), [`collectionTransactions.ts`](../artifacts/api-server/src/lib/collectionTransactions.ts) |

Challenge Arcade has no extra chain purse, entry charge, or settlement jackpot.
Its non-draw encounters use ordinary verified-match earnings; a challenge draw
is explicitly zero reward and does not advance the run. There are two free
entries per UTC day. Source:
[`artifacts/api-server/src/routes/challenge.ts`](../artifacts/api-server/src/routes/challenge.ts),
[`playerRewardTransactions.ts`](../artifacts/api-server/src/lib/playerRewardTransactions.ts).

### One-time and finite earns

| Source | Reward | Notes |
| --- | --- | --- |
| First collection grant | 21 owned cards at v1: mentor + ten-card core + ten City cards; one saved gang | Granted during onboarding; v2 grants only the ten-card playable mentor core. [`data.ts`](../lib/squabblemon-engine/src/data.ts), [`playerRewardTransactions.ts`](../artifacts/api-server/src/lib/playerRewardTransactions.ts) |
| Welcome claim | 250 Clout, 1 ticket, 100 profile XP, 5 Rep | Requires the Rookie gang practice completion; idempotent profile flag. |
| Rookie Road mission | 1 ticket | Separate explicit one-time mission claim, so welcome + mission stack to two tickets. |
| Career experiment milestones | Up to three chosen unowned Common cards | Cleanse, movement-win, changed-crew each create one choice; not currency. [`career.ts`](../lib/squabblemon-engine/src/career.ts), [`playerRewardTransactions.ts`](../artifacts/api-server/src/lib/playerRewardTransactions.ts) |
| Character mastery | Cosmetic `mastery:<card>` at five wins with that played owned card | Per-card finite cosmetic; no wallet credit. Boss/draft/neighborhood activities can also unlock badges. |
| Collection road 7 / 9 / 12 / full | Closet Nerd; Live Streamer +50 shards; Techbro Rich +150 Clout; 2 deck slots +300 Clout | Duplicate milestone cards use the v2 5-shard collection rate. [`collectionEconomy.ts`](../artifacts/api-server/src/lib/collectionEconomy.ts), [`collectionTransactions.ts`](../artifacts/api-server/src/lib/collectionTransactions.ts) |
| First story clear | Authored profile XP/cards/cosmetics/characters/Clout/tickets | Stable claim keys; finite duplicate story cards intentionally retain the historical 25-shard issued promise. Descriptions render the amount stored on each claim. [`storyTransactions.ts`](../artifacts/api-server/src/lib/storyTransactions.ts) |
| First perfect story clear | 1 ticket for three stars on each battle | 81 possible tickets across current content, one claim per battle. |

Account XP uses `level = 1 + floor(xp / 250)` for welcome, match, and story
grants. Authored `street-xp` is persisted to the same profile `xp` field; it is
not Street Rep or card XP. This naming overlap should be corrected in display
copy, not by migrating balances.

### Spend and sink inventory

| Sink | v1 cost | Finalized v2 |
| --- | ---: | ---: |
| Practice Session, +100 card XP | 100 Clout | 100 |
| Intensive Training, +250 card XP | 225 Clout | 225 (retain; already better value) |
| Move Coaching I / II / III | 150 / 400 / 900 Clout | 100 / 250 / 500 |
| One pack ticket / one direct pack | 200 Clout | 200 |
| Ten-pull | 1,800 Clout or 10 tickets | same |
| Extra saved-gang slot, cap 12 | 350 Clout | 350 |
| Chosen unowned Common | 400 Clout | 400 |
| Tagged / Chrome variant | 80 / 140 shards | retain pending cosmetic cadence observation |
| Character scene / stickers / silver banner | 60 / 100 / 120 shards | retain |

Training near level cap is charged proportionally; no purchased XP is discarded.
Packs and shop purchases debit and grant atomically under the profile lock.

### Story and backfill inventory

The current 19 chapters contain 119 nodes, 81 battles, 11,250 authored profile
XP, and 750 authored Clout. The latter is only the Chapter 1 (250) and Chapter 2
(500) training-fund backfills with stable claim keys. The table includes every
season and special presentation:

| Chapter | Battles | Profile XP | v1 authored tickets | v2 authored tickets |
| --- | ---: | ---: | ---: | ---: |
| 1 Block Party | 7 | 775 | 10 | 2 |
| 2 Red Side Tapes | 6 | 1,075 | 11 | 3 |
| 3 Blue Side Blues | 3 | 290 | 10 | 2 |
| 4 Side Show | 7 | 865 | 10 | 2 |
| 5 Old Heads Know | 8 | 935 | 10 | 2 |
| 6 The Function | 3 | 350 | 10 | 2 |
| 7 Return of the Block | 8 | 955 | 10 | 2 |
| 8 The Crown | 9 | 1,310 | 10 | 2 |
| 9–15 Season Two chapters | 21 | 3,095 | 7 | 14 |
| 16 The Blockbuster | 3 | 425 | 3 | 2 |
| 17–19 Missing Motion specials | 6 | 1,175 | 9 | 9 |
| **Total authored** | **81** | **11,250** | **100** | **42** |
| Plus every perfect clear |  |  | **+81** | **+81** |
| **Maximum story tickets** |  |  | **181** | **123** |

Sources: [`story.ts`](../lib/squabblemon-engine/src/story.ts),
[`seasonChapters.ts`](../lib/squabblemon-engine/src/seasonChapters.ts),
[`seasonTwo.ts`](../lib/squabblemon-engine/src/seasonTwo.ts), and
[`storySpecials.ts`](../lib/squabblemon-engine/src/storySpecials.ts).
Chapter 2's extra ticket is the optional Courier Table backfill. The v2 season
two total treats each closing as a two-ticket major node; special rewards remain
2/2/5.

### Promo, guest, demo, and development exclusions

- **Promo claims are real account grants but excluded from normal pacing.**
  `KYLE` grants 25 tickets, 20,000 Clout, and Kyle; `CITYLEGENDS` grants 40,000
  Clout and seven cards. `DEVSTOCKZ`, `SIMMYFOODZ`, and other card drops are
  finite account grants. `DEVTEST`, `DEVTEST2`, and `JETSETCABIN` are
  development-only, but the large KYLE and CITYLEGENDS wallets are not
  environment-gated in v1. Every code is once per player. These are major
  outliers and must never be mixed into organic pacing samples.
  Source: [`promoCodes.ts`](../artifacts/api-server/src/lib/promoCodes.ts).
- **Guest/offline play saves no rewards.** A signed-in, server-issued, replayed
  match is the reward boundary.
- **E2E fallback is not an earn source.** It exposes all catalog cards, 500
  Clout, and 3 tickets only when disposable preview auth is enabled.
  Source: [`GameApp.tsx`](../artifacts/squabblemon/src/pages/game/GameApp.tsx).
- **Corner Store is a local demo wallet.** Its placeholder purchases and Clout
  never alter the account and collect no payment information.
  Source: [`CornerStore.tsx`](../artifacts/squabblemon/src/pages/game/CornerStore.tsx).
- **Development story reset grants nothing** and deletes development story
  rows; it is not a balance faucet.

## Seeded results

### Pack distributions

The catalog in this run has 158 cards: 9/37/20/31/18/23/20 by the rarity order
above. “Starter” uses 21 owned cards in v1 and 10 in v2. “Mid” owns a
rarity-stratified 81 cards. “Near complete” owns 157 cards and is missing one
Mythical (`guap`). “Complete” owns all 158 gameplay cards and still has eligible
styles.

| 100k one-pack scenario | v1 | v2 |
| --- | ---: | ---: |
| Starter new cards / pack | 4.275 | 4.438 |
| Starter Rare+ pack rate | 55.531% | 55.492% |
| Starter average shards / Clout bonus | 36.738 / 18.853 | 5.807 / 24.351 |
| Mid new cards / pack | 3.334 | 3.336 |
| Mid average shards / Clout bonus | 60.238 / 18.968 | 11.320 / 24.439 |
| Near-complete missing Mythical unlocked / pack | **100%** | **0.4%** |
| Near-complete average shards / Clout bonus | 118.570 / 18.997 | 27.952 / 24.427 |
| Complete average shards / Clout bonus | **143.573** / 19.006 | **27.992** / 24.375 |
| Complete shard p50 / p95 | 140 / 165 | 25 / 40 |
| Featured style rate | about 5% | about 5% |
| Directly exercised Rare+ fallback | 0/0/0/**100%** | **79.890/15.043/4.068/0.999%** |

For a complete collection, both versions retain the base card-roll distribution
(v2 measured 40.018/19.987/24.999/11.995/1.998/.806/.197%). The important v1
distortion is ownership-conditioned selection: with only a Mythical missing,
the first “new card” slot promotes every failed tier roll to that Mythical,
making every pack Rare+. V2 rolls rarity first, protects only within that tier
for slots 1–2, and does not cross tiers.

The v2 ten-pull fallback is also ownership-independent after rarity is rolled:
it selects uniformly from the entire chosen tier. An owned Rare can therefore
be selected and converted to 5 shards even when other Rare cards are unowned.
The simulator mirrors the runtime replacement exactly: v2 removes the final
gameplay slot (and reverses that slot's card/shard accounting), keeps the final
bonus, then applies the uniform-tier guaranteed card.

The five card slots naturally produce at least one Rare+ in roughly 55.6% of
packs. Rare+ is **15% per slot** (`12 + 2 + .8 + .2`), not 14%.
Consequently a ten-pull misses natural Rare+ only about
`(1 - .15)^50 ≈ 0.0296%` before same-pack details. The fallback distribution is
still specified and tested because v1's rarest-first rule is indefensible even
when infrequent.

### Journey scenarios

| Scenario | Assumptions | v1 | v2 |
| --- | --- | ---: | ---: |
| First session | Welcome claim; W/L/W; daily show-up + win claims; Rookie ticket claim; one perfect story clear | 600 Clout, 3 tickets, 275 profile XP | 700 Clout, 3 tickets, 275 XP |
| Seven-day casual | 14 fades: 8W/2D/4L; both daily claims every day; all three weekly 100-Clout mastery missions; weekly five-fade claim; includes first-session perfect clear | 2,760 Clout, 5 tickets | 3,220 Clout, 5 tickets |
| Repeat-only | 100 fades: 50W/10D/40L; excludes claims, packs, story, and onboarding | 3,100 Clout | 6,200 Clout |
| All story + every first perfect | All 19 current chapters, no repeat match payout included | 181 tickets | 123 tickets |

These are boundary scenarios, not retention forecasts. First-session and
seven-day totals intentionally expose one-time stacking. They assume every
listed mission is explicitly claimed before reset. Pack rebates are excluded
from journey Clout to avoid pretending that opening a pack is guaranteed income.

### Spending earned tickets and claiming collection milestones

The journey simulation also claims every eligible Collection Road reward and
then spends earned tickets (ten-pulls first, singles for the remainder).
Collection Road itself immediately chains from a legal starter: thresholds
7/9/12 grant three cards—two Rare and one Legendary—plus 50 shards and 150
Clout. “Final Clout” below is gross earned Clout plus the road grant and pack
rebates; no earned Clout is spent. Values are means over 100,000 runs, except
all-story at 2,000 runs.

| Ticket journey | v1 actual acquisition | v2 actual acquisition |
| --- | --- | --- |
| First session, 3 singles | 14.921 new cards; 5.045 Rare+; 1.144 Legendary+; 182.949 shards; 806.405 final Clout | **15.368 new cards; 5.121 Rare+; 1.143 Legendary+; 72.221 shards; 922.927 final Clout** |
| Seven days, 5 singles | 21.754 new cards; 6.668 Rare+; 1.390 Legendary+; 299.427 shards; 3,003.836 final Clout | **22.028 new cards; 6.504 Rare+; 1.241 Legendary+; 94.900 shards; 3,492.005 final Clout** |
| All story/perfect tickets | 181 packs complete all 158 cards; 22,446.943 shards | 123 packs end at **114.596 / 158 cards**; 104.596 new; 46.596 Rare+; 2,957.398 shards |

Every starter journey reports a Rare+ because the finite road claims include
three Rare+ cards; it is not a claim that random packs are guaranteed Rare+.
Subtracting those road cards, v2's first-session tickets yield about 2.121 new
random Rare+ cards on average. The all-story row deliberately demonstrates the
largest finite ticket stack rather than a normal session.

## Numeric pacing targets and decision

The finalized v2 baseline meets these acceptance ranges:

1. **Ordinary pack:** 3–5 repeat-only verified fades at a representative mixed
   outcome rate. V2 is 3.23; v1 is 6.45.
2. **Move coaching:** tier I in 1–2 wins, tier II in 3–5, tier III in 6–8,
   excluding missions. V2 meets all three. Keep level prerequisites 2/5/8, so
   card XP—not only Clout—still gates the moves.
3. **Cosmetic:** at complete collection, roughly 3 packs for 80-shard Tagged,
   4 for a 100/120-shard signature item, and 5 for 140-shard Chrome at the
   measured 28 shards/pack. The v1 complete player earned a Chrome finish in
   about one pack.
4. **Rare acquisition:** card-slot odds remain **15% Rare+**, 1% Legendary+,
   and .2% Mythical per slot before ownership effects. That is about one random
   Rare+ every 1–2 packs, one Legendary+ every 20 packs, and one Mythical every
   100 packs before ownership effects. A three-ticket starter session should
   normally add 1–3 random Rare+ cards; the finite road additionally grants
   2 Rare + 1 Legendary. Tier-local protection may
   improve “new” rate only when that rolled tier has missing cards. It must
   never convert a Common roll into a high-tier unlock.
5. **Tickets:** one pack per ticket; one ticket per first perfect battle; two
   tickets at future major nodes. A full current campaign still yields 123
   tickets, so do not add another chapter-wide ticket faucet without rerunning
   this model.
6. **Starter:** exactly one legal ten-card crew. Story, collection road, packs,
   experiment choices, and recruitment then remain meaningful.
7. **Character XP:** a character that participates in every fade reaches level
   2 at about 4 mixed-result matches, level 5 at 39, level 8 at 110, and the
   4,500-XP level-10 cap at **150 wins or 176.47 mixed-result matches**. At
   14 participating matches/week that is about 12.6 weeks. Buying only
   Intensive Training requires 18 purchases / 4,050 Clout; v2 repeat income is
   about 65 mixed matches if every Clout is spent on that one character.

### Outliers and rollout cautions

- Promo wallets dwarf every organic scenario and need a separate cohort flag
  in any later economy analysis.
- V2 rollout is prospective-only: do not debit legacy shards, remove cards, reset pity, or
  rewrite prior story claims. Stable reward keys and issued match economy
  snapshots must decide old receipts.
- A full-collection account still receives about 28 shards per pack. Cosmetic
  supply is finite, so exhausted-style conversion needs truthful UI and later
  observation; do not silently create another currency.
- Profile XP currently has no cap and repeats a linear 250-XP level formula.
  This audit recommends centralizing that formula but not changing historical
  levels in the same rollout.
- No payment implementation or real-money bundle tuning is included.

## Verification evidence and limits

- Workspace library, API, browser, and scripts typechecks pass.
- Isolated PGlite API suite: 145/146 passed on the full run; the remaining
  campaign fixture used a card no longer granted at onboarding. After changing
  it to the actual ten-card starter, its targeted test passed through every
  campaign node. No live database was used or modified.
- Nine gacha tests pass, including rarity boundaries, missing tiers, ownership,
  pity, guarantee replacement, reward accounting, and 100,000 seeded rarity
  observations with six-binomial-standard-error tolerances.
- Seven audit tests pass, including an owned-card guarantee draw while same-tier
  cards remain unowned and direct seeded parity with runtime single-pack state
  plus forced ten-pull replacement accounting. The frozen baseline survives commits.
- Browser journey passes in Chromium desktop and emulated phone: account-level
  completion, claim, training purchase, refresh, exhausted styles, and versioned
  ten-pull history. Sign-in and API responses are explicitly mocked; actual
  server verification and concurrent mutations are tested separately in PGlite.
- The browser unit suite initially passed 555/564. Seven affected gacha/story
  expectations were corrected and their focused suites passed (30 gacha-related
  tests and three ticket tests). Two unchanged combat tests still assume 19
  Mythicals/141 characters rather than the current 20/148; combat tuning is out
  of scope. Neither combat assertions nor card power were changed.
- Saved screenshots: [phone account goal](economy-evidence/account-goal-phone.png)
  and [desktop training after refresh](economy-evidence/training-refresh-desktop.png).
- The API and web workflows restarted successfully and the normal landing-page
  preview rendered. Browser console showed the expected Clerk development-key
  warning; test Vite logs also warn about existing `/public/` asset paths.

Rollback must retain persisted receipts and claims. Missing economy-version
snapshots use legacy payouts; new matches carry the revised version. This is
not authorization to roll database balances or story state back.