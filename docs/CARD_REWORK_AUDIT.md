# Full card identity and rework audit

Source: current card registry and engine at `c6b024a57518b2fe5ebcb5bfa7f0d4617f625fc6`, September 25, 2026. All 202 registered cards reviewed, including supports and Blockbusters. This document preserves the original proposed directions. The approved 51-card wave is now implemented; see [final rules and implementation adjustments](CREATIVE_CARD_REWORKS.md) and [balance results](../scripts/results/creative-wave/README.md). The proposals below are historical design notes, not the final card text.

Found **41 candidates**: 13 priority-one cost/payoff or overlap problems, 23 priority-two identity candidates, and 5 optional polish candidates. Separately, 10 pure hand-bond cards merit identity/power redistribution, not buffs. Other cards remain unchanged pending evidence.

This is a static design audit, not a live win-rate ranking. Cost/body comparisons are at untrained printed values. Type, upgrade recipients, timing, counterplay, and deck context can change relative strength. The prior movement audit identifies Earth and Electric bond scaling as a major strength contributor; adding transport or refund value to those decks requires paired testing.

## Priority 1: fix the clearest payoff and overlap problems

### YN ATV Lord — 4 Motion / 4 Hands
**Current problem:** 4 Motion buys a one-ally move and +1. Break provides that pattern at 2; Conductor at 4 adds a cleanse and +3/+4.
**Proposed direction:** Hop On: ATV and one passenger travel together. Reserve two open slots atomically; if either cannot move, neither moves. Passenger gets arrival Protection. Once per deployment; replace the old rider buff.

### Mr. Trick — 3 Motion / 3 Hands
**Current problem:** Pays up to 2 additional Motion for at most +2 to one ally; Ahki gives +2 at a cheaper deployment price.
**Proposed direction:** Open Tab: sponsor one ally. Its first successful hostile hit earns one Tip; cash in at round end for a capped reward. One active tab per side; no recursive tip income.

### Dr. Umah — 4 Motion / 3 Hands
**Current problem:** 4/3 with the same printed local +1 aura burst as 3/2 BBL Nice; upgrade recipients differ but the base identity overlaps.
**Proposed direction:** Group Project: mark two other allies of different elements. Their next successful base abilities each contribute once; when both contribute, reward the pair. No copying abilities or reward loops.

### Hooper — 5 Motion / 5 Hands
**Current problem:** 5 Motion needs the lane still losing after his own arrival; otherwise the entrance does nothing. Sports Prodigy offers a smaller similar swing for 3.
**Proposed direction:** Ankle Breaker: challenge one visible defender. If it leaves before the next round ends, Hooper gets an uncontested finish; if it stays, resolve one bounded duel. Opponent can see the challenge.

### Failed Athlete — 3 Motion / 2 Hands
**Current problem:** Needs round 4+ AND a losing lane for a vanilla +3; failure on either condition leaves a 3/2.
**Proposed direction:** One Last Shot: a once-per-match comeback activates when his district flips from winning/tied to losing after arrival. A visible ready marker lets the opponent play around it.

### Block Party Titan — 6 Motion / 7 Hands
**Current problem:** 6 Motion finisher distributes at most three +1 grants. Mansa Musa distributes similar or better grants plus a discount at 4, with a smaller body.
**Proposed direction:** Everybody Outside: rally one movable ally from each other district into his district. Pay out for actual arrivals only, capped at two, with reserved capacity. Needs a cost/body budget review.

### Chess Regular — 3 Motion / 3 Hands
**Current problem:** Requires exactly one enemy for just 1–2 Burn; the card does not actually create a fork.
**Proposed direction:** Fork: visibly mark enemies in two districts. The opponent’s next character placement saves that district’s mark; the other receives one bounded debuff. Expiring, nonstacking marks.

### DMV Worker — 2 Motion / 2 Hands
**Current problem:** One expiring +1 tax competes with Landlord’s recurring tax, better body, and tax growth at the same cost.
**Proposed direction:** Take a Number: post a visible queue ticket. The next enemy entrance here is delayed until round end, then resolves if its source remains active. One ticket, no repeated postponement; substantial timing work.

### Tattoo Artist — 3 Motion / 2 Hands
**Current problem:** 3/2 gives +2 and Protection, overlapping 3/3 Stylist; its upgrades improve the recipient instead of itself.
**Proposed direction:** Permanent Ink: mark one ally with a tattoo that stays with that instance through movement. First successful move stamps a one-use ward. Once per instance, no extra tattoos from echoes.

### STUD — 3 Motion / 3 Hands
**Current problem:** 3/3 gives +1 and Protection; Stylist gives +2 and Protection on the same body and cost with matching self upgrades.
**Proposed direction:** Hold You Down: bond to one ally. Intercept its first targeted hit while together, then the surviving pair switch districts if there is room. Once per match; no interceptor chains.

### Stoner Sr. — 3 Motion / 2 Hands
**Current problem:** 3/2 only pays off when allies need freeze/silence cleansing; Night Shift Medic has a larger body, broader cleanse, and Light payoff at 3.
**Proposed direction:** Pass It Around: remove a harmful status from one ally and create a visible, one-use chill token for the next friendly arrival. Never copy a harmful status onto a teammate.

### Laundromat Regular — 2 Motion / 2 Hands
**Current problem:** 2/2 needs an already frozen or silenced target; other low-cost healers have stronger or broader useful branches.
**Proposed direction:** Spin Cycle: clean one ally now, then its next move leaves one removed status behind. One queued cleanse per card; movement remains optional.

### First Aid Kit — 2 Motion / 0 Hands
**Current problem:** 2-Motion support only cleanses freeze/silence, while Soul Food, Hair Stylist and mass-cleanse characters offer alternative value.
**Proposed direction:** Emergency Kit: cleanse one afflicted ally now and leave one visible, one-use emergency heal for actual damage later. Consumed kit cannot be bounced for another stored charge.

## Priority 2: give functional cards their own game plan

### Black Cowboy — 3 Motion / 3 Hands
**Current problem:** Lasso has a real tactical role, but pulling an enemy currently has no character-specific follow-through. Identity rework, not proven weak.
**Proposed direction:** Wanted: place a visible bounty on the lasso target. If your side defeats it before expiry, collect one capped reward. Failed or blocked lasso does not award a bounty payout.

### Regular guy named LeBron James — 4 Motion / 4 Hands
**Current problem:** Recently buffed and useful; still mostly cleanse/protection plus a conditional self boost. Identity candidate, not another automatic buff.
**Proposed direction:** Definitely Not Him: designate the protected ally as his teammate. First time that ward breaks, he makes one revenge play against the responsible enemy. Replace the conditional +3; once per match.

### Juneteenth Chair Guy — 5 Motion / 5 Hands
**Current problem:** 5/5 combines one -2 hit and one ward, with little payoff beyond cheaper damage/protection tools.
**Proposed direction:** Fold-Out Justice: retaliate against the first enemy that successfully damages an ally here, then leave a one-use Chair token for an ally. One retaliation; token cannot summon another chair.

### Baby Momma — 4 Motion / 5 Hands
**Current problem:** 4/5 only gets +2 when outnumbered including herself; reactive identity is reduced to an arrival count.
**Proposed direction:** Mama Bear: mark her weakest ally as family. First enemy hit on that ally provokes a counterattack; if it dies, she takes its open place and gains a bounded revenge reward.

### Techbro Rich — 4 Motion / 5 Hands
**Current problem:** 4/5 gains +2 for having any ally. Functional, but VC Funded Flex has no investment or risk decision.
**Proposed direction:** Burn Rate: one visible round of funding advances Motion now; unused funding evaporates and used funding creates a fixed next-round repayment. No negative Motion or repeat financing loop.

### Failed Rapper — 2 Motion / 1 Hands
**Current problem:** 2/1 local cheap-card +1 overlaps Corner Busker; no failed-performance/comeback identity.
**Proposed direction:** One More Verse: leave a verse in this district. The next different friendly character entrance plays its small encore once; replay cannot trigger another replay.

### Corner Busker — 2 Motion / 1 Hands
**Current problem:** 2/1 rewards only other 1-Cost cards here; narrower version of Failed Rapper’s cheap-card buff.
**Proposed direction:** Pass the Hat: first friendly character entering from another district each round gives a Tip. Two Tips purchase a single local benefit; no unlimited Motion generation.

### Dance Circle Captain — 3 Motion / 3 Hands
**Current problem:** A one-time +3 for covering three lanes does not interact with the dancers’ movement.
**Proposed direction:** Follow My Lead: the first friendly dancer move each round sets a destination; the next qualifying dancer arrival there earns an encore. Shared cap and no automatic move loop.

### Break — 2 Motion / 2 Hands
**Current problem:** Moves an ally and gives +1; mechanically serviceable but several transport cards crowd it.
**Proposed direction:** Floor Sweep: move a teammate out, then leave a one-use floor mark that weakens the next enemy entering the vacated district. One mark and expiry.

### Bboy — 2 Motion / 2 Hands
**Current problem:** Same basic self-move/arrival-ally +1 pattern as Car Meet Kid and YN Gokarter, with matching generic upgrade structure.
**Proposed direction:** Windmill: bounce once through an occupied friendly district before landing in another. Both destinations visible; two successful moves maximum, no repeat trigger chain.

### YN Gokarter — 2 Motion / 2 Hands
**Current problem:** Self-move plus recipient +1 repeats Bboy’s printed pattern.
**Proposed direction:** Lap Record: track distinct districts visited. Complete all three to earn a once-per-match finish; revisits never count twice and reward cannot create another move.

