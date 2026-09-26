# Next 25 card buff candidates

Audit of main `7b886054ca42d7c89e67cb21e19397353c8da95b`. Historical investigation, now implemented in the approved follow-up. See [final rules and limits](CARD_BUFFS_25.md); the proposed directions below are retained as audit history.

Reviewed the current 202-card registry, relevant engine implementations, training/elements for comparator cards, the existing 768-game creative-wave sample, and eight focused engine probes. These are prioritized design candidates, not a claim that all 25 have statistically poor live win rates. No new matchup simulations were run. Proposed numerical rewards are starting points for controlled tests.

The strongest evidence is dead timing, inaccessible triggers, or close cost/effect comparisons. Whole-deck results cannot identify individual weak cards. Printed comparisons below are untrained; elements, upgrade recipients, support/Blockbuster rules, and matchup roles still matter.

## Findings requiring care

- Coach changes readiness when presentation events are suppressed. Fix state parity before judging bot/search valuations. This does not by itself establish how much the existing benchmark scores were affected.
- Gardener is removed from the previous shortlist: an isolated Gardener harvested +3 without another Plant ally. A 1-cost card becoming 4 Hands on schedule is not an obvious buff target. Plant's team results are insufficient evidence against it.
- Baby is lower priority than the earlier recommendation: its 4/5 body and retaliation have real value. Improve mobility reliability before raising damage.
- Cashier's late discount can be useful if After Party has extended the game. The confirmed dead timing is a normal six-round game.

## Ranked candidates

### 1. Night Cashier — High

`nightcashier` · Electric · 2 Motion / 2 Hands

**Current:** On Reveal: On round 4 or later, issue a Receipt here through next round. Your next other character costing 2 or less played here earns a one-use local 1-Motion character discount starting next round, minimum 1.

**Why investigate:** Receipt needs round 4+, another cheap local deployment, then another round. A round-6 probe created a round-7 discount in a normal six-round match.

**Buff direction to test:** Complete the receipt into an immediately usable local discount. If completed in the final round, cash it into +2 Hands for the qualifying customer instead; one payout.

### 2. Mr. Trick — High

`mr-trick` · Dark · 3 Motion / 3 Hands

**Current:** On Reveal: Sponsor your weakest other ally here through next round. Its first successful enemy hit earns a Tip. At round end, cash the Tip for +2 Hands to that ally. One Tab per side.

**Why investigate:** Sponsors the weakest existing ally without checking whether it can deal future damage. Ordinary On Reveal attackers have already spent their hit before sponsorship.

**Buff direction to test:** The next friendly character played here becomes the guest; its first successful hit or new harmful status earns the Tip. Consume before paying, with no refund/copy recursion.

### 3. Stoner Sr. — High

`stonersr` · Plant · 3 Motion / 2 Hands

**Current:** On Reveal: Cleanse your weakest afflicted ally here. If cleansed, leave a token through next round: your next other character arriving here gains +2 Hands.

**Why investigate:** A 3/2 needs an afflicted local ally before it even creates the arrival reward. With no status to cleanse, the entire entrance is blank.

**Buff direction to test:** Always pass the token. A successful cleanse lets its first recipient pass a smaller token once to a different arriving ally.

### 4. Midnight Mayor — High

`midnightmayor` · Dark · 3 Motion / 2 Hands

**Current:** On Reveal: Nominate your weakest other district through next round. Your next friendly move there opens a one-use 1-Motion character discount there, minimum 1, through next round. One nomination per side.

**Why investigate:** A 3/2 requires a move into a nominated district before opening just one local -1 discount, then requires another purchase to realize that value.

**Buff direction to test:** Turn the nominated district into a one-use Open House: qualifying arrival gets a key that protects its next arrival there and opens the existing discount. Keep one key per Mayor.

### 5. Corner Busker — High

`busker` · Air · 2 Motion / 1 Hands

**Current:** Ongoing: The first other friendly character moving here each round earns a Tip. At two Tips, spend them to give your weakest other ally here +3 Hands.

**Why investigate:** Only one Tip per round; needs two movement arrivals in separate rounds for +3. A late Busker cannot finish even with two good moves.

