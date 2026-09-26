# Creative card reworks

Implements the approved full-roster audit: **41 identity/payoff reworks and 10 replacements for pure hand-bond scaling**, totaling 51 cards. The registry below is generated from the shipped card definitions. Card IDs, collection ownership, rarities, printed costs, base Hands, and upgrade IDs/unlock requirements remain intact. Upgrade text now describes once-per-instance training on a successful setup or payoff; the stored upgrade effect kinds and amounts are preserved.

## Shared rules

- Contracts expose targets, progress, and expiry through district markers. Full internal source snapshots are not exposed in public online state.
- Delayed next-round payoffs settle at the final round's end so late deployments cannot create rewards after final scoring. Failed or disabled targets do not receive entrance retries.
- Paired movement reserves both spaces and moves both bodies before arrival reactions. If either cannot move, neither starts the trip.
- Persistent contracts do not rearm through copied entrances. Among these reworked kits, instantaneous copies are limited to Barber, Abuela, Block Party Titan, Bboy, and YN ATV Lord. Bounded passive copies use their effective copied identity without duplicating their own training.
- Coach's retry pool is Edgar, Nguyen, Manman, Transplant, Bodega Cat, Dog Walker, Sports Prodigy, Homeless YN, Dragonfly Jones, and OG. A failed eligible entrance arms one retry after a later friendly character placement; copy, summon, refund, and new contract engines are excluded.
- Forecasts react to the original character placement district even if an entrance moves or destroys the entrant. Supports do not consume character-only forecasts.
- Bonus-Hand trimming does not count as damage for healing or damage-reward triggers. Shared gains cannot recursively share themselves.
- Local discounts apply to eligible characters in the named district and round, never reduce below 1 Motion, and do not stack. Techbro's borrowed Motion is repaid before carry-over/next-round debt is calculated.
- Online protocol/rules versions advance to 9 for this rules change.

## Implementation adjustments after testing

Dr. Umah and Foreman recruit contributors as allies enter instead of requiring an existing board to repeat entrances. Coach can recognize an earlier failed entrance. BBL Nice pairs the two weakest other allies anywhere, and its sharing recognizes ordinary actions, Blockbusters, and round-end gains. Canopy Keeper recognizes healing, cleansing, or outside positive Hand gains. These changes make the new setup mechanics usable without inventing entrance loops.

These are creative reworks, not a guaranteed buff to every existing deck. Fixed-deck bot samples still lose strength in several archetypes after passive hand bonds are removed. See the [full balance report](../scripts/results/creative-wave/README.md) for results and limitations.

## The 41 reworked cards

### YN ATV Lord — Hop On

`yn-atv-lord` · 4 Motion / 4 Hands

On Reveal: Move with your weakest other ally here to your weakest other district with two spaces. Both must be movable. Protect your passenger after arrival.

### Mr. Trick — Open Tab

`mr-trick` · 3 Motion / 3 Hands

On Reveal: Sponsor your weakest other ally here through next round. Its first successful enemy hit earns a Tip. At round end, cash the Tip for +2 Hands to that ally. One Tab per side.

### Dr. Umah — Group Project

`dr-umah` · 4 Motion / 3 Hands

On Reveal: Start a Group Project through next round. Your next two different-element allies to resolve successful entrances gain +1 Hand each. When both contribute, each gains another +2 Hands. One project per side.

### Hooper — Ankle Breaker

`hooper` · 5 Motion / 5 Hands

On Reveal: Challenge the strongest enemy here through next round. If it leaves this district, gain +3 Hands. Otherwise, at the end of next round, hit it for 3 and gain +1 Hand. One challenge per Hooper.

### Failed Athlete — One Last Shot

`failed-athlete` · 3 Motion / 2 Hands

Ongoing: Once per match, after this district changes from tied or winning to losing while you are here, gain +4 Hands and Protection.

### Block Party Titan — Everybody Outside