### OG Skater — 3 Motion / 3 Hands
**Current problem:** Self-move +2 repeats OG Dominican’s base effect, although stats and upgrade targeting differ.
**Proposed direction:** Still Got It: leave a one-use grind route between origin and destination. Next movable ally can follow it; consume route before travel to prevent loops.

### Divorced Dad — 3 Motion / 3 Hands
**Current problem:** 3/3 gains +2 if alone against an enemy; isolation has no continuing story.
**Proposed direction:** My Weekend: temporarily shelter one low-cost ally in his district, then return it to its original district next round if legal. Failure to return must resolve visibly, never strand or delete it.

### BBL Nice — 3 Motion / 2 Hands
**Current problem:** Local +1 team buff overlaps Dr. Umah and basic supports.
**Proposed direction:** Good Company: pair two allies; the first externally earned positive buff on one shares a capped amount with the other. Shared buffs cannot retrigger the bond.

### BBL Demon — 4 Motion / 4 Hands
**Current problem:** 4/4 with a plain local -1 sweep does little to distinguish the personality.
**Proposed direction:** Problem Energy: place one expiring Drama mark on a district. The opponent chooses through placement: feed the marked lane or let Demon cash out elsewhere. One visible consequence, not both.

### Barber Bro — 4 Motion / 4 Hands
**Current problem:** Local +2/-1 is useful but generic beside newer buff/debuff cards.
**Proposed direction:** Line Up: trim excess bonus Hands from a marked enemy into a capped fresh-cut benefit for an ally. Cannot trim base Hands or transfer the same point twice.

### Corner Coach — 3 Motion / 3 Hands
**Current problem:** 3/3 gives a single local +2; Ahki supplies the same base grant at 2/2.
**Proposed direction:** Run It Back: designate a trainee. After its first failed entrance, grant a one-time retry on a later friendly placement when its conditions become valid. Exclude copy, summon, refund, and choice effects initially.

### Midnight Mayor — 3 Motion / 2 Hands
**Current problem:** 3/2 merely gains up to +3 for local type diversity; Keys to the City has no city control.
**Proposed direction:** Keys to the City: visibly nominate one district. Your next cross-district arrival there opens a one-use local discount; one nomination and no stacking with stronger tokens.

### Hater — 2 Motion / 2 Hands
**Current problem:** 2/2 applies a plain -1; lacks a response to the growth it ought to hate.
**Proposed direction:** Must Be Nice: first enemy positive buff here each round is reduced by a capped amount; Hater gains a small consolation only on an actual reduction. Never negate every buff.

### ATL Scammer — 3 Motion / 2 Hands
**Current problem:** Arrival steals at most 1 currently available Motion; payoff depends heavily on opponent spending order.
**Proposed direction:** Pending Transfer: leave an expiring public claim. The next enemy refund before expiry diverts at most 1 Motion, then the claim disappears. Refund caps and opponent counterplay remain intact.

### Lawyer — 3 Motion / 2 Hands
**Current problem:** 3/2 cleanse+Protection competes with several cheaper cleansing/ward options.
**Proposed direction:** Objection: store a visible appeal on an ally. The next removable hostile status is held pending until round end, giving you one turn to move or cleanse the client. One appeal, no permanent immunity.

### Rent-a-Cop — 2 Motion / 2 Hands
**Current problem:** One movement Lock is often blank outside movement matchups.
**Proposed direction:** Mall Rules: issue one visible trespass warning. The next attempted enemy move through this lane consumes the warning and charges a bounded penalty; never combine permanent Lock and endless tax.

### Redneck Evil — 5 Motion / 5 Hands
**Current problem:** 5/5 gives -2 and 1 Burn to one target; Chain Reaction does not actually chain.
**Proposed direction:** Chain Reaction: prime one enemy. Its first later Burn detonation splashes a capped hit to one adjacent target. Splash cannot prime or recurse.

## Priority 3: optional personality polish; prove the need first

### Nigerian Father — 4 Motion / 4 Hands
**Current problem:** Threshold-based +2 grants are useful but leave High Expectations as a flat stat check.
**Proposed direction:** High Expectations: set a visible target for one small ally’s Hands by next round. Meeting it awards a one-time graduation benefit; missing it never erases earned stats.

### Inmate Kingpin — 5 Motion / 5 Hands
**Current problem:** Cellblock finisher is currently a local inmate-weighted stat burst. Needs deck-level evidence before strengthening.
**Proposed direction:** Run the Yard: one inmate holds Contraband. Move the stash between inmates through actual deployment/movement; the third distinct carrier pays out once. No new summon engine.

### Mural Apprentice — 2 Motion / 2 Hands
**Current problem:** Diversity grants an enemy Lock; otherwise self +1. Interesting hook, but shallow artistic identity.
**Proposed direction:** Fresh Color: paint one district with a temporary named color. The next different friendly element entering it receives a one-time benefit; clear the paint after use.