**Buff direction to test:** Allow two different audience members to tip in one round, but retain at most one +3 payout per round. Repeated movement of the same character cannot farm Tips.

### 6. Failed Athlete — High

`failedathlete` · Earth · 3 Motion / 2 Hands

**Current:** Ongoing: Once per match, after this district changes from tied or winning to losing while you are here, gain +4 Hands and Protection.

**Why investigate:** Records tied/winning after arrival. An already-losing district does not arm the comeback until it recovers and falls behind again.

**Buff direction to test:** Also arm when deployed into a losing district; a later enemy arrival while still losing triggers the single comeback. No immediate free trigger.

### 7. ATL Scammer — High

`atl-scammer` · Dark · 3 Motion / 2 Hands

**Current:** On Reveal: File a claim through next round. Divert up to 1 Motion from the next enemy refund, then consume the claim. One claim per side.

**Why investigate:** A 3/2 earns at most one diverted Motion and only if the opponent refunds before the claim expires.

**Buff direction to test:** If the opponent dodges the claim, its expiry produces one counterfeit local discount for your next character, minimum 1. Theft or fallback, never both.

### 8. Corner Coach — Fix first

`cornercoach` · Fire · 3 Motion / 3 Hands

**Current:** On Reveal: Coach your weakest eligible ally here. If its most recent entrance failed, or its next entrance fails through next round, your next other character placement retries it once. Copying, summoning, refunds, choices and reworked entrances cannot be retried.

**Why investigate:** Past-failure detection reads effectLog. The same Edgar-then-Coach sequence arms in normal state and fails to arm when presentation logs are suppressed. Retry may also be consumed while the trainee still cannot succeed.

**Buff direction to test:** Store entrance outcome in rules state. After parity is restored, let a failed practice retry keep the drill until expiry; at most one successful retry and no summon, refund, or copy effects.

### 9. Barber Bro — Targeting first

`barber` · Normal · 4 Motion / 4 Hands

**Current:** On Reveal: Trim up to 2 bonus Hands from the strongest enemy here. Give the amount actually trimmed to your weakest other ally here. If no enemy has bonus Hands, give that ally +1 Hand.

**Why investigate:** Targets highest total Hands rather than highest bonus Hands. A probe with unbuffed OG and buffed Cornball leaves Cornball untouched and gives only fallback +1.

**Buff direction to test:** Target the enemy with the most removable bonus Hands. Retain trim cap, hostile defenses, actual-transfer accounting, and no damage credit.

### 10. Tattoo Artist — High

`tattoo-artist` · Fire · 3 Motion / 2 Hands

**Current:** On Reveal: Tattoo your weakest other ally here and give it +1 Hand. Its next successful move grants Protection. A character can receive this tattoo only once per match.

**Why investigate:** A 3/2 gives +1 now and requires an additional move for protection; competing 3/3 Stylist gives +2 and protection immediately.

**Buff direction to test:** First move activates the tattoo: retain protection and grant a one-use arrival flourish of +1. One activation per tattooed instance.

### 11. Juneteenth Chair Guy — High

`juneteenth-chair-guy` · Fire · 5 Motion / 5 Hands

**Current:** Ongoing: Once per match, after an enemy damages another ally here, hit its source for 3 and give your weakest surviving other ally here Protection.

**Why investigate:** A 5/5 waits for actual damage to another local ally. Friendly protection can stop the event needed to activate this expensive retaliation.

**Buff direction to test:** First hostile ability blocked by an ally shield can also provoke the single chair retaliation. Preserve the one-time cap and consume before the counterhit.

### 12. Lawyer — High

`lawyer` · Light · 3 Motion / 2 Hands

**Current:** On Reveal: Cleanse your weakest other ally here and give it an Appeal through next round. Its next harmful status is delayed until round end; moving the client or cleansing it dismisses the Appeal. One Appeal per client.

**Why investigate:** A 3/2 cleanses and delays only one future harmful status. Requires another action to dismiss it; has little value against plain damage or a healthy board.

**Buff direction to test:** A successfully dismissed Appeal awards a one-use local discount as legal fees. One client, one payout; unsuccessful appeals do not pay.

