# Rarity sweep — current-catalog audit

## Scope and selection principles

This is a snapshot audit of the live engine catalog, not a guessed wave-by-wave roster. The canonical source is `cardCatalog` in `lib/squabblemon-engine/src/data.ts`, after its current card-kit and roster-balance overlays. Catalog engine IDs, rarity assignments, and effective printed Motion/Hands are reported as loaded there. The table includes Common, SuperCommon, Uncommon, Rare, and Legendary in that order; Epic and Mythical are intentionally out of scope.

Rarity is collection metadata, not a gameplay modifier or evidence that a card should be stronger. The review favors reliable, understandable triggers and distinct board roles; conditional cards are assessed against the actual condition and payoff printed today. It does not adjust cards just to make every tier look equally powerful. Strong, serviceable, recently revised, and narrow-but-purposeful designs remain KEEP unless there is a specific current trigger/role concern. No live pick-rate data is available here, and catalog inclusion or prepared-deck presence is not a pick-rate measure.

The status labels record this audit's disposition: **BUFFED** means the requested targeted adjustment is already present in the current catalog/effective text, not a change made by this document; **WATCH** means a specific design concern remains deferred; **KEEP** means retain the current card and its existing changes. Every reason below is a compact description of its live trigger or role, not a performance claim.

## Targeted decisions

- **BUFFED, implemented:** Crosswind, Livewire, Live Streamer, Lawless YN, Squabble House Worker — Male (Squabble Cook), Sports Prodigy, and P. Tang. Their table entries describe the effective current text and stats.
- **KEEP, deliberately not buffed:** Squabble House Manager remains 1 Motion / 2 Hands; its +1-Hand On Reveal still requires an enemy in its district.
- **KEEP, previously approved:** Inmate Kingpin remains at 1 Motion / 3 Hands with its once-per-match, three-distinct-carrier Contraband payoff. This audit adds no further buff.
- **WATCH:** Red Pill's broader fallback trigger is deferred because intercepting broadly risks unsafe global trigger behavior. The current narrower Weaken-then-Silence condition remains.
- **KEEP, already revised:** Chess Regular and Rent-a-Cop retain their existing conditional rewards. No new work is claimed for these cards or other prior revisions.

## Canonical roster

Effective stats are printed Motion / Hands. `id` is the canonical engine ID, exactly as cataloged.

### Common — 43

