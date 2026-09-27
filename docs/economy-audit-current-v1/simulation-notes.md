# Current-rule simulation: methods and limits

This is a source-grounded counterfactual model, not telemetry, a live-wallet audit,
a revenue forecast, or a proposed economy migration. It does not change runtime
rules. Historical `economy-audit.ts` and its frozen v1 fixture remain untouched.

## Reproduce

From repository root:

```sh
node --import tsx scripts/src/economy-current.ts --iterations=10000 --journeys=100
node --import tsx --test scripts/src/economy-current.test.ts
pnpm --filter @workspace/scripts typecheck
```

Seed: `0x185c0ffe` (408686590). The JSON records Git HEAD and SHA-256 hashes of
direct rules/model inputs. Baseline HEAD is
`5f86e9608f28e48f22879cf5fc5aa61ee1c7b654`. Re-running after a commit intentionally
changes source metadata. It does not silently relabel this as the frozen historical
baseline. The 10,000-pack/100-journey run takes about 30 seconds in this workspace.

All Street Pack and ten-pull outcomes invoke **the actual pure production
generators** in `collectionEconomy.ts`, with deterministic integer RNG injection.
No database, API request, account credentials, or payment provider is involved.
JSON keys `universal` and `matching` must never be summed and reported as a
universally spendable cosmetic wallet.

## Experiments

- Each independent single/ten-pull trial starts from the specified collection,
  zero pity, no styles, and zero wallet. New is the exported **24-card foundation
  ownership union**, not the ten-card saved mentor crew; mid owns
  every other card within each tier; near lacks the first catalog Mythical;
  complete owns all gameplay cards. These are **collection states**, not inferred
  player tenure or balances.
- Per-tier natural slot/pack/ten probabilities are analytical. Effective ten
  probabilities include the last-gameplay-slot replacement, including loss of a
  sole low-tier card. Seeded tables count duplicates as gameplay rarity results,
  not as new unlocks. `newPerHaul` and protected-slot rates measure acquisition.
- Specific-card tails are geometric across independent singles: one already-owned
  named card in a complete collection, and the sole missing card in a near-complete
  tier. Tails give packs to first occurrence/acquisition at 50/90/95/99%.
  The latter remains missing until success, so the hazard stays constant.
  Formula assumes at least five cards in every tier; a regression test enforces it.
  These are not the tails for acquiring every card or a named card among many
  missing cards.
- Cosmetic pity uses its exact truncated-geometric renewal expectation. Nominal
  5% is **not** long-run effective style probability. Receipt diagnostics directly
  force pity, exhausted style pool, and ten-pull fallback. Exhausted styles become
  Clout and reset pity; there is no shard conversion or gameplay-card pity.
- `styleLifetime` separately simulates every style's independent truncated
  geometric waiting time until the finite pool is exhausted (no direct crafting).
  It reports exhaustion quantiles, analytical mean, exact ten-from-zero expected
  bonus amounts, nominal/first-pack rates, steady-state eligible rates and
  post-exhaustion rates. This is not a claim that steady state persists after all
  styles are owned.
- Finish targets run 500 sequential independent complete-collection accounts per
  tier/price, carrying actual pity, styles and all shard currencies forward.
  They measure **craft affordability**, not necessarily time to own that finish:
  the bonus can award the desired finish earlier. Universal shards plus one matching
  tier pay the cost. All other tier balances are reported as unavailable for that
  target, not globally worthless. No cosmetic purchase competes for these balances.

## Journey assumptions (explicit, not measured behavior)

Each 1/7/30-day horizon starts Monday UTC. The first-session horizon has three
matches; longer horizons have two matches per active day for casual and six for
engaged. Casual skips Wednesday/Saturday and resets the login streak; engaged
logs in every day. Thus seven-day casual has five sessions/ten matches, while
engaged has seven sessions/42 matches. Longer horizons are independent scenarios,
not continuations of the three-match first-session experiment.

Reward-bearing matches use 50% wins, 10% draws, 40% losses. One tracked owned
character actually participates in 60% of casual/80% of engaged matches; cards
left in hand earn no XP. Account XP and that character's XP are reported separately.
Card XP is capped; account XP determines newly crossed ten-level milestone claims.
Mid/near/complete start at account XP zero **for incremental modeling only**, with
all earlier onboarding/road claims considered used. Their actual historical
profile levels would change milestone timing.

Every active day claims the daily shop's 50 Clout and current streak login reward.
New cohorts claim the separate new-player and first-login grants and take the fixed
Dr. Fade welcome opening **before** any random opening. This costs no ticket and
awards five universal shards when already owned. `opened` counts only random packs.
New reward-bearing cohorts also complete the qualifying Rookie practice/crew flow,
claim its welcome reward and Rookie mission. The zero-progression-online scenario
does not assume that offline qualification.

Show-up and win missions are claimed on qualifying days. Five verified matches
claim the weekly ticket reward once per Monday-aligned week. Engaged players
deliberately qualify cleanse on the first active day and changed-crew on the third.
Movement qualification begins on the second active day and is claimed only on a
day with a win; failed attempts retry later in that week. Casual claims none of
these mastery missions. This is an explicit action
assumption, not something awarded for every generic match. Growth is watered only
on active days with a win and claimed check-in; every seventh plant pays its
authored garden reward. No streak-preserving rescue is assumed.

Eligible new-cohort Collection Road rewards are claimed recursively, including
their authored universal duplicate compensation. Earned tickets are spent at
each day's end, ten at once when available and singles otherwise. Clout priorities:

1. **save:** retain all Clout; still open earned tickets.
2. **packs:** spend available Clout on ten-pulls first, then singles; rebates may
   finance another pack. This does not assume saving singles across days for bulk.
3. **training:** buy Intensive Training for one owned character to cap, then
   eligible move tiers. Charge proportionally near cap; no XP discarded.
   This intentionally aggressive priority competes with packs and reactions.

The `zero-progression-online` label represents a settlement that issues no account
match rewards, card XP, or mission progress. It **still** allows independent login,
shop, new-account and collection claims. It is not an assertion that every online
mode has identical settlement; use the companion mode audit for actual route
boundaries. Buying training remains possible from non-match income.

Excluded from daily journeys deliberately: story/perfect-clear tickets, starter-Mythic campaign grant,
career card choices, promo/mail/developer grants, purchased Clout, Stockz and
Challenge chains. These require separately specified paths or cohorts. Therefore
journey totals are not the maximum available first-session/campaign grant stack.

`campaignBoundary` separately reads the full current exported story graph, dedupes
stable reward keys, and counts 29 chapters/101 battles, 14,450 authored account XP,
750 Clout, 118 authored tickets plus 101 perfect-clear tickets (**219** total).
It adds the separate Chapter-5-reach starter-Mythic 1,000 Clout/three-ticket grant
and authored-XP-only level milestones explicitly, rather than mixing them into
daily sessions. It applies story duplicate compensation at **25 universal** per
already-owned card (also for the starter mythic), never at pack rarity payouts.
Starting ownership and sequential story rewards determine duplicate counts.
This boundary holds tickets unspent and excludes match earnings, onboarding,
login and Collection Road; opening packs during the campaign can change story
duplicates. Narrative `character-unlock` entries are not gameplay-card grants.

## Reading pacing and uncertainty

`repeatOnlyPacing` gives no-mission/no-purchase baseline affordability at 62
Clout per mixed-result verified match. Fractional matches/sessions are expected
rates, not guarantees. Reaction prices come from authoritative shop offers.
Move levels require actual participating-card XP **and** cumulative coaching
currency; a player cannot just pay each tier's standalone cost to skip earlier tiers.
`participationTargets` provides 60% and 80% participation XP-level/move-prerequisite
and cap matches, two-/six-match sessions, and full Intensive Training purchases
needed to reach those levels. The XP-equivalent cost is distinguished from actual
225-Clout full purchases: only the level-10 cap supports proportional final buying.
Finish pacing converts seeded pack waits to full-price match equivalents and
two-match sessions, deliberately ignoring rebates/claims. It is not a coupled
match-by-match spending forecast. Online zero-reward matches cannot fund those
targets through match income.

All reported p05/p50/p95 values are empirical outcome quantiles, **not confidence
intervals on the mean**. Pack experiments use 10,000 trials/cohort/type; journeys
use 100 trials/scenario; finish targets use 500. Rare Mythical estimates have
noticeable sampling error; use analytical probabilities for exact tail decisions.
At complete collection the total ordinary matching payout expectation is 36.6,
but those are six incompatible currencies. The seeded complete-collection Tagged
median/p95 waits range from 5/7 packs (Common) to 26/43 packs (Mythical); Chrome
from 8/10 to 43/67. Treating those shards as universal would materially understate
high-tier finish pacing.

## Separate paid, promotional and campaign-spending overlays

`supplemental` never changes the organic scenario tables. It uses 100 trials,
controlled by `--journeys`, and contains three independent boundary experiments:

- `purchased`: each source-checked 500/1,500/4,000-Clout offer overlays the new,
  casual, save-priority first-session wallet. Quotes are USD base 299/799/1,999
  cents, not tax-inclusive totals. Added Clout remains unspent; exact extra
  full-price single/ten affordability is reported without assumed rebates.
  Only literal offer source is read; no payment config functions/provider is run.
- `promotional`: production-enabled pure promo rules supply KYLE+CITYLEGENDS,
  together 60,000 Clout, 25 tickets and eight authored ownership grants.
  Overlay ownership is a union (no duplicate shard compensation). Added tickets
  and Clout remain unspent. Actual new promo cards depend on the organic pack
  results and are reported as quantiles. This is not evidence anyone redeemed
  either code or that paid purchases were made.
- `finiteCampaignTicketSpending`: each new/mid/near/complete starting collection
  first receives all modeled finite story/starter rewards and story-XP milestone
  claims. It then opens all **227** tickets using the production generator
  (22 ten-pulls, seven singles), carrying pity, ownership and styles between
  openings. It reports p05/p50/p95 for newly acquired **random-pack** cards, final
  owned cards, universal shards, six separate matching balances, Clout rebates
  and final unspent Clout. Finite card unlocks and duplicate universal shards are
  separate fields; milestone universal is included explicitly.

Campaign ordering is intentionally a finite upper-bound reward stack: all story
grants precede all packs. It does not reconstruct a normal campaign journey;
opening packs between story rewards can change duplicate compensation. It omits
Collection Road, match income, login/onboarding/promo/paid grants and Clout pack
spending. These tables must not be added to an organic wallet without checking
which finite claims that wallet has already received.

Validation: nine focused deterministic/analytical/receipt/participation tests pass,
and the scripts TypeScript check passes. The audit has no browser surface, so no
preview was started or application screenshot taken by this worker. Runtime
authorization, atomicity and hosted payment validation are outside this model.