### 13. First Aid Kit — Medium

`firstaid` · Light · 2 Motion / 0 Hands

**Current:** On Reveal: Cleanse your weakest afflicted character here, or your weakest character if none is afflicted. Store one emergency heal on it: after enemy damage, restore up to 2 Hands actually lost if it survives. One kit per target.

**Why investigate:** Costs 2, adds no body, and its stored heal only works if the target survives. A lethal hit bypasses the emergency payoff entirely.

**Buff direction to test:** Make the kit prevent up to 2 incoming Hands loss before lethal resolution, once. Preserve the cleanse; do not also heal those same prevented points.

### 14. Hair Stylist — Medium

`hair-stylist` · Air · 2 Motion / 2 Hands

**Current:** On Reveal: Cleanse your weakest other ally here and give it +1 Hand.

**Why investigate:** Same printed 2/2 cleanse/+1 as Laundry, which also stores a movement cleanse. Air versus Water and training timing prevent a blanket dominance claim.

**Buff direction to test:** A successful cleanse grants a one-use blowout: next friendly move gives the client +1. Keep its reward distinct from Laundry's repeat cleansing.

### 15. Crossing Guard — High

`crossingguard` · Light · 2 Motion / 2 Hands

**Current:** On Reveal: Protect your lowest-Hands other ally here from one targeted hostile ability.

**Why investigate:** 2/2 local protection competes with same-element 2/4 Yasuke, which protects an unprotected ally and also hits an enemy for -1.

**Buff direction to test:** The protected ally gets one Safe Crossing: its next move cannot be stopped by a movement Lock. District capacity and story restrictions still apply.

### 16. Bust-Down Watch — Medium

`bustdown` · Light · 1 Motion / 0 Hands

**Current:** On Reveal: Protect your lowest-Hands friendly character here from one targeted hostile ability.

**Why investigate:** Costs the same as Buttahs and protects the same weak target, but Buttahs also supplies +2. Light versus Earth can matter.

**Buff direction to test:** When this ward blocks a hostile effect, flash it for a one-time +2 to the wearer. No payout for unrelated shields.

### 17. Boombox — Medium

`boombox` · Air · 2 Motion / 0 Hands

**Current:** On Reveal: Give every friendly character here +1 Hands.

**Why investigate:** Same 2-Motion local +1 team grant as Baby Shower, which can also draw. Air/support versus Light/Blockbuster interactions can matter.

**Buff direction to test:** Leave one Encore after the initial buff: the next friendly movement arrival here gets +1. Consume after one arrival.

### 18. Torta — Medium

`torta` · Earth · 2 Motion / 2 Hands

**Current:** On Reveal: Pair your two weakest other Earth allies here. At next round end, if both remain here and you are not losing this district, each gains +2 Hands. One pair per side.

**Why investigate:** Needs two OTHER local Earth allies, waits a round, and pays only if neither left and the district is not losing. One partner produces no setup.

**Buff direction to test:** Let Torta count as one member of her own pair. Retain two bodies, the hold requirement, and the same total +4 ceiling.

### 19. Concrete — Medium

`concrete` · Earth · 1 Motion / 1 Hands

**Current:** On Reveal: Anchor your weakest other Earth ally here through next round. Its next hostile forced move is blocked and it gains +2 Hands. One anchor per ally.

**Why investigate:** A 1/1 needs another Earth ally and an enemy forced-move attempt during a short window. Asphalt Apostle supplies a broader recurring version.

**Buff direction to test:** An unused anchor hardens into +1 for its ally at expiry. A blocked move keeps the existing +2; never both outcomes.

### 20. Abuela — Medium

`abuela` · Light · 4 Motion / 4 Hands

**Current:** On Reveal: Restore up to 3 Hands actually lost to damage to your weakest injured ally anywhere and Protect it. If nobody is injured, Protect your weakest other ally here.

**Why investigate:** 4/4 heals up to 3 and protects; 2/3 Watson has a similar local package. Abuela's global injured-target reach is a real advantage, but healthy fallback is only local protection.