| Engine ID | Card | Motion/Hands | Verdict — current trigger / role |
|---|---|---:|---|
| `cornball` | Cornball | 1/1 | **KEEP** — On Reveal burns every enemy in its district |
| `plug` | Plug | 1/2 | **KEEP** — cheap cross-district 1-Motion discount for the next card |
| `snow` | Snow Bunny | 3/2 | **KEEP** — freezes the highest enemy here, shutting off its Hands |
| `wifey` | Wifey | 4/4 | **KEEP** — blocks the first targeted enemy effect in her district each round |
| `delivery` | Delivery Demon | 1/1 | **KEEP** — moves a local 1- or 2-cost ally to the weakest other district |
| `youngbull` | Young Bull | 2/2 | **KEEP** — +1 Hand on entry, with local enemy Burn |
| `transplant` | Racially Ambiguous Transplant | 1/1 | **KEEP** — isolated entry gains +1 Hand |
| `tayaty` | Bad Lil Cousin Tayaty | 1/1 | **KEEP** — echoes the last On Reveal ability resolved this round |
| `edgar` | Edgar | 2/2 | **KEEP** — gains +2 Hands beside a friendly character costing 2 or less |
| `nguyen` | Nguyen | 2/2 | **KEEP** — gains +1 Hand when an ally occupies another district |
| `manman` | Man-Man | 3/3 | **KEEP** — gains +3 Hands with two other friendly characters here |
| `pinaynurse` | Pinay Nurse | 2/2 | **KEEP** — local +2 Hands plus Freeze/Silence cleanse for the weakest ally |
| `honestthot` | Honest Thot | 1/2 | **KEEP** — preps a later Air arrival in a nominated weak district |
| `earthy` | Earthy Sugar Foot | 1/1 | **KEEP** — local weakest-ally +1-Hand support |
| `abuela` | Abuela | 4/4 | **KEEP** — heals actual damage and Protects an injured ally; fallback protects and packs lunch |
| `icecream` | Ice Cream Truck | 3/2 | **KEEP** — leaves +2-Hand Treats for allies, including first visits to districts |
| `bodegacat` | Bodega Cat | 1/1 | **KEEP** — gains +1 Hand when no other friendly card is here |
| `crossingguard` | Crossing Guard | 2/2 | **KEEP** — Protects an ally and lets its next move ignore movement Lock |
| `laundry` | Laundromat Regular | 2/2 | **KEEP** — cleanses and buffs an ally; its next successful move repeats the payoff |
| `busker` | Corner Busker | 2/1 | **KEEP** — distinct movement visitors build a capped local Hands payout |
| `nightcashier` | Night Cashier | 2/2 | **KEEP** — round-4+ Receipt enables a local cheap-play discount; final-round customer gets Hands |
| `dogwalker` | Dog Walker | 2/2 | **KEEP** — gains +3 Hands when at least two other friendly characters are here |
| `chessregular` | Chess Regular | 3/3 | **KEEP** — completed Fork pays +1 only when a marked enemy actually loses Hands |
| `gardener` | Rooftop Gardener | 1/1 | **KEEP** — delayed Seed gives +3 Hands to the weakest local Plant ally |
| `energydrink` | Energy Drink | 1/0 | **KEEP** — restores 3 Motion, capped at 9 |
| `charger` | Phone Charger | 1/0 | **KEEP** — restores Motion per local ally, with a three-character Electric Protect threshold |
| `subwaymap` | Subway Map | 0/0 | **KEEP** — relocates the weakest local ally and grants +1 Hand if moved |
| `workboots` | Buttahs | 1/0 | **KEEP** — gives a local ally +2 Hands and protection from one targeted hostile ability |
| `homelessyn` | Homeless YN | 2/2 | **KEEP** — gains +3 Hands when enemies outnumber other friendly cards here |
| `fein` | Fein | 1/1 | **KEEP** — enemy presence gives +1 Hand; a crowd also triggers Burn |
| `alchy` | Alchy | 2/3 | **KEEP** — round-4+ ongoing growth, larger while losing |
| `stonerjr` | Stoner Jr. | 1/2 | **KEEP** — cleanses a local Freeze/Silence and gains a Hand when it cleanses |
| `yunghustle` | Yung Hustle | 1/1 | **KEEP** — restores Motion when a friendly character is elsewhere |
| `failedrapper` | Failed Rapper | 2/1 | **KEEP** — a Verse grants +2 Hands to the next different friendly entrant |
| `incel` | Incel | 2/3 | **KEEP** — solo-lane round-end growth, capped twice per match |
| `bonnetgirl` | Bonnet Girl | 1/1 | **KEEP** — once-per-match +2 Hands when an enemy damages another local ally |
| `squabbleserver` | Squabble House Worker — Female | 1/2 | **KEEP** — local cleanse for Burn and Freeze |
| `riptidebruiser` | Gator Boy | 1/2 | **KEEP** — weakens the highest-Hands enemy and gains a Hand if it lands |
| `batteryback` | Game Developer | 1/2 | **KEEP** — repairs a negatively modified ally elsewhere and restores Motion |
| `sprout` | OG Vegan | 1/1 | **KEEP** — local Plant support also gives itself a Hand when a Plant ally is present |
| `gust` | Big City Pigeon | 1/2 | **KEEP** — moves to the weakest other district and weakens its weakest enemy |
| `roommate` | Roommate | 1/2 | **KEEP** — gains +1 Hand when another ally is here |
| `hater` | Hater | 2/2 | **KEEP** — once-per-round removal of new enemy bonus Hands can grow Hater |

### SuperCommon — 9

