# Around the Block: balance review and support plan

Reviewed against shared engine behavior, September 10, 2026. These are code-based assessments, not measured live win rates. Player-created seven-card crews remain the design target; existing recipes are test fixtures and examples.

## Implemented this pass

- Rival AI simulates every affordable card/district through the actual engine. It scores all three districts, gives diminishing value to excess leads, and prioritizes the real final-round outcome. It can pass if a forced movement play would worsen the final position. Ties are deterministic, with rotating district preference rather than permanent lane-zero preference. Training and the automatic rival turn use this same function.
- Motion interpreted as summon payment: Techbro spends only his summon cost and gains +2 if another ally is here. Nguyen gains +1 if an ally occupies another district. Bottle Girl creates her next printed-2-cost discount even with no Motion left. Descriptions match these changes. The normal 2-Motion opening, one-point carryover and six-point cap remain.
- Tayaty/Honest Thot earn success upgrades only when damage or new silence actually lands, including lethal damage. Absorbing a hit with protection or mitigation no longer grants their self-bonus. Creating a discount now counts as a successful ability for upgrade resolution.

The AI is a deterministic one-play evaluator, not a trained model or multi-turn planner. It uses the visible board and its own hand. Recipe selection still picks the same closest difficulty band deterministically; opponent variety is a separate follow-up. Changing shared combat rules also changes transcript replay: deploy client/server together and finish or expire outstanding matches created under the previous rules.

## All eleven Commons

Notation: cost / printed Power. Max body assumes all three move upgrades are active AND the base ability succeeds, excluding district bonuses and external buffs. Unlocks are levels 2/5/8; move tiers can be separately gated. Every tier adds +1 to the source, not to its support effect.

| Card | Cost / Power | Successful base → max body | Assessment and synergy |
|---|---|---|---|
| Young Bull | 2 / 3 | 4 → 7 | Strong contesting baseline; another +2 in The Town. More immediately efficient than Edgar. Keep initially; use as pressure benchmark. |
| Racially Ambiguous Transplant | 1 / 1 | 2 → 5 | Useful isolated opener; buff remains after allies arrive. Works with later movement/support. High upgrade efficiency for one Motion. |
| Bad Lil Cousin Tayaty | 1 / 1 | 1 → 4, enemy -1 | Highest-risk cheap disruption. Can destroy a one-Power support; adds +2 district score in Town OR Group Chat. Gamer chains amplify tempo. Keep damage at -1; do not scale damage, targets or repetition. |
| Edgar | 2 / 2 | 3 → 6 | Needs another printed-cost ≤2 ally here. Cheap-crew connector, but weaker immediate output than Young Bull and no district bonus. First stat experiment: 2/3, keeping the +1 condition. |
| Nguyen | 2 / 2 | 3 → 6 | Revised to reward another occupied friendly district. Server Room adds +3, giving 6→9 district contribution. Good spreading/Delivery synergy; do not also increase base Power. |
| Man-Man | 3 / 3 | 5 → 8 | Requires two other allies here. Fair commitment payoff but uses three of six normal plays in one district. Pair with movement; avoid encouraging unconditional stacking. |
| Pinay Nurse | 2 / 2 | 2 → 5, patient +1 | Cleanses both freeze and silence on the lowest eligible ally. No target means no buff/upgrades. Rastamon has the same cost/body and +2 cleanse reward: meaningful redundancy problem. First experiment: Nurse always gives lowest ally +1 and cleanses it if needed; retain Rastamon as stronger status-specific recovery. |
| Honest Thot | 2 / 1 | 1 → 4, silence | Low body offsets persistent disruption; +2 in Group Chat. Lowest-Power targeting can miss the engine you want. Silence stops future triggers; it does not undo already-resolved reveal buffs. Keep single target, no scaling duration/targets. |
| Earthy Sugar Foot | 1 / 1 | 1 → 4, ally +1 | Efficient glue for Gamer and cheap crews. At max tier, five total Power added for one Motion before other synergies. Keep ally buff fixed; prioritize upgrade-normalized tests. |
| Abuela | 3 / 3 | 3 → 6, ally +2 | Simple reliable support, five base total Power added. Compare against existing 2/2 Nail Tech giving +2 plus mitigation: Abuela's extra body costs another Motion. Test 3/4 if she is consistently displaced. |
| Ice Cream Truck | 3 / 2 | 2 → 5, each ally +1 | Requires prior setup. With n allies, adds 2+n base or 5+n max-tier Power. No hard lane capacity; normal six plays bound n to five without extra summons. Keep each buff at +1; test against late swarm boards before adding summons or repeat triggers. |