**Buff direction to test:** If everyone is healthy, pack one lunch for an ally: its first later enemy damage heals a small actual loss if it survives. Prevent stacking with the existing immediate heal branch.

### 21. STUD — Medium

`stud` · Earth · 3 Motion / 3 Hands

**Current:** On Reveal: Bond to your weakest other ally here. Once per match, while together, intercept its next targeted hostile ability; then move the surviving pair to your weakest other district with two spaces.

**Why investigate:** 3/3 intercepts once only while bonded allies remain together, then needs two free destination spaces for the rescue. Grown-Man Fanboy is 3/4 with recurring interception, though no paired escape.

**Buff direction to test:** A successful escape leaves the surviving partner protected. No shield unless the move completes; still only one interception.

### 22. Inmate Kingpin — Medium

`inmate-kingpin` · Dark · 5 Motion / 5 Hands

**Current:** On Reveal: Give Contraband to your weakest other Inmate anywhere. Each later Inmate deployment or move passes it to that Inmate. After three distinct carriers, give all three surviving carriers +2 Hands. Once per Kingpin per match.

**Why investigate:** A 5-cost setup needs an existing inmate plus two further distinct carriers before any of its +6 team payoff arrives. The stash persists, but a late deployment has little runway.

**Buff direction to test:** Distribute the existing +6 budget as +1 when each of three distinct carriers receives it, then +1 each at completion. Same full ceiling, useful partial progress.

### 23. Nigerian Father — Medium

`nigerian-father` · Earth · 4 Motion / 4 Hands

**Current:** On Reveal: Set a goal for your weakest other ally here with 3 or fewer Hands: reach 5 Hands by the end of next round. If achieved, it gains Protection and +2 Hands. One goal per side.

**Why investigate:** Selects an ally at 3 Hands or less, requires it to reach 5 externally, then waits until the next-round deadline. A 1-Hand target needs +4 from elsewhere.

**Buff direction to test:** Tutor the target for +1 immediately and mark its starting power. Reward a further external +2 improvement, with the existing shield/+2 completion cap.

### 24. Closet Nerd — Conditional

`nerd` · Dark · 4 Motion / 3 Hands

**Current:** Silence the highest-Hands enemy here, bypassing Wifey's Side Eye. Protection on that enemy still blocks this.

**Why investigate:** 4/3 Silence costs one more than 3/3 Teacher. Dark synergy and bypassing Wifey are real benefits; this is matchup-dependent rather than proven weak.

**Buff direction to test:** When Silence actually disables an enemy ongoing ability, reveal one enemy hand card as an information payoff. No reward on blocked Silence.

### 25. Baby Momma — Conditional

`baby` · Fire · 4 Motion / 5 Hands

**Current:** On Reveal: Name your weakest other ally here as family. Once per match, when an enemy damages it, hit the attacker for 2. If your family was destroyed, also gain +2 Hands.

**Why investigate:** 4/5 is a respectable body, but the named-family payoff only happens after enemy damage. Healthy or shielded families can produce no ability value.

**Buff direction to test:** Once, follow the family member when it moves if there is room. Keep current single retaliation; following cannot create a movement loop.

## Verification evidence

Eight engine probes reproduced: Coach past-failure readiness with and without presentation logs; final-round Cashier issuing an unusable next-round token; Failed Athlete remaining unarmed when deployed into a losing district; healthy Stoner Sr. producing no mark or bonus; Barber ignoring a weaker buffed enemy; Torta failing to form a pair with one other ally; Gardener harvesting alone.

Source files: `lib/squabblemon-engine/src/creativeReworks.ts` (contracts, targets, delays), `lib/squabblemon-engine/src/gameEngine.ts` (legacy comparators and presentation suppression), `lib/squabblemon-engine/src/blockbusterRules.ts` (Baby Shower), and the current runtime card registry. Existing sample results: [creative-wave report](../scripts/results/creative-wave/README.md).

Prioritize rules reliability and the most restrictive triggers, then compare each proposed change in a coherent deck with one-card substitutions, multiple district seeds, both seats, and untrained/fully-trained variants. Check actual trigger and completion rates in addition to match score. Do not apply all numeric increases blindly or restore passive hand scaling to every archetype.
