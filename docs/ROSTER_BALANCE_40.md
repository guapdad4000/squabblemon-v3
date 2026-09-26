# Squabblemon rules 11 — 40-card roster pass

Implemented locally on top of `5a6a48c`. Both the shared game engine and printed card rules use this patch. Online rules and card-balance versions are 11. Collection IDs, art, upgrade IDs and ownership are preserved. No deployment was performed.

## Validation

- 1,016 game regression tests pass, including 45 new behavior checks across both owners. Three entry-bundle tests and 12 multiplayer tests also pass.
- Shared-engine declarations rebuilt; application TypeScript and production build pass. Public entry: 200.4 KiB against 475 KiB budget. Vite still reports large lazy chunks.
- Current smoke matrix: 160/160 matches completed, zero engine failures. This is four decks, two district seeds, two rotations, both training tiers and mirrored seats; it is not full-roster optimization.
- The balance gate intentionally fails with seven blocker flags: Captain Jigga/Tayaty (tier 3), Cornball/Tayaty (tier 3), Luigion/Tayaty (tier 3), Roaster/Tayaty (tier 3), Sneaker/Tayaty (tiers 0 and 3), and turn-order advantage. These six combo values are unchanged from the baseline smoke run. Player-seat score is 26.25%, versus 25.625% before; neither result establishes fair turn order.
- The broader scripts suite has 15 passes and three failures. Both ability-success classifier tests and the player-route transaction source assertion fail on the baseline too. They were not relaxed or hidden. Do not rely on this lab's ability-success metric for the new contract kits without auditing the classifier.
- Browser verification: all 40 updated card-detail dialogs match the current engine text; desktop and mobile layouts render without horizontal overflow. Review filtering covers all 202 cards and shows 40 implemented revisions; no page errors were detected.
- Original 7,440-match rankings remain pre-patch evidence. The 15 stronger-card audits and 43 deliberate-combo reviews are still open. Targeted performance comparisons and human playtesting remain necessary.

## What changed

Each entry includes its prior and current Motion / Hands budget and the authoritative final rule. Persistent rewards are bounded by their printed per-target, per-side or per-round limits. Tests cover protection, failed movement, one-use rewards, replay serialization, both owners and unchanged training behavior.

### Scammer (`scammer`)

3 Motion / 3 Hands → **3 Motion / 3 Hands**.

**Before:** On Reveal: Copy the base Hands (up to 7) and printed ability of the highest-Hands enemy here. Copied On Reveal abilities do not trigger.

**Now:** On Reveal: Copy the base Hands (up to 7) and printed ability of the strongest active Ongoing enemy here. If none exists, copy only the strongest enemy's base Hands (up to 7) and gain +1 Hand. Copied entrances never trigger.

### Closet Nerd (`nerd`)

4 Motion / 3 Hands → **4 Motion / 3 Hands**.

**Before:** On Reveal: Silence the highest-Hands enemy here, bypassing Wifey's Side Eye. Protection still blocks this. If you newly Silence an active Ongoing ability, reveal one enemy hand card.

**Now:** On Reveal: Silence the highest-Hands active Ongoing enemy here, otherwise the strongest enemy, bypassing Wifey's Side Eye. Protection still blocks this. Newly interrupting an active Ongoing ability grants +1 Hand and reveals one enemy hand card.

### Edgar (`edgar`)

2 Motion / 2 Hands → **2 Motion / 2 Hands**.

**Before:** On Reveal: If another friendly card costing 2 or less is here, gain +1 Hands.

**Now:** On Reveal: If another friendly character here costs 2 or less, gain +2 Hands.

### Man-Man (`manman`)

3 Motion / 3 Hands → **3 Motion / 3 Hands**.

**Before:** On Reveal: If at least two other friendly cards are here, gain +2 Hands.

**Now:** On Reveal: If you have at least 2 other friendly characters here, gain +3 Hands.

### Ice Cream Truck (`icecream`)

3 Motion / 2 Hands → **3 Motion / 2 Hands**.