| Engine ID | Card | Motion/Hands | Verdict — current trigger / role |
|---|---|---:|---|
| `shiesty` | Shiesty YN | 1/1 | **KEEP** — 50% repeat-summon chance, capped at eight extra copies |
| `torta` | Torta | 2/2 | **KEEP** — pairs with an Earth ally for conditional next-round shared growth |
| `waterboy` | Water Boy | 1/1 | **KEEP** — an ally here refunds +1 Motion |
| `buspass` | Bus Pass | 0/0 | **KEEP** — next card costs 1 less Motion |
| `cognac` | Cognac Bottle | 1/0 | **KEEP** — gives a local ally +2 Hands, or +3 if Fire |
| `bustdown` | Bust-Down Watch | 1/0 | **KEEP** — Protects an ally; its own ward blocking an ability pays +2 Hands once |
| `soulfood` | Soul Food | 1/0 | **KEEP** — local +1 Hand with Freeze/Silence cleanse |
| `concrete` | Concrete | 1/1 | **KEEP** — anchors an Earth ally against forced movement for a Hands payoff |
| `fangirl` | Fangirl | 1/1 | **KEEP** — once-per-round idol Hands gain also grows Fangirl |

### Uncommon — 28

| Engine ID | Card | Motion/Hands | Verdict — current trigger / role |
|---|---|---:|---|
| `rastamon` | Rastamon | 2/2 | **KEEP** — cleanses an afflicted ally for +2 Hands; otherwise buffs the weakest local ally |
| `bikelife` | Bikelife YN | 2/2 | **KEEP** — relocates after reveal and gains +1 Hand |
| `baby` | Baby Momma | 4/5 | **KEEP** — names family, follows one successful move, and retaliates when family is hit |
| `barber` | Barber Bro | 4/4 | **KEEP** — transfers actually trimmed enemy bonus Hands to an ally |
| `carmeet` | Car Meet Kid | 2/2 | **KEEP** — relocates, then buffs the weakest other local ally |
| `nail` | Nail Tech | 2/3 | **KEEP** — +2 Hands and partial protection from the target's next enemy Hands reduction |
| `cornercoach` | Corner Coach | 3/3 | **KEEP** — eligible ally retries a failed entrance after later friendly placements |
| `mural` | Mural Apprentice | 2/2 | **KEEP** — elemental district paint rewards the next different-element ally |
| `firstaid` | First Aid Kit | 2/0 | **KEEP** — cleanse plus a one-use kit that prevents up to 2 enemy damage |
| `boombox` | Boombox | 2/0 | **KEEP** — local +1 Hand to all friendlies and +1 to the next movement arrival |
| `gothkid` | Goth Kid | 2/3 | **KEEP** — Silences the weakest enemy with printed cost 2 or less |
| `divorceddad` | Divorced Dad | 3/3 | **KEEP** — borrows a movable cheap ally with Protection and a conditional return-move reward |
| `bblnice` | BBL Nice | 3/2 | **KEEP** — paired allies share the first positive Hands gain each round |
| `break` | Break | 2/2 | **KEEP** — moves an ally and leaves a mark that Weakens the next enemy entrant |
| `bboy` | Bboy | 2/2 | **KEEP** — sequential movement grants +1 Hand for each successful move |
| `hair-stylist` | Hair Stylist | 2/2 | **KEEP** — cleanse and +1 Hand, with another Hand on the ally's next successful move |
| `inmate-crafty` | Inmate Crafty | 2/3 | **KEEP** — gains +2 Hands beside an Inmate or support |
| `inmate-contraband` | Inmate Contraband | 2/2 | **KEEP** — restores 1 Motion when another friendly character is here |
| `sugarfoot` | Sugarfoot | 2/2 | **KEEP** — Weakens the strongest enemy; an already-Weakened target pays +1 Hand |
| `janitor` | Janitor | 3/2 | **KEEP** — once-per-district hostile reduction/status reversal becomes +2 Hands |
| `stillwatermedic` | Hot Tub Hottie | 2/3 | **KEEP** — cleanse plus a Hand for a frozen or silenced local ally |
| `livewire` | Dominican Phone Salesman | 3/3 | **BUFFED** — successful move grants +1 Hand and opens an off-district discount; discounted character gets +1 |
| `rootnurse` | Matcha Freak | 2/2 | **KEEP** — remaining Motion threshold gives +2 Hands; otherwise offers local cleanse/support |
| `crosswind` | Baby Crying on an Airplane | 2/2 | **BUFFED** — Weakens strongest local enemy; successful ally relocation adds +1 Hand to that ally |
| `ahki` | Ahki | 2/2 | **KEEP** — remembers an ally; first departure and return pay Hands, return also Protects |
| `redneck` | Redneck | 2/3 | **KEEP** — cleanses the weakest other local ally |
| `rent-a-cop` | Rent-a-Cop | 2/2 | **KEEP** — warning that actually deals damage grants +1 Hand if still active; one warning |
| `the-babyshower` | The Baby Shower | 2/0 | **KEEP** — gives local allies +1 Hand and draws if a card remains |