### Night Cashier — 2 Motion / 2 Hands
**Current problem:** Late-round 1 Motion refund is functional but generic.
**Proposed direction:** Closing Time: leave a one-use receipt for the next affordable character played here late in the round. Redeem next round, minimum cost 1; avoid a second unconstrained refund engine.

### Ahki — 2 Motion / 2 Hands
**Current problem:** 2/2 local +2 is an efficient basic helper but could embody repeat customers.
**Proposed direction:** The Usual: remember one previously deployed ally identity. Its next return to this district earns a one-time loyalty benefit. Do not require duplicate copies in the deck.

## Separate project: hand-bond identities

Do not add these as bonuses on top of the existing global grants. They would replace part or all of the bond, with paired deck and training-tier tests. The existing Earth/Electric audit supports caution; it does not prove that every other elemental bond is equally strong.

| Card | Potential replacement identity |
| --- | --- |
| Honest Thot | one declared destination gives the next Air arrival a welcome benefit. |
| Abuela | serve a limited plate to a hurt ally; once fed, that ally cannot claim another this round. |
| Ice Cream Truck | make an actual route; first visit per district leaves one consumable treat. |
| Torta | reward one Earth pair holding their lane rather than buffing the entire board from hand. |
| Concrete | anchor one Earth position; reward resisting displacement once, without duplicating Asphalt Apostle. |
| Rooftop Gardener | plant one visible seed that matures after a delay and consumes its plot. |
| Incel | isolation creates a bounded self payoff; stop globally feeding Dark from hand. |
| Electrician Foreman | assign two jobs to different Electric allies; completed jobs cash out once. |
| Performative Male | publicly promise one helpful action; receive a benefit only if another ally actually benefits. |
| The Flight Plug | issue one boarding pass for a later Air move, consumed on use. |

## Recommended implementation batches

1. Mr. Trick, Dr. Umah, Hooper, Failed Athlete: clear new decisions outside the already dominant Earth engine.
2. Black Cowboy, Chair Guy, LeBron: bounties and visible retaliation; replace existing value rather than simply adding damage.
3. ATV Lord, Bboy, Gokarter, OG Skater: distinct movement identities, with Earth bond and Tin Man/Lion interaction checks.
4. Tattoo Artist, STUD, Laundry, Stoner Sr., First Aid: separate protective and recovery jobs.
5. Remaining candidates after the above establish reusable state and counterplay. DMV/Coach delayed or repeated entrances require the most timing and exploit testing.

Keep some simple commons. Car Meet Kid, OG Dominican and basic one-cost enablers can remain the readable baseline while their near-duplicates become specialists. Ronald/Wiseman and the recently improved Oz, Cellblock and elemental engines should get play data before more changes.

## Upgrade design

Many candidates have three generic +1 self rewards. A replacement kit should keep owned card and upgrade IDs stable, but aim upgrades at the new identity within a shared power budget. Audit every tier; do not add more triggers, wider targets and extra Motion simultaneously. Target-power upgrades differ from self-power upgrades and invalidate claims of strict equivalence even when base text overlaps.

## Complete roster disposition