**Before:** On Reveal: Leave a Treat here. Ongoing: The first time you visit each district, leave one Treat. The next other friendly character arriving there gains +2 Hands. One Treat per district per side; each district once per truck.

**Now:** On Reveal: Give your weakest other ally here a +2-Hand Treat, or leave it for the next friendly arrival if alone. Ongoing: First visit to each other district leaves one +2 Treat for a later friendly arrival. One Treat per district per side; each district once per truck.

### Cognac Bottle (`cognac`)

1 Motion / 0 Hands → **1 Motion / 0 Hands**.

**Before:** On Reveal: Give your lowest-Hands friendly character here +2 Hands.

**Now:** On Reveal: Give your weakest friendly character here +2 Hands, or +3 if it is Fire.

### Corner Busker (`busker`)

2 Motion / 1 Hands → **2 Motion / 1 Hands**.

**Before:** Ongoing: Two different other allies moving here earn two Tips for +3 Hands to your weakest other ally here. At most one payout per round; the same character cannot tip twice toward one payout.

**Now:** Ongoing: The first distinct other ally moving here gives your weakest other local ally +1 Hand; the second gives +2. At most one two-visitor payout per round. A visitor cannot tip twice toward a payout.

### Corner Coach (`cornercoach`)

3 Motion / 3 Hands → **3 Motion / 3 Hands**.

**Before:** On Reveal: Coach your weakest eligible ally here through next round. After its entrance fails, later other friendly character placements retry it until one succeeds. At most one successful retry; copying, summoning, refunds, choices and reworked entrances are excluded.

**Now:** On Reveal: Coach your weakest eligible ally here through next round. Later friendly placements retry its failed entrance until one succeeds. Coachable: Edgar, Nguyen, Man-Man, Transplant, Bodega Cat, Dog Walker, Sports Prodigy, Homeless YN, Dragonfly Jones, OG Uncle, Barber Bro, Night Shift Medic, Squabble House Worker — Female, The Feds. No other kits qualify.

### Dog Walker (`dogwalker`)

2 Motion / 2 Hands → **2 Motion / 2 Hands**.

**Before:** On Reveal: If at least two other friendly cards are here, gain +2 Hands.

**Now:** On Reveal: If at least 2 other friendly characters are here, gain +3 Hands.

### Chess Regular (`chessregular`)

3 Motion / 3 Hands → **3 Motion / 3 Hands**.

**Before:** On Reveal: Mark the strongest enemy in each of two different districts through next round. The next enemy character placement saves marks in that district; give each remaining marked enemy -2 Hands. One Fork per side.

**Now:** On Reveal: Mark the strongest enemy in up to two different districts through next round. With one mark, wait for an enemy placement in another district to complete the Fork. The next enemy placement after completion saves that district; other marked enemies lose 2 Hands. One Fork per side.

### Dance Circle Captain (`dancecaptain`)

3 Motion / 3 Hands → **3 Motion / 3 Hands**.

**Before:** Ongoing: Once per round, the first friendly dancer move sets a destination. The next different friendly dancer arriving there gains +2 Hands. Dancers: Break, Bboy, Dance Circle Captain.

**Now:** Ongoing: Once per round, the first friendly dancer move sets a destination. The next different friendly character moving there gains +2 Hands. Dancers: Break, Bboy, Dance Circle Captain.

### Subway Magician (`subwaymagician`)

4 Motion / 3 Hands → **3 Motion / 3 Hands**.

**Before:** On Reveal: Apply Weaken to the highest-Hands enemy here, then move to your weakest other district.

**Now:** On Reveal: Apply Weaken to the highest-Hands enemy here, then move to your weakest other district.

### Midnight Mayor (`midnightmayor`)

3 Motion / 2 Hands → **3 Motion / 2 Hands**.

**Before:** On Reveal: Nominate your weakest other district through next round. The next friendly move there opens a one-use local 1-Motion character discount, minimum 1, and leaves a key: the next different friendly arrival there gets Protection. One nomination per side.

**Now:** On Reveal: Nominate your weakest other district through next round. The next friendly move there grants that mover Protection and opens one local 1-Motion character discount, minimum 1. One nomination per side.