### Rare — 49

| Engine ID | Card | Motion/Hands | Verdict — current trigger / role |
|---|---|---:|---|
| `bossbabe` | Boss Bae | 3/3 | **KEEP** — first two off-district plays grant Hands; second unlocks a 4+ cost discount |
| `scammer` | Scammer | 3/3 | **KEEP** — copies an active Ongoing enemy's base Hands and printed ability; fallback copies base Hands |
| `roaster` | All Jokes Roaster | 3/3 | **KEEP** — Burns and reduces Hands of an enemy that played here |
| `nerd` | Closet Nerd | 4/3 | **KEEP** — Silences the priority enemy; newly interrupting active Ongoing pays Hands and information |
| `streamer` | Live Streamer | 2/2 | **BUFFED** — resets the cheap-play counter; next two plays costing 2 or less each gain +1 Hand |
| `vibe` | Cool Vibe YN | 2/2 | **KEEP** — pulls the lowest ally from another district; both gain a Hand |
| `hooper` | Hooper | 5/5 | **KEEP** — challenge rewards an enemy departure or a delayed hit if it stays |
| `bottle` | Bottle Girl | 2/3 | **KEEP** — round-4+ Hands and a next-Poison Motion discount |
| `dancecaptain` | Dance Circle Captain | 3/3 | **KEEP** — next different friendly mover gains +2 Hands and Protection once per round |
| `subwaymagician` | Subway Magician | 3/3 | **KEEP** — Weakens the highest-Hands enemy, then relocates |
| `ogdominican` | OG Dominican | 3/4 | **KEEP** — gains +2 Hands on a successful move |
| `stud` | STUD | 3/3 | **KEEP** — intercepts a targeted hostile ability for a bonded ally, then attempts a paired escape |
| `stonersr` | Stoner Sr. | 3/2 | **KEEP** — cleanse seeds +2 Hands for an arrival and a smaller second pass |
| `krump` | Krump | 3/3 | **KEEP** — enemy presence creates a local +1/-1 Hands exchange |
| `failedathlete` | Failed Athlete | 3/3 | **KEEP** — once-per-match losing transition grants +4 Hands and Protection |
| `lawlessyn` | Lawless YN | 2/2 | **BUFFED** — moves the weakest enemy to its strongest open district; successful displacement grants Lawless YN +1 Hand |
| `stylist` | Stylist | 2/2 | **KEEP** — gives an ally +1 Hand and Protection, refreshed by its next successful move |
| `demario` | Demario | 2/2 | **KEEP** — summons a Mushroom below the lane cap for a later friendly-play payoff |
| `luigion` | Luigion | 2/2 | **KEEP** — distributes Hands locally; Mushroom consumption changes its transformation payoff |
| `inmate-boyfriend` | Inmate Boyfriend | 3/3 | **KEEP** — +2 Hands locally and to a Cellblock ally elsewhere |
| `inmate-informant` | Inmate Informant | 3/3 | **KEEP** — reduces the strongest enemy's Hands by 2, subject to protection/immunity |
| `scarecrow` | Scarecrow | 2/3 | **KEEP** — swaps with an ally in another open district; both gain Hands on successful moves |
| `tinman` | Tin Man | 2/3 | **KEEP** — first different friendly arrival each round gains +1 Hand and Protection |
| `alice` | Alice | 2/3 | **KEEP** — once returns to hand outside the final round; next deployment gets Hands and discount |
| `watson` | Watson | 2/3 | **KEEP** — heals actual local damage or protects locally, and protects Sherlock anywhere |
| `undercova` | Undercova Brotha | 2/2 | **KEEP** — first enemy deployment here triggers a once-per-match Hands theft and escape |
| `dmvworker` | DMV Worker | 2/2 | **KEEP** — ticket delays one qualifying entrance and grants DMV Worker +1 Hand |
| `squabblecook` | Squabble House Worker — Male | 2/3 | **BUFFED** — once per round, enemy ability damage to another local ally triggers 2 damage back |
| `yn-gokarter` | YN Gokarter | 2/2 | **KEEP** — visits all three districts to unlock once-per-match +3 Hands |
| `squabble-house-manager` | Squabble House Manager | 1/2 | **KEEP** — enemy-present On Reveal grants +1 Hand; intentionally kept at 1/2 |
| `monsoonanchor` | Gas Station Sushi Chef | 3/3 | **KEEP** — hand-held Water bond grows allies; entry Weakens the strongest local enemy |
| `wiretap` | E.V. Enthusiast | 2/2 | **KEEP** — off-district discount; empty local lane also refunds Motion |
| `canopykeeper` | Performative Male | 3/3 | **KEEP** — promised ally support pays when another card helps it through next round |
| `slipstream` | The Flight Plug | 3/3 | **KEEP** — Air ally's next successful move grants Hands and Protection |
| `miami-surgeon` | Miami Surgeon | 3/3 | **KEEP** — cleanses and gives +2 Hands to a local ally |
| `mr-trick` | Mr. Trick | 3/3 | **KEEP** — next local friendly play earns a Tip on a successful hit/status |
| `atl-scammer` | ATL Scammer | 2/2 | **KEEP** — diverts a refund or supplies a delayed local discount fallback |
| `teacher` | Teacher Who Never Believed in Rappers | 3/3 | **KEEP** — Silences an active Ongoing enemy, otherwise the strongest enemy |
| `tattoo-artist` | Tattoo Artist | 3/3 | **KEEP** — tattoos an ally for Hands now and Hands plus Protection on its next move |
| `og-skater` | OG Skater | 3/3 | **KEEP** — movement route lets a later local play follow to the destination |
| `live-streamer-male` | Live Streamer — Male | 2/2 | **KEEP** — gains Hands from up to two cheap friendly characters here |
| `lawyer` | Lawyer | 3/3 | **KEEP** — cleanses and appeals an ally; dismissed status creates a local discount |
| `bouncer` | Bouncer | 4/5 | **KEEP** — displaces the strongest active Ongoing enemy, otherwise strongest enemy |
| `the-shootout` | The Shootout | 3/0 | **KEEP** — area enemy damage also hits own strongest local character |
| `the-sideshow` | The Sideshow | 3/0 | **KEEP** — clears both sides from the lane; locked characters stay |
| `the-concert` | The Concert | 2/0 | **KEEP** — chooses a shared +1 or -1 Hands effect on the lane |
| `the-dice-game` | The Dice Game | 0/0 | **KEEP** — affordable Motion wager decided by each side's highest two of three D6 |
| `the-kickback` | The Kickback | 3/0 | **KEEP** — gathers movable characters from all lanes into this lane |
| `stockz` | STOCKZ | 3/3 | **KEEP** — ongoing +1 Hand after each other friendly character play |