`block-party-titan` · 6 Motion / 7 Hands

On Reveal: Bring the weakest movable ally from each other district here, if there is space. Gain +1 Hand for each ally that arrives, up to +2.

### Chess Regular — Fork

`chess-regular` · 3 Motion / 3 Hands

On Reveal: Mark the strongest enemy in each of two different districts through next round. The next enemy character placement saves marks in that district; give each remaining marked enemy -2 Hands. One Fork per side.

### DMV Worker — Take a Number

`dmv-worker` · 2 Motion / 2 Hands

On Reveal: Post one queue ticket here through next round. The next enemy character entrance here waits until round end, then resolves if that character is still active. One ticket per district per side; no repeat delay.

### Tattoo Artist — Permanent Ink

`tattoo-artist` · 3 Motion / 2 Hands

On Reveal: Tattoo your weakest other ally here and give it +1 Hand. Its next successful move grants Protection. A character can receive this tattoo only once per match.

### STUD — Hold You Down

`stud` · 3 Motion / 3 Hands

On Reveal: Bond to your weakest other ally here. Once per match, while together, intercept its next targeted hostile ability; then move the surviving pair to your weakest other district with two spaces.

### Stoner Sr. — Pass It Around

`stoner-sr` · 3 Motion / 2 Hands

On Reveal: Cleanse your weakest afflicted ally here. If cleansed, leave a token through next round: your next other character arriving here gains +2 Hands.

### Laundromat Regular — Spin Cycle

`laundromat-regular` · 2 Motion / 2 Hands

On Reveal: Cleanse your weakest other ally here and give it +1 Hand. Its next successful move cleanses it again, once.

### Black Cowboy — Wanted

`black-cowboy` · 3 Motion / 3 Hands

On Reveal: Lasso the weakest enemy from another district here if there is room. If it arrives, mark it Wanted through next round. If your side destroys it, gain +3 Hands.

### Regular guy named LeBron James — Definitely Not Him

`lebron-james` · 4 Motion / 4 Hands

A fictional regular guy. On Reveal: Cleanse and Protect your weakest other ally here. Once per match, when that Protection blocks an enemy ability, hit its source for 3.

### Juneteenth Chair Guy — Fold-Out Justice

`juneteenth-chair-guy` · 5 Motion / 5 Hands

Ongoing: Once per match, after an enemy damages another ally here, hit its source for 3 and give your weakest surviving other ally here Protection.

### Baby Momma — Mama Bear

`baby-momma` · 4 Motion / 5 Hands

On Reveal: Name your weakest other ally here as family. Once per match, when an enemy damages it, hit the attacker for 2. If your family was destroyed, also gain +2 Hands.

### Techbro Rich — Burn Rate

`techbro-rich` · 4 Motion / 5 Hands

On Reveal: Borrow up to 2 Motion, up to the cap. At round end repay unspent borrowed Motion; any remainder reduces your next round starting Motion. Once per match.

### Failed Rapper — One More Verse

`failed-rapper` · 2 Motion / 1 Hands

On Reveal: Leave a Verse here through next round. The next different friendly character played here gains +2 Hands after its entrance. One Verse per district per side.

### Corner Busker — Pass the Hat

`corner-busker` · 2 Motion / 1 Hands

Ongoing: The first other friendly character moving here each round earns a Tip. At two Tips, spend them to give your weakest other ally here +3 Hands.

### Dance Circle Captain — Follow My Lead

`dance-circle-captain` · 3 Motion / 3 Hands

Ongoing: Once per round, the first friendly dancer move sets a destination. The next different friendly dancer arriving there gains +2 Hands. Dancers: Break, Bboy, Dance Circle Captain.

### Break — Floor Sweep

`break-dancer` · 2 Motion / 2 Hands

On Reveal: Move your weakest other ally here to your weakest other open district. If it moves, leave a floor mark here through next round: Weaken the next enemy character entering. One mark per district per side.