## Priorities before more cards

1. **Keep Commons relevant through distinct jobs.** Test Nurse's unconditional small support and Edgar's +1 printed Power first; Abuela second. Do not increase all Commons together. These stat/effect experiments are proposed, not applied.
2. **Control progression advantage.** +3 self Power is a 300% printed-body increase on the one-Power Commons. Their ally/debuff magnitudes remain fixed, which is good, but cost efficiency still jumps sharply. Standardize move tiers in competitive tests; compare full upgrades against capped +1/+2 self-Power experimental budgets before revising the three-tier progression system.
3. **Check repeat engines around the Commons.** Earthy, Abuela and Truck are one-shot reveals. Gamer repeats +1 to itself and the arriving cheap card; Streamer has a two-use shared owner budget and currently includes its own arrival. Triggers use paid summon cost, so discounts can make expensive cards count as cheap. Test discounted chains explicitly; decide whether these should use printed cost for clarity.
4. **Keep recovery and removal understandable.** Freeze persists and zeroes effective Power until cleansed, although district bonuses still count. Damage reaching zero destroys the card; cleansing cannot revive it or reverse ordinary Power reductions. Healing needs separate damage bookkeeping before introduction, rather than silently treating every negative modifier as damage.
5. **Evaluate custom crews, not just recipes.** Run mixed Common/rare decks with and without Gamer, Nail Tech, Rastamon and discounts; compare equal move tiers, both turn orders and all districts. Record two-district wins, lane concentration, card inclusion and effect success. Existing deterministic regressions prove behavior, not a balanced metagame.

## Proposed next support wave — not implemented

Working names and starting stats, pending roster review. Every effect is one On Reveal; no recurring healing, immunity loops or automatic Motion generation.

| Role / working character | Starting cost / Power | Proposed effect and boundary |
|---|---|---|
| Healing — Block Medic | 2 / 2 | Restore up to 2 recorded hostile Power damage to one surviving ally here. Cannot exceed pre-damage Power, remove unrelated debuffs or resurrect. Requires damage tracking first. |
| Cleansing — Community Counselor | 2 / 2 | Cleanse silence from the lowest-Power silenced ally in another district. Gives cross-district reach, no Power buff and no freeze cleanse. |
| Protection — Crossing Guard | 2 / 2 | Reduce the next hostile Power reduction against the lowest-Power ally here by 1. One charge; no stacking with Nail mitigation; no Power grant. Review overlap before inclusion. |
| Movement — Bus Driver | 3 / 2 | Move the lowest-Power other ally here to your weakest other district. Broader eligibility than Delivery Demon, at higher cost; no reveal retrigger. |
| Resource support — Corner Store Clerk | 2 / 1 | Your next printed-2-cost summon costs 1 less. One non-stacking voucher; applies only when summoned. Simpler alternative to Bottle Girl, with lower body; replace/rework if inclusion tests show redundancy. |
| Neighborhood — Block Organizer | 3 / 2 | If you occupy all three districts, give your lowest-Power ally in each other district +1. Maximum two buffs, once; rewards spreading. |

Prioritize Block Organizer and the Nurse revision; then Bus Driver and cross-district cleansing. Healing follows explicit damage tracking. Protection/resource additions need the strongest redundancy checks because Church Auntie, Wifey, Nail Tech, Plug and Bottle Girl already cover those jobs.

Art remains bold ink outlines, angular shapes, muted colors and flat painted shading. Scammer keeps the expensive oversized tracksuit, wide-leg pants, credit cards and hacker device; Hypebeast Cowboy remains the separate black-and-gold Western streetwear character; Dr. Fade stays the tutorial mentor. No art, pack odds or additional characters changed in this pass.

## Validation

80 focused tests passed: engine rules, all eleven Commons, six-round bot coverage across every recipe, success-gated upgrades, authoritative transcript replay, destruction, previews and battle component behavior. Shared engine compilation and application/server type checks passed. No deployment performed. These checks do not establish live win rates or long-horizon AI strength.