### Legendary — 24

| Engine ID | Card | Motion/Hands | Verdict — current trigger / role |
|---|---|---:|---|
| `buddy` | BUDDY | 3/4 | **KEEP** — district discounts, delayed self-growth, and Buds reward eligible occupants |
| `folks` | FOLKS | 4/3 | **KEEP** — board-wide Burn plus a Hand for each other friendly Fire character |
| `drfade` | Dr. Fade | 4/6 | **KEEP** — local enemy reduction paired with a weakest-ally buff elsewhere |
| `techbro` | Techbro Rich | 4/5 | **KEEP** — once borrows Motion, with unspent amount repaid and remainder carried as a penalty |
| `oink` | Officer Oink | 5/6 | **KEEP** — Weakens every local enemy and gains per enemy Weakened |
| `sneaker` | Sneaker Reseller | 3/3 | **KEEP** — scales from the highest-Hands enemy's printed Power and Weakens it |
| `landlord` | Landlord | 2/3 | **KEEP** — taxes first enemy entry each round; paid tax grows Landlord |
| `bigzoey` | Big Zoey | 3/3 | **KEEP** — simultaneous local weakest-ally buff and weakest-enemy reduction |
| `sportsprodigy` | Sports Prodigy | 3/3 | **BUFFED** — losing lane gives +2 Hands/-1 enemy Hand; otherwise arms a one-time comeback |
| `bbldemon` | BBL Demon | 4/4 | **KEEP** — marked enemy placement either loses Hands or grants BBL Demon Hands elsewhere |
| `redpill` | Red Pill | 3/3 | **WATCH** — Weaken then Silence/+2 Hands remains; broader fallback deferred due risky global interception |
| `dragonflyjones` | Dragonfly Jones | 2/3 | **KEEP** — high-cost enemy condition adds enemy reduction to its base +1 Hand |
| `shonuff` | Sho'Nuff | 3/4 | **KEEP** — steals up to 2 bonus Hands, with a fallback enemy reduction |
| `mansamusa` | Mansa Musa | 4/4 | **KEEP** — buffs weakest allies across lanes, with an Earth bonus and off-district discount |
| `tron` | TRON | 3/3 | **KEEP** — distributes Hands to up to three weak allies; enough recipients refund Motion |
| `seafoodassassin` | Seafood Assassin | 4/3 | **KEEP** — applies then detonates Burn across the enemy lane |
| `homelesslegend` | Homeless Legend | 4/5 | **KEEP** — survives its first lethal Hands reduction and recovers damage at round end |
| `queenofhearts` | Queen of Hearts | 4/4 | **KEEP** — executes weakest enemy at 4 or fewer Hands; successful execution summons a guard |
| `thefeds` | The Feds | 4/4 | **KEEP** — strips removable bonus Hands and Locks; falls back to Locking the strongest enemy |
| `ptang` | P. Tang | 3/4 | **BUFFED** — 2-damage hit then knockback; landed hit blocked from movement pays +1 Hand if survivor remains |
| `trapvamp` | Trap Vamp | 3/3 | **KEEP** — once-per-round Hands gain tracks its own ability damage, capped at 2 |
| `homeless-wiseman` | Homeless Wiseman | 4/4 | **KEEP** — public-board prediction either Weakens the enemy's play or discounts a future ally |
| `inmate-kingpin` | Inmate Kingpin | 1/3 | **KEEP** — approved 1/3; one-time three-distinct-carrier Contraband growth remains |
| `kyle` | KYLE | 4/4 | **KEEP** — delayed random Smile Bomb hits weaken enemies and grow KYLE |

## Verification, testing, and limits

- The roster above is derived from the live exported `cardCatalog`, not card-wave source rarity tables or prior candidate/audit documents. Catalog rarity overrides and effective card overlays are therefore reflected in each row.
- Count check: Common **43**, SuperCommon **9**, Uncommon **28**, Rare **49**, Legendary **24** — **153 rows** total. Epic **29** and Mythical **20** are excluded, not silently folded into a listed tier.
- The catalog was enumerated by engine ID and grouped by assigned rarity; each listed engine ID appears once. Stats use the catalog's effective `cost` and `power` (displayed as Hands).
- This is a data/text audit, not a gameplay test. No matchup scores, balance simulation results, online play rates, or live player pick rates are claimed. The current triggers and effective text were checked, but empirical strength still requires separately designed, documented tests and live telemetry.
- The inventory is the record of this sweep; the seven **BUFFED** rows also have engine changes and focused tests. The unrelated generated mockup file was not changed for this work.