| Engine ID | Card | Cost/Hands | Disposition | Current ability |
| --- | --- | --- | --- | --- |
| buddy | BUDDY | 3/4 | Keep; no urgent rework identified | Buddy Buds |
| folks | FOLKS | 4/3 | Keep; no urgent rework identified | Whole Block Hot |
| drfade | Dr. Fade | 4/6 | Keep; no urgent rework identified | The First Lesson |
| guap | GUAP | 6/6 | Keep; no urgent rework identified | FINNAM! |
| bossbabe | Boss Bae | 3/3 | Keep; no urgent rework identified | Network Boost |
| scammer | Scammer | 3/3 | Keep; no urgent rework identified | Imposter |
| rastamon | Rastamon | 2/2 | Keep; no urgent rework identified | Natural Cure |
| roaster | All Jokes Roaster | 3/3 | Keep; no urgent rework identified | Ratio'd Receipts |
| nerd | Closet Nerd | 4/3 | Keep; no urgent rework identified | Unaware |
| cornball | Cornball | 1/1 | Keep; no urgent rework identified | Scare the Hoes |
| plug | Plug | 1/2 | Keep; no urgent rework identified | Connections |
| streamer | Live Streamer | 2/1 | Keep; no urgent rework identified | Follower Frenzy |
| gamer | Gamer | 3/3 | Keep; no urgent rework identified | City Tour |
| techbro | Techbro Rich | 4/5 | Priority 2 | VC Funded Flex |
| bikelife | Bikelife YN | 2/2 | Keep; no urgent rework identified | Ride Out |
| vibe | Cool Vibe YN | 2/2 | Keep; no urgent rework identified | Wave Check |
| hooper | Hooper | 5/5 | Priority 1 | Ankle Breaker |
| baby | Baby Momma | 4/5 | Priority 2 | Mama Bear |
| oink | Officer Oink | 5/6 | Keep; no urgent rework identified | Civic Pressure |
| snow | Snow Bunny | 3/2 | Keep; no urgent rework identified | Cold Shoulder |
| wifey | Wifey | 4/4 | Keep; no urgent rework identified | Side Eye |
| barber | Barber Bro | 4/4 | Priority 2 | Line Up |
| bottle | Bottle Girl | 2/3 | Keep; no urgent rework identified | Last Call |
| sneaker | Sneaker Reseller | 3/3 | Keep; no urgent rework identified | Flip Season |
| church | Church Auntie | 3/4 | Keep; no urgent rework identified | Covered |
| landlord | Landlord | 2/3 | Keep; no urgent rework identified | Rent Due |
| carmeet | Car Meet Kid | 2/2 | Keep; no urgent rework identified | Sideshow |
| promoter | Promoter | 3/3 | Keep; no urgent rework identified | Guest List |
| nail | Nail Tech | 2/3 | Keep; no urgent rework identified | Fresh Set |
| og | OG Uncle | 4/5 | Keep; no urgent rework identified | Back In My Day |
| delivery | Delivery Demon | 1/1 | Keep; no urgent rework identified | Drop Off |
| youngbull | Young Bull | 2/2 | Keep; no urgent rework identified | Step Up |
| transplant | Racially Ambiguous Transplant | 1/1 | Keep; no urgent rework identified | New Here |
| tayaty | Bad Lil Cousin Tayaty | 1/1 | Keep; no urgent rework identified | Act Up |
| edgar | Edgar | 2/2 | Keep; no urgent rework identified | Gang Check |
| nguyen | Nguyen | 2/2 | Keep; no urgent rework identified | Side Project |
| manman | Man-Man | 3/3 | Keep; no urgent rework identified | All Hands |
| pinaynurse | Pinay Nurse | 2/2 | Keep; no urgent rework identified | Check In |
| honestthot | Honest Thot | 1/2 | Bond redesign; no blanket buff | Air Bond |
| earthy | Earthy Sugar Foot | 1/1 | Keep; no urgent rework identified | Grounded |
| abuela | Abuela | 4/4 | Bond redesign; no blanket buff | Light Bond |
| icecream | Ice Cream Truck | 3/2 | Bond redesign; no blanket buff | Water Bond |
| shiesty | Shiesty YN | 1/1 | Keep; no urgent rework identified | Mean Mug |
| torta | Torta | 2/2 | Bond redesign; no blanket buff | Earth Bond |
| waterboy | Water Boy | 1/1 | Keep; no urgent rework identified | Cold Water |
| buspass | Bus Pass | 0/0 | Keep; no urgent rework identified | All-Day Transfer |
| cognac | Cognac Bottle | 1/0 | Keep; no urgent rework identified | Liquid Courage |
| bustdown | Bust-Down Watch | 1/0 | Keep; no urgent rework identified | Wrist Check |
| soulfood | Soul Food | 1/0 | Keep; no urgent rework identified | Full Plate |
| concrete | Concrete | 1/1 | Bond redesign; no blanket buff | Earth Bond |
| bodegacat | Bodega Cat | 1/1 | Keep; no urgent rework identified | Counter Claim |
| crossingguard | Crossing Guard | 2/2 | Keep; no urgent rework identified | Safe Crossing |
| laundry | Laundromat Regular | 2/2 | Priority 1 | Fresh Cycle |
| busker | Corner Busker | 2/1 | Priority 2 | Loose Change |
| cornercoach | Corner Coach | 3/3 | Priority 2 | Run It Back |
| nightcashier | Night Cashier | 2/2 | Priority 3 | Late Shift |
| dogwalker | Dog Walker | 2/2 | Keep; no urgent rework identified | Walk the Pack |
| mural | Mural Apprentice | 2/2 | Priority 3 | Fresh Color |
| chessregular | Chess Regular | 3/3 | Priority 1 | Quiet Fork |
| gardener | Rooftop Gardener | 1/1 | Bond redesign; no blanket buff | Plant Bond |
| piratedj | Pirate Radio DJ | 3/2 | Keep; no urgent rework identified | Citywide Signal |
| dancecaptain | Dance Circle Captain | 3/3 | Priority 2 | Whole Block Moving |
| nightmedic | Night Shift Medic | 3/4 | Keep; no urgent rework identified | All Clear |
| subwaymagician | Subway Magician | 4/3 | Keep; no urgent rework identified | Now You See Me |
| ogdominican | OG Dominican | 3/4 | Keep; no urgent rework identified | Block Shortcut |
| conductor | Last Train Conductor | 4/3 | Keep; no urgent rework identified | Last Stop |
| midnightmayor | Midnight Mayor | 3/2 | Priority 2 | Keys to the City |
| bigzoey | Big Zoey | 3/3 | Keep; no urgent rework identified | Hold the Block |
| leroy | Leroy | 3/4 | Keep; no urgent rework identified | Golden Glow |
| partytitan | Block Party Titan | 6/7 | Priority 1 | Everybody Outside |
| energydrink | Energy Drink | 1/0 | Keep; no urgent rework identified | Second Wind |
| charger | Phone Charger | 1/0 | Keep; no urgent rework identified | Refund |
| firstaid | First Aid Kit | 2/0 | Priority 1 | Patch Up |
| boombox | Boombox | 2/0 | Keep; no urgent rework identified | Turn It Up |
| subwaymap | Subway Map | 0/0 | Keep; no urgent rework identified | Alternate Route |
| workboots | Buttahs | 1/0 | Keep; no urgent rework identified | Stand Firm |
| homelessyn | Homeless YN | 2/2 | Keep; no urgent rework identified | Still Standing |
| sportsprodigy | Sports Prodigy | 3/3 | Keep; no urgent rework identified | Next Up |
| fein | Fein | 1/1 | Keep; no urgent rework identified | One More |
| alchy | Alchy | 2/3 | Keep; no urgent rework identified | Last Round |
| stud | STUD | 3/3 | Priority 1 | Hold You Down |
| gothkid | Goth Kid | 2/3 | Keep; no urgent rework identified | Dead Air |
| stonerjr | Stoner Jr. | 1/2 | Keep; no urgent rework identified | Chill Out |
| stonersr | Stoner Sr. | 3/2 | Priority 1 | OG Session |
| divorceddad | Divorced Dad | 3/3 | Priority 2 | My Weekend |
| bblnice | BBL Nice | 3/2 | Priority 2 | Good Company |
| bbldemon | BBL Demon | 4/4 | Priority 2 | Problem Energy |
| break | Break | 2/2 | Priority 2 | Floor Sweep |
| krump | Krump | 3/3 | Keep; no urgent rework identified | Chest Pop |
| bboy | Bboy | 2/2 | Priority 2 | Windmill |
| yunghustle | Yung Hustle | 1/1 | Keep; no urgent rework identified | Side Hustle |
| failedrapper | Failed Rapper | 2/1 | Priority 2 | One More Verse |
| failedathlete | Failed Athlete | 3/2 | Priority 1 | Comeback Season |
| incel | Incel | 2/3 | Bond redesign; no blanket buff | Dark Bond |
| redpill | Red Pill | 3/3 | Keep; no urgent rework identified | Echo Chamber |
| simmy | Simmy | 4/4 | Keep; no urgent rework identified | Heartbreak |
| foodz | Foodz | 3/2 | Keep; no urgent rework identified | What's Crackin'! |
| dragonflyjones | Dragonfly Jones | 2/3 | Keep; no urgent rework identified | Secret Technique |
| shonuff | Sho'Nuff | 3/4 | Keep; no urgent rework identified | Who's the Master? |
| yasuke | Yasuke | 2/4 | Keep; no urgent rework identified | Black Blade |
| mansamusa | Mansa Musa | 4/4 | Keep; no urgent rework identified | Gold Road |
| tron | TRON | 3/3 | Keep; no urgent rework identified | For the Hood |
| johnhenry | John Henry | 5/6 | Keep; no urgent rework identified | Steel Driver |
| ashlee | Ashlee | 5/3 | Keep; no urgent rework identified | Jet Set |
| captainjigga | Captain Jigga | 5/4 | Keep; no urgent rework identified | Cabin Gang |
| counter | Counter | 4/2 | Keep; no urgent rework identified | Mirror |
| homelessguy | Homeless Guy | 3/4 | Keep; no urgent rework identified | Nothing to Lose |
| fangirl | Fangirl | 1/1 | Keep; no urgent rework identified | Day One |
| grownfanboy | Grown-Man Fanboy | 3/4 | Keep; no urgent rework identified | He Doesn’t Know You |
| lawlessyn | Lawless YN | 2/2 | Keep; no urgent rework identified | Wrong Block |
| streetapostle | The Street Apostle | 3/3 | Keep; no urgent rework identified | Spread the Word |
| asphaltapostle | The Asphalt Apostle | 3/4 | Keep; no urgent rework identified | Concrete Congregation |
| colognecriminal | Cologne Criminal | 3/3 | Keep; no urgent rework identified | You Can Still Smell Him |
| passportbro | Passport Bro | 3/3 | Keep; no urgent rework identified | Geographic Arbitrage |
| seafoodassassin | Seafood Assassin | 4/3 | Keep; no urgent rework identified | Extra Sauce |
| homelesslegend | Homeless Legend | 4/5 | Keep; no urgent rework identified | Built Different |
| godofhookah | God of Hookah | 4/4 | Keep; no urgent rework identified | Pass the Hose |
| mailman | The Mailman | 3/3 | Keep; no urgent rework identified | Express Delivery |
| hair-stylist | Hair Stylist | 2/2 | Keep; no urgent rework identified | Blowout |
| stylist | Stylist | 3/3 | Keep; no urgent rework identified | Fresh Fit |
| demario | Demario | 2/2 | Keep; no urgent rework identified | Mushroom Delivery |
| luigion | Luigion | 2/2 | Keep; no urgent rework identified | Power-Up |
| black-cowboy | Black Cowboy | 3/3 | Priority 2 | Lasso |
| inmate-crafty | Inmate Crafty | 2/3 | Keep; no urgent rework identified | Make Do |
| inmate-boyfriend | Inmate Boyfriend | 3/3 | Keep; no urgent rework identified | Looking Out |
| inmate-informant | Inmate Informant | 3/3 | Keep; no urgent rework identified | Quiet Tip |
| inmate-contraband | Inmate Contraband | 2/2 | Keep; no urgent rework identified | Hidden Stash |
| lebron-james | Regular guy named LeBron James | 4/4 | Priority 2 | Regular Guy |
| dorothy | Dorothy | 2/3 | Keep; no urgent rework identified | No Place Like Home |
| scarecrow | Scarecrow | 2/3 | Keep; no urgent rework identified | Wrong Turn, Right Place |
| tinman | Tin Man | 2/3 | Keep; no urgent rework identified | Heart Starter |
| lion | Lion | 3/4 | Keep; no urgent rework identified | Found My Courage |
| oz | Oz | 4/5 | Keep; no urgent rework identified | The Grand Reveal |
| alice | Alice | 2/3 | Keep; no urgent rework identified | Drink Me / Eat Me |
| cheshire | Cheshire | 3/4 | Keep; no urgent rework identified | The Smile Stays |
| queenofhearts | Queen of Hearts | 4/4 | Keep; no urgent rework identified | Off With Their Heads |
| sherlock | Sherlock | 3/4 | Keep; no urgent rework identified | Stakeout |
| watson | Watson | 2/3 | Keep; no urgent rework identified | Still Breathing |
| undercova | Undercova Brotha | 2/2 | Keep; no urgent rework identified | Inside Man |
| thefeds | The Feds | 4/4 | Keep; no urgent rework identified | Asset Seizure |
| dmvworker | DMV Worker | 2/2 | Priority 1 | Take a Number |
| ptang | P. Tang | 3/4 | Keep; no urgent rework identified | Belt Check |
| bonnetgirl | Bonnet Girl | 1/1 | Keep; no urgent rework identified | Now I’m Up |
| corruptpastor | Corrupt Pastor | 3/3 | Keep; no urgent rework identified | Collection Plate |
| powerhouse | Powerhouse | 4/3 | Keep; no urgent rework identified | Overtime |
| ronald | Revolutionary Ronald | 3/4 | Keep; no urgent rework identified | WE OUTSIDE. |
| trapvamp | Trap Vamp | 3/3 | Keep; no urgent rework identified | Paid in Blood |
| squabblecook | Squabble House Worker — Male | 2/2 | Keep; no urgent rework identified | Hands on the Clock |
| squabbleserver | Squabble House Worker — Female | 1/1 | Keep; no urgent rework identified | Fresh Pot |
| sugarfoot | Sugarfoot | 2/2 | Keep; no urgent rework identified | Sweet Weakness |
| yn-gokarter | YN Gokarter | 2/2 | Priority 2 | Victory Lap |
| yn-atv-lord | YN ATV Lord | 4/4 | Priority 1 | Trail Guide |
| janitor | Janitor | 3/2 | Keep; no urgent rework identified | Turn It Around |
| homeless-wiseman | Homeless Wiseman | 4/4 | Keep; no urgent rework identified | Told You. |
| juneteenth-chair-guy | Juneteenth Chair Guy | 5/5 | Priority 2 | Fold-Out Justice |
| squabble-house-manager | Squabble House Manager | 1/2 | Keep; no urgent rework identified | Home Advantage |
| riptidebruiser | Gator Boy | 1/2 | Keep; no urgent rework identified | Emotional Support Gator |
| stillwatermedic | Hot Tub Hottie | 2/3 | Keep; no urgent rework identified | Soak Your Problems |
| monsoonanchor | Gas Station Sushi Chef | 3/3 | Keep; no urgent rework identified | Trust the Cooler |
| rainmaker | Energy Drink Freak | 4/4 | Keep; no urgent rework identified | Fourth Can, No Plan |
| batteryback | Game Developer | 1/2 | Keep; no urgent rework identified | Works on My Machine |
| circuitcaptain | Electrician Foreman | 4/4 | Bond redesign; no blanket buff | Everybody on the Clock |
| wiretap | E.V. Enthusiast | 2/2 | Keep; no urgent rework identified | Actually, It Charges Free |
| livewire | Dominican Phone Salesman | 3/2 | Keep; no urgent rework identified | Switch Carriers |
| sprout | OG Vegan | 1/1 | Keep; no urgent rework identified | I Brought My Own Plate |
| rootnurse | Matcha Freak | 2/2 | Keep; no urgent rework identified | Ceremonial Grade Crashout |
| canopykeeper | Performative Male | 3/3 | Bond redesign; no blanket buff | Feminist Literature, Unopened |
| gardenwall | A Spare Gus | 4/4 | Keep; no urgent rework identified | Personal Space Is Seasonal |
| gust | Big City Pigeon | 1/2 | Keep; no urgent rework identified | Run Your Breadcrumbs |
| crosswind | Baby Crying on an Airplane | 2/2 | Keep; no urgent rework identified | No Quiet Section |
| slipstream | The Flight Plug | 3/3 | Bond redesign; no blanket buff | Cousin at the Gate |
| cloudbreak | Airheaded Model | 4/4 | Keep; no urgent rework identified | Wrong Gate, Great Lighting |
| miami-surgeon | Miami Surgeon | 3/3 | Keep; no urgent rework identified | Clean Work |
| roommate | Roommate | 1/2 | Keep; no urgent rework identified | Your Side of the Fridge |
| ahki | Ahki | 2/2 | Priority 3 | The Usual |
| mr-trick | Mr. Trick | 3/3 | Priority 1 | Bottle Service |
| dr-umah | Dr. Umah | 4/3 | Priority 1 | Build Together |
| atl-scammer | ATL Scammer | 3/2 | Priority 2 | Show the Receipts |
| hater | Hater | 2/2 | Priority 2 | Always Something |
| teacher | Teacher Who Never Believed in Rappers | 3/3 | Keep; no urgent rework identified | Still Rapping? |
| tattoo-artist | Tattoo Artist | 3/2 | Priority 1 | Permanent Ink |
| og-skater | OG Skater | 3/3 | Priority 2 | Still Got It |
| inmate-kingpin | Inmate Kingpin | 5/5 | Priority 3 | Run the Yard |
| live-streamer-male | Live Streamer — Male | 2/2 | Keep; no urgent rework identified | Raid the Chat |
| redneck | Redneck | 2/3 | Keep; no urgent rework identified | Fix It Yourself |
| redneck-evil | Redneck Evil | 5/5 | Priority 2 | Chain Reaction |
| lawyer | Lawyer | 3/2 | Priority 2 | Objection |
| nigerian-father | Nigerian Father | 4/4 | Priority 3 | High Expectations |
| bouncer | Bouncer | 4/5 | Keep; no urgent rework identified | Not on the List |
| rent-a-cop | Rent-a-Cop | 2/2 | Priority 2 | Mall Rules |
| the-shootout | The Shootout | 3/0 | Keep; no urgent rework identified | Crossfire |
| the-block-spin | The Block Spin | 4/0 | Keep; no urgent rework identified | Run It Back Twice |
| the-sideshow | The Sideshow | 3/0 | Keep; no urgent rework identified | Clear the Intersection |
| the-concert | The Concert | 3/0 | Keep; no urgent rework identified | Crowd Control |
| the-setup | The Setup | 2/0 | Keep; no urgent rework identified | Trust Nobody |
| the-dice-game | The Dice Game | 0/0 | Keep; no urgent rework identified | Best Two of Three |
| the-after-party | The After Party | 3/0 | Keep; no urgent rework identified | One More Round |
| the-kickback | The Kickback | 3/0 | Keep; no urgent rework identified | Everybody Pull Up |
| the-cookout | The Cookout | 3/0 | Keep; no urgent rework identified | Hot Plate |
| the-babyshower | The Baby Shower | 2/0 | Keep; no urgent rework identified | New Blessings |
| kyle | KYLE | 4/4 | Keep; no urgent rework identified | Smile Bombs |
| stockz | STOCKZ | 3/3 | Keep; no urgent rework identified | Compound Interest |

## Evidence pointers

- `lib/squabblemon-engine/src/data.ts` and imported wave registries: current costs, bodies, effects, upgrades.
- `lib/squabblemon-engine/src/gameEngine.ts`: actual ATV transport, Hooper/Baby conditions, common-card payoff and movement resolution.
- `lib/squabblemon-engine/src/blockbusterRules.ts`: Mr. Trick additional spending, Dr. Umah buff, ATL Scammer transfer, Tattoo Artist and OG Skater.
- `scripts/results/movement-tempo/README.md`: existing 1,120-match bond/movement experiments and tier sensitivity.
- `scripts/results/homeless-rework/README.md`: Ronald/Wiseman 288-match audit; creative changes do not automatically increase bot scores.

Validation: all 202 registry IDs represented exactly once in the roster table; 41 distinct candidates and 10 separate bond cards resolve to real current cards. No new match simulations were run for these unimplemented proposals.