### Bboy — Windmill

`bboy` · 2 Motion / 2 Hands

On Reveal: Move through your weakest other occupied friendly district, then to the remaining district if open. Gain +1 Hand per successful move, up to +2.

### YN Gokarter — Lap Record

`yn-gokarter` · 2 Motion / 2 Hands

On Reveal: Move to your weakest other open district. Ongoing: After visiting all three districts, gain +3 Hands once per match.

### OG Skater — Still Got It

`og-skater` · 3 Motion / 3 Hands

On Reveal: Move to your weakest other open district. Leave a route at your origin through next round. The next friendly character played there follows you to the destination if movable and there is room. One route per origin per side.

### Divorced Dad — My Weekend

`divorced-dad` · 3 Motion / 3 Hands

On Reveal: Bring your weakest movable ally costing 2 or less from another district here if there is room; Protect it. At the end of next round, try to return it to its original district. One visit per side.

### BBL Nice — Good Company

`bbl-nice` · 3 Motion / 2 Hands

On Reveal: Pair your two weakest other allies anywhere through next round. Once per round, the first positive Hands gain on one shares up to 2 Hands with the other. Shared gains cannot repeat.

### BBL Demon — Problem Energy

`bbl-demon` · 4 Motion / 4 Hands

On Reveal: Mark the strongest enemy district with Drama through next round. Their next character played there gets -2 Hands; if played elsewhere, BBL Demon gains +2 Hands. One Drama per side.

### Barber Bro — Line Up

`barber-bro` · 4 Motion / 4 Hands

On Reveal: Trim up to 2 bonus Hands from the strongest enemy here. Give the amount actually trimmed to your weakest other ally here. If no enemy has bonus Hands, give that ally +1 Hand.

### Corner Coach — Run It Back

`corner-coach` · 3 Motion / 3 Hands

On Reveal: Coach your weakest eligible ally here. If its most recent entrance failed, or its next entrance fails through next round, your next other character placement retries it once. Copying, summoning, refunds, choices and reworked entrances cannot be retried.

### Midnight Mayor — Keys to the City

`midnight-mayor` · 3 Motion / 2 Hands

On Reveal: Nominate your weakest other district through next round. Your next friendly move there opens a one-use 1-Motion character discount there, minimum 1, through next round. One nomination per side.

### Hater — Must Be Nice

`hater` · 2 Motion / 2 Hands

Ongoing: Once per round, after an enemy here gains bonus Hands, remove up to 1 of that new bonus and gain +1 Hand if any was removed. Cannot remove base Hands.

### ATL Scammer — Pending Transfer

`atl-scammer` · 3 Motion / 2 Hands

On Reveal: File a claim through next round. Divert up to 1 Motion from the next enemy refund, then consume the claim. One claim per side.

### Lawyer — Objection

`lawyer` · 3 Motion / 2 Hands

On Reveal: Cleanse your weakest other ally here and give it an Appeal through next round. Its next harmful status is delayed until round end; moving the client or cleansing it dismisses the Appeal. One Appeal per client.

### Rent-a-Cop — Mall Rules

`rent-a-cop` · 2 Motion / 2 Hands

On Reveal: Post a warning here through next round. The next enemy character that moves into or out of this district gets -2 Hands after moving. One warning per district per side.

### Redneck Evil — Chain Reaction

`redneck-evil` · 5 Motion / 5 Hands

On Reveal: Apply 2 Burn to the strongest enemy here and prime it through next round. Its next Burn damage splashes 2 damage to the weakest other enemy here. One primer per target; splash cannot repeat.

### Nigerian Father — High Expectations

`nigerian-father` · 4 Motion / 4 Hands

On Reveal: Set a goal for your weakest other ally here with 3 or fewer Hands: reach 5 Hands by the end of next round. If achieved, it gains Protection and +2 Hands. One goal per side.