### Phone Charger (`charger`)

1 Motion / 0 Hands → **1 Motion / 0 Hands**.

**Before:** On Reveal: Restore 1 Motion for each friendly character here, up to 3.

**Now:** On Reveal: Restore 1 Motion per friendly character here, up to 3. With at least 3 characters here, also Protect your weakest local Electric character.

### STUD (`stud`)

3 Motion / 3 Hands → **3 Motion / 3 Hands**.

**Before:** On Reveal: Bond to your weakest other ally here. Once per match while together, intercept its next targeted hostile ability, then move the surviving pair to your weakest other district with two spaces. Protect your partner if both escape.

**Now:** On Reveal: Bond to your weakest other ally here. Once while together, intercept its next targeted hostile ability, then try to move the surviving pair to your weakest other district with two spaces. Protect the surviving partner whether the escape succeeds or is blocked.

### Divorced Dad (`divorceddad`)

3 Motion / 3 Hands → **3 Motion / 3 Hands**.

**Before:** On Reveal: Bring your weakest movable ally costing 2 or less from another district here if there is room; Protect it. At the end of next round, try to return it to its original district. One visit per side.

**Now:** On Reveal: Bring your weakest movable ally costing 2 or less from another district here if there is room; Protect it. Through next round, its first successful move back to its original district gains +1 Hand. It never returns automatically. One visit per side.

### BBL Demon (`bbldemon`)

4 Motion / 4 Hands → **4 Motion / 4 Hands**.

**Before:** On Reveal: Mark the strongest enemy district with Drama through next round. Their next character played there gets -2 Hands; if played elsewhere, BBL Demon gains +2 Hands. One Drama per side.

**Now:** On Reveal: Mark the strongest enemy district with Drama until the next enemy character placement or match end. Played there: that character gets -2 Hands. Played elsewhere: BBL Demon gains +2 Hands. One Drama per side.

### Failed Rapper (`failedrapper`)

2 Motion / 1 Hands → **2 Motion / 1 Hands**.

**Before:** On Reveal: Leave a Verse here through next round. The next different friendly character played here gains +2 Hands after its entrance. One Verse per district per side.

**Now:** On Reveal: Leave a Verse here through next round. The next different friendly character entering by play or movement gains +2 Hands. Played characters collect after their entrance. One Verse per district per side.

### Failed Athlete (`failedathlete`)

3 Motion / 2 Hands → **3 Motion / 3 Hands**.

**Before:** Ongoing: Once per match, gain +4 Hands and Protection when this district changes from tied or winning to losing. If deployed while losing, a later enemy arrival here while still losing can also trigger the comeback.

**Now:** Ongoing: Once per match, gain +4 Hands and Protection when this district changes from tied or winning to losing. If deployed while losing, a later enemy arrival here while still losing can also trigger the comeback.

### God of Hookah (`godofhookah`)

4 Motion / 4 Hands → **4 Motion / 4 Hands**.

**Before:** Ongoing: At round end, the first enemy damaged by Burn in each district passes 1 Burn to the weakest unburned enemy in the next district. New Burn waits until next round.

**Now:** Ongoing: At round end, the first enemy damaged by Burn in each district passes 1 Burn to the weakest unburned enemy in the next district. New Burn waits until next round. If that district has enemies but all were already burning, gain +1 Hand, at most once per round.

### Stylist (`stylist`)

3 Motion / 3 Hands → **2 Motion / 2 Hands**.

**Before:** On Reveal: Give your weakest other ally here +2 Hands and Protect.

**Now:** On Reveal: Give your weakest other ally here +1 Hand and Protection. Its next successful move refreshes its Protection once. One fitting per target.

### The Feds (`thefeds`)

4 Motion / 4 Hands → **4 Motion / 4 Hands**.

**Before:** On Reveal: Remove up to 4 bonus Hands from the strongest enemy here and Lock it. This removal cannot take it below its printed Hands.

**Now:** On Reveal: Remove up to 4 bonus Hands from the enemy here with the most removable bonus and Lock it. If none has bonus Hands, Lock the strongest enemy. Cannot reduce below printed Hands.

### Squabble House Worker — Female (`squabbleserver`)

1 Motion / 1 Hands → **1 Motion / 2 Hands**.

**Before:** On Reveal: Cleanse Burn and Freeze from your weakest affected ally here.

**Now:** On Reveal: Cleanse Burn and Freeze from your weakest affected ally here.

### Juneteenth Chair Guy (`juneteenth-chair-guy`)

5 Motion / 5 Hands → **4 Motion / 4 Hands**.

**Before:** Ongoing: Once per match, after an enemy damages another ally here or its Protection blocks an enemy ability, hit the attacker for 3 and give your weakest surviving other ally here Protection.

**Now:** Ongoing: Once per match, after an enemy damages another ally here or its Protection blocks an enemy ability, hit the attacker for 3 and give your weakest surviving other ally here Protection.

### Dominican Phone Salesman (`livewire`)

3 Motion / 2 Hands → **3 Motion / 3 Hands**.

**Before:** On Reveal: Move to your weakest other district. If you move, gain +1 Hand and your next card in a different district from your new location costs 1 less Motion.

**Now:** On Reveal: Move to your weakest other district. If you move, gain +1 Hand and your next card in a different district from your new location costs 1 less Motion.

### Airheaded Model (`cloudbreak`)

4 Motion / 4 Hands → **4 Motion / 4 Hands**.

**Before:** On Reveal: Move to your weakest other district. If you move, give your weakest ally left in the original district +2 Hands.

**Now:** On Reveal: Move to your weakest other district. If you move, give your weakest ally left in the original district +2 Hands and Protection.

### Ahki (`ahki`)

2 Motion / 2 Hands → **2 Motion / 2 Hands**.

**Before:** On Reveal: Remember your weakest other ally here and give it +1 Hand. Its next return to this district gains +2 Hands, once.

**Now:** On Reveal: Remember your weakest other ally here and give it +1 Hand. Its first departure from this district grants +1 Hand; its first later return grants another +1. Each reward once.

### ATL Scammer (`atl-scammer`)

3 Motion / 2 Hands → **2 Motion / 2 Hands**.

**Before:** On Reveal: File a claim through next round. Divert up to 1 Motion from the next enemy refund. If unused, at expiry open a one-use local 1-Motion character discount here through next round, minimum 1. Theft or fallback, never both.

**Now:** On Reveal: File a claim through next round. Divert up to 1 Motion from the next enemy refund. If unused, at expiry open a one-use local 1-Motion character discount here through next round, minimum 1. Theft or fallback, never both.

### Teacher Who Never Believed in Rappers (`teacher`)

3 Motion / 3 Hands → **3 Motion / 3 Hands**.

**Before:** On Reveal: Silence the strongest enemy here.

**Now:** On Reveal: Silence the highest-Hands enemy here with an active Ongoing ability. If none exists, Silence the strongest enemy here. Protection and district guards apply.

### Tattoo Artist (`tattoo-artist`)

3 Motion / 2 Hands → **3 Motion / 3 Hands**.

**Before:** On Reveal: Tattoo your weakest uninked other ally here and give it +1 Hand. Its next successful move grants Protection and +1 Hand. Each character can receive this tattoo only once per match.

**Now:** On Reveal: Tattoo your weakest uninked other ally here and give it +1 Hand. Its next successful move grants Protection and +1 Hand. Each character can receive this tattoo only once per match.

### Inmate Kingpin (`inmate-kingpin`)

5 Motion / 5 Hands → **4 Motion / 4 Hands**.

**Before:** On Reveal: Give Contraband and +1 Hand to your weakest other Inmate anywhere. Later Inmate deployments or moves pass it on; each of the first three distinct carriers gains +1 Hand. After three carriers, each survivor gains another +1. Once per Kingpin per match.

**Now:** On Reveal: Give Contraband and +1 Hand to your weakest other Inmate anywhere. Later Inmate deployments or moves pass it on; each of the first three distinct carriers gains +1 Hand. After three carriers, each survivor gains another +1. Once per Kingpin per match.

### Redneck Evil (`redneck-evil`)

5 Motion / 5 Hands → **5 Motion / 5 Hands**.

**Before:** On Reveal: Apply 2 Burn to the strongest enemy here and prime it through next round. Its next Burn damage splashes 2 damage to the weakest other enemy here. One primer per target; splash cannot repeat.

**Now:** On Reveal: Apply 2 Burn to the strongest enemy here and prime it through next round. Its next Burn damage, or its earlier defeat by your side, splashes 2 damage to the weakest other enemy in its district. One primer per target; splash cannot repeat.

### Lawyer (`lawyer`)

3 Motion / 2 Hands → **3 Motion / 3 Hands**.

**Before:** On Reveal: Cleanse your weakest other ally here and give it an Appeal through next round. Its next harmful status waits until round end; moving or cleansing the client dismisses it and earns one local 1-Motion character discount at the client, minimum 1.

**Now:** On Reveal: Cleanse your weakest other ally here and give it an Appeal through next round. Its next harmful status waits until round end; moving or cleansing the client dismisses it and earns one local 1-Motion character discount at the client, minimum 1.

### Nigerian Father (`nigerian-father`)

4 Motion / 4 Hands → **4 Motion / 4 Hands**.

**Before:** On Reveal: Tutor your weakest other ally here with 3 or fewer Hands for +1 Hand. If it gains another net +2 Hands by the end of next round, it gains Protection and +2 Hands. One goal per side.

**Now:** On Reveal: Tutor your weakest untutored other ally here for +1 Hand. If it gains another net +2 Hands by the end of next round, it gains Protection and +2 Hands. One goal per side; each character can be tutored once per match.

### Bouncer (`bouncer`)

4 Motion / 5 Hands → **4 Motion / 5 Hands**.

**Before:** On Reveal: Move the weakest enemy here to its weakest other open district.

**Now:** On Reveal: Move the strongest active Ongoing enemy here to another open enemy district. If none exists, move the strongest enemy here. Protection, capacity and movement restrictions apply.

### Rent-a-Cop (`rent-a-cop`)

2 Motion / 2 Hands → **2 Motion / 2 Hands**.

**Before:** On Reveal: Post a warning here through next round. The next enemy character that moves into or out of this district gets -2 Hands after moving. One warning per district per side.

**Now:** On Reveal: Post a warning here through next round. The next enemy character played here or moving into or out of this district takes 1 damage. One warning per district per side.

### The Shootout (`the-shootout`)

3 Motion / 0 Hands → **3 Motion / 0 Hands**.

**Before:** On Reveal: Hit up to 5 different random characters in this lane, friend or enemy, for -1 Hand each.

**Now:** Deal 2 damage to every enemy character here, then 1 damage to your strongest friendly character here. Enemy Protection and defenses apply.

### The Concert (`the-concert`)

3 Motion / 0 Hands → **2 Motion / 0 Hands**.

**Before:** On Reveal: Choose: give every character on both sides here +1 Hand, or give them all -1 Hand.

**Now:** On Reveal: Choose: give every character on both sides here +1 Hand, or give them all -1 Hand.

### The Setup (`the-setup`)

2 Motion / 0 Hands → **2 Motion / 0 Hands**.

**Before:** On Reveal: Sacrifice your weakest character here. Transfer its current Hands to your strongest other character here. Requires two allies.

**Now:** Sacrifice your weakest character here. Your strongest remaining character here inherits its current Hands plus 2. Requires two friendly characters.

### The Cookout (`the-cookout`)

3 Motion / 0 Hands → **3 Motion / 0 Hands**.

**Before:** On Reveal: Serve two Soul Food cards in random lanes on your side. Leave a Burnt Plate in a random lane on your side: at each round end it gives a random friendly character there 1 Burn.

**Now:** Deliver two Soul Food meals to occupied friendly districts, cleansing and granting +1 Hand to the weakest character in each chosen district. Leave a Burnt Plate: at this round end, give one local friendly character 1 Burn, then remove the plate.