### Inmate Kingpin — Run the Yard

`inmate-kingpin` · 5 Motion / 5 Hands

On Reveal: Give Contraband to your weakest other Inmate anywhere. Each later Inmate deployment or move passes it to that Inmate. After three distinct carriers, give all three surviving carriers +2 Hands. Once per Kingpin per match.

### Mural Apprentice — Fresh Color

`mural-apprentice` · 2 Motion / 2 Hands

On Reveal: Paint this district with your element through next round. The next other friendly character of a different element entering here gains +2 Hands. One paint per district per side.

### Night Cashier — Closing Time

`night-cashier` · 2 Motion / 2 Hands

On Reveal: On round 4 or later, issue a Receipt here through next round. Your next other character costing 2 or less played here earns a one-use local 1-Motion character discount starting next round, minimum 1.

### Ahki — The Usual

`ahki` · 2 Motion / 2 Hands

On Reveal: Remember your weakest other ally here and give it +1 Hand. Its next return to this district gains +2 Hands, once.

### First Aid Kit — Emergency Kit

`first-aid-kit` · 2 Motion / 0 Hands

On Reveal: Cleanse your weakest afflicted character here, or your weakest character if none is afflicted. Store one emergency heal on it: after enemy damage, restore up to 2 Hands actually lost if it survives. One kit per target.


## The 10 hand-bond replacements

These cards no longer scale from matching cards held in hand, including legacy serialized copies.

### Honest Thot — Meet Me There

`honest-thot` · 1 Motion / 2 Hands

On Reveal: Name your weakest other district. Through next round, your next Air character entering there gains +2 Hands. One welcome per side.

### Abuela — Eat Something

`abuela` · 4 Motion / 4 Hands

On Reveal: Restore up to 3 Hands actually lost to damage to your weakest injured ally anywhere and Protect it. If nobody is injured, Protect your weakest other ally here.

### Ice Cream Truck — Neighborhood Route

`ice-cream-truck` · 3 Motion / 2 Hands

On Reveal: Leave a Treat here. Ongoing: The first time you visit each district, leave one Treat. The next other friendly character arriving there gains +2 Hands. One Treat per district per side; each district once per truck.

### Torta — Hold Our Ground

`torta` · 2 Motion / 2 Hands

On Reveal: Pair your two weakest other Earth allies here. At next round end, if both remain here and you are not losing this district, each gains +2 Hands. One pair per side.

### Concrete — Set in Stone

`concrete` · 1 Motion / 1 Hands

On Reveal: Anchor your weakest other Earth ally here through next round. Its next hostile forced move is blocked and it gains +2 Hands. One anchor per ally.

### Rooftop Gardener — Rooftop Harvest

`rooftop-gardener` · 1 Motion / 1 Hands

On Reveal: Plant a Seed here. At the end of next round, your weakest Plant ally here gains +3 Hands. One plot per district per side.

### Incel — Leave Me Alone

`incel` · 2 Motion / 3 Hands

Ongoing: At round end, if you are the only friendly character here, gain +2 Hands, at most twice per match.

### Electrician Foreman — Everybody on the Clock

`circuit-captain` · 4 Motion / 4 Hands

On Reveal: Post two jobs through next round. Your next two different Electric allies played or moved each gain +1 Hand. When both take a job, each gains another +2 Hands and restore 1 Motion once. One job pair per side.

### Performative Male — Show Up Then

`canopy-keeper` · 3 Motion / 3 Hands

On Reveal: Promise to help your weakest other ally here. Through next round, if another card gives it Hands, cleanses it, or heals enemy damage, it gains +2 Hands and you gain +1 Hand, once.

### The Flight Plug — Boarding Pass

`slipstream` · 3 Motion / 3 Hands

On Reveal: Give your weakest other Air ally here a Boarding Pass through next round. Its next successful move gives it +2 Hands and Protection, once.

