# Current tested deck tiers and named rosters

- Rules **63**, card balance **63**; base Git commit `61e9a86c1bd1ba49e350bd4a488671ab37d26ad2`; source SHA-256 `f3c57f54175c45cdb8493ea1d7b7178f801ba8664612e87c5c3a4d867f4c7193`.
- The source manifest in each plan.json binds the audited working source, including local uncommitted changes. The base Git commit alone cannot reproduce this run.
- **46 fixed league recipes; 17,296 league matches; 752 seat appearances per deck.** Mirror games contribute two deck appearances.
- Additional evidence: 2,816 stress/probe matches; 256 confirmation matches; 32 supplemental coverage-completion matches. 20,400 successful scheduled matches overall; zero failed cases.
- League recipes represent 219/301 collectible cards. Across all 4 schedules, 301 cards were observed played; 0 were not.
- Score = (wins + half draws) / appearances. Tier bands: S ≥60%, A ≥55%, B ≥50%, C ≥45%, D <45%. These descriptive bands are not confidence intervals.
- Policy model: `online-base-paid-both-plies-v2`.
- These are source-pinned automated **base-card PvP** samples, not live player win rates, an optimized/custom-deck search, PvE results or validation of upgraded cards. Confirmation, stress and supplemental coverage samples are not pooled into league ranks.
- Policies: chain-two, greedy. League: 184 distinct seed labels, rotations 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, both seat assignments. Seed labels need not produce independent district layouts.
- Live solo CPU uses chooseCpuPlay/revealCpuTurn with encounter behavior weights and a different search. These online-seat policy samples do not measure Story/training CPU performance.
- Known policy limits: live CPU retains a cheap-card Gamer setup heuristic and different paid/Squabble choices; ranked bots add a separate Squabble decision. This audit evaluator stops valuing spare resources after round five even when matches can extend. None of these samples establishes live-bot parity.
- No gameplay change or deployment is implied. Full input/output checksums and runtime resolution are in [provenance.json](provenance.json); deployment coverage is in [coverage.json](coverage.json).

| Rank | Band | Deck | Score | Wins / losses / draws | All ten cards, in tested order |
|---:|:---:|---|---:|---|---|
| 1 | S | Light | 80.78% | 590 / 127 / 35 | Abuela; Church Auntie; Night Shift Medic; Foodz; Dr. Fade; Pinay Nurse; Crossing Guard; Leroy; Yasuke; Homeless Wiseman |
| 2 | S | TOUR MONEY | 72.01% | 517 / 186 / 49 | Studio Couch YN; The Opening Act; Mixtape Cousin; The Rapper; The Hype Man; Tour Van Driver; Merch Table Hustler; The Manager — Nice; The DJ; One-Man Band |
| 3 | S | EVERYBODY EATS | 70.21% | 502 / 198 / 52 | Homeless Guy; Homeless YN; Homeless Legend; Cracked Head; Community Cook; Foodz; Night Bus Driver; Delivery App Cyclist; Bluetooth Unc; Booster |
| 4 | S | The Wiz | 69.61% | 490 / 195 / 67 | Dorothy; Scarecrow; Tin Man; Oz; Lion; Passport Bro; Break; Bboy; Wicked Witch; Flying Monkeys |
| 5 | S | Dark | 68.28% | 480 / 205 / 67 | Shotta; Gamer; Goth Kid; Closet Nerd; Red Pill; Sho'Nuff; Queen of Hearts; Repo Man; The Feds; Chess Regular |
| 6 | S | Plant | 66.95% | 472 / 217 / 63 | Performative Male; Ashlee; Rooftop Gardener; OG Vegan; Matcha Freak; A Spare Gus; The Street Apostle; Homeless Legend; Rastamon; Lola |
| 7 | S | Air | 66.62% | 476 / 226 / 50 | The Flight Plug; Promoter; Captain Jigga; Honest Thot; Big City Pigeon; Baby Crying on an Airplane; Airheaded Model; P. Tang; OG Dominican; Cheshire |
| 8 | S | Wave 7 Legends | 65.03% | 459 / 233 / 60 | Ashlee; Captain Jigga; Shotta; Bad Lil Cousin Tayaty; Young Bull; Honest Thot; Bus Pass; Soul Food; Cognac Bottle; Bust-Down Watch |
| 9 | S | Wonderland Return | 64.30% | 452 / 237 / 63 | Alice; Cheshire; Queen of Hearts; Mr Rabbit; Dorothy; Laundromat Regular; Water Boy; GUAP; Alchy; Mad Hatter |
| 10 | S | Fire | 61.90% | 425 / 246 / 81 | GUAP; FOLKS; Hooper; BBL Demon; Corner Coach; Krump; OG Uncle; Baby Momma; Young Bull; KYLE |
| 11 | S | Fire and GUAP | 61.64% | 426 / 251 / 75 | GUAP; FOLKS; Hooper; BBL Demon; Corner Coach; Cognac Bottle; Krump; Dance Circle Captain; OG Uncle; Baby Momma |
| 12 | S | NO EQUIPMENT NEEDED | 60.77% | 424 / 262 / 66 | Track Suit Auntie; Gym Bag YN; Stairwell Sprinter; Gym Spotter YN; Calisthenics YN; Jump Rope Menace; Personal Trainer; Fitness Girl; Last Set OG; OG Calisthenics |
| 13 | S | Earth | 60.37% | 423 / 267 / 62 | Torta; Balikbayan Box Bot; Mansa Musa; John Henry; The Asphalt Apostle; Landlord; Big Zoey; STUD; Bouncer; Lion |
| 14 | A | FIX YOU A PLATE | 59.77% | 408 / 261 / 83 | The Favorite Grandchild; Cousin Back From College; Plate Auntie; Church Auntie’s Rival; Big Sister; Second Plate Cousin; Grill Uncle; Grandma Said Sit Down; Group Chat Instigator; Black Air Fade 1’s |
| 15 | A | Air Bond | 58.11% | 396 / 274 / 82 | Honest Thot; Ashlee; Captain Jigga; All Jokes Roaster; Bikelife YN; Cool Vibe YN; Bus Pass; Soul Food; Cognac Bottle; Bust-Down Watch |
| 16 | A | ONE MORE REP | 57.65% | 384 / 269 / 99 | Failed Athlete; Fitness Girl; Fitness Bro; Personal Trainer; Lash Tech; Apartment Maintenance Sage; YN ATV Lord; Hooper; Sports Prodigy; Demon Trainer |
| 17 | A | SQUABBLEHOUSE SHIFT | 57.05% | 394 / 288 / 70 | SquabbleHouse Manager; SquabbleHouse Bus Boy; SquabbleHouse Cashier; SquabbleHouse Security; SquabbleHouse Teknician; SquabbleHouse Griddle Master; SquabbleHouse Inmate Reformed; SquabbleHouse Janitor; SquabbleHouse Waffle Warlord; SquabbleHouse A Side of Hands |
| 18 | A | Street Legends — Growth and Routes | 56.05% | 388 / 297 / 67 | Mr. Mc Hands; OG Uncle Harley Davidson; Pimp Swookie; Gas Station Window Wiper; The Bail Bonds Auntie; Ms. Mary Mack; Landlord; Bottle Girl; Nail Tech; Man-Man |
| 19 | A | Cellblock Pressure | 55.98% | 379 / 289 / 84 | Inmate Crafty; Inmate Boyfriend; Inmate Informant; Inmate Contraband; Regular guy named LeBron James; Bust-Down Watch; Cognac Bottle; Tin Man; Shotta; All Jokes Roaster |
| 20 | A | Earth Tax and Finishers | 55.92% | 380 / 291 / 81 | Landlord; Big Zoey; STUD; Torta; Balikbayan Box Bot; Mansa Musa; John Henry; Block Party Titan; The Asphalt Apostle; Failed Athlete |
| 21 | B | Mushroom Garden | 54.92% | 377 / 303 / 72 | Demario; Luigion; Rooftop Gardener; OG Vegan; Matcha Freak; Performative Male; A Spare Gus; Hair Stylist; Stylist; Black Cowboy |
| 22 | B | Electric | 53.39% | 368 / 317 / 67 | Electrician Foreman; Pirate Radio DJ; TRON; Plug; E.V. Enthusiast; Game Developer; Dominican Phone Salesman; Tin Man; Techbro Rich; Boss Bae |
| 23 | B | WHO GOT THE AUX | 50.80% | 344 / 332 / 76 | The Opening Act; The DJ; The Hype Man; The Manager — Nice; The Rapper; The Janky Promoter; The Local Celebrity; The Battle Rapper; The Manager — Evil; The OG Rap Legend |
| 24 | B | Water | 50.60% | 337 / 328 / 87 | Gas Station Sushi Chef; Last Train Conductor; Cool Vibe YN; Water Boy; Laundromat Regular; Alchy; Ice Cream Truck; Hot Tub Hottie; Gator Boy; Watson |
| 25 | C | CRASHOUT SEASON | 46.08% | 308 / 367 / 77 | Cornball; Rastamon; Snow Bunny; Wifey; Baby Momma; Hooper; All Jokes Roaster; Bus Pass; Soul Food; Cognac Bottle |
| 26 | D | Poison | 43.75% | 277 / 371 / 104 | Bottle Girl; Nail Tech; Mural Apprentice; Fein; Simmy; Cologne Criminal; Seafood Assassin; God of Hookah; Bus Pass; Soul Food |
| 26 | D | RECEIPTS | 43.75% | 284 / 378 / 90 | Cornball; All Jokes Roaster; Closet Nerd; Snow Bunny; Plug; Baby Momma; Hooper; Bus Pass; Soul Food; Cognac Bottle |
| 28 | D | Cellblock — No Kingpin | 42.35% | 270 / 385 / 97 | Inmate Crafty; Inmate Boyfriend; Inmate Informant; Inmate Contraband; Regular guy named LeBron James; Bust-Down Watch; Cognac Bottle; Rastamon; Wifey; STUD |
| 29 | D | Street Legends — Relationship Pressure | 42.02% | 275 / 395 / 82 | The Work Hubby; The Guy She Told You Not to Worry About; Crazy Ex-Boyfriend; Side Chick; Suga Mama; Wifey; Baby Momma; Ms. Mary Mack; BBL Nice; Barber Bro |
| 30 | D | WHO YOU KNOW | 41.82% | 276 / 399 / 77 | Cornball; Plug; Live Streamer; Gamer; Techbro Rich; Boss Bae; Wifey; Bus Pass; STOCKZ; Sneaker Reseller |
| 31 | D | THE BLOCK IS HOT | 41.76% | 272 / 396 / 84 | Cornball; Snow Bunny; All Jokes Roaster; Rastamon; Wifey; Officer Oink; Baby Momma; Bus Pass; Soul Food; Cognac Bottle |
| 31 | D | VOLTAGE IN MOTION | 41.76% | 274 / 398 / 80 | Game Developer; Electrician Foreman; E.V. Enthusiast; Dominican Phone Salesman; STOCKZ; Boss Bae; Plug; Live Streamer; Techbro Rich; Bikelife YN |
| 33 | D | GOOD VIBES ONLY | 39.83% | 265 / 418 / 69 | Rastamon; Wifey; Snow Bunny; Cool Vibe YN; Hooper; Officer Oink; Plug; Bus Pass; Soul Food; Cognac Bottle |
| 34 | D | SLIDE THRU | 39.69% | 259 / 414 / 79 | Cornball; Bikelife YN; Cool Vibe YN; Plug; Snow Bunny; Hooper; Baby Momma; Bus Pass; Soul Food; Cognac Bottle |
| 35 | D | Street Legends — Investigations | 38.90% | 255 / 422 / 75 | Sherlock; Watson; Boo Boo the Fool; Parole Officer; Uncle Sam; Apartment Maintenance Sage; The Bail Bonds Auntie; Closet Nerd; Homeless Wiseman; Shotta |
| 36 | D | Counterplay — Dark Control | 38.03% | 246 / 426 / 80 | Shotta; Gamer; Goth Kid; Closet Nerd; Red Pill; BUDDY; Wifey; Pinay Nurse; Plug; Bust-Down Watch |
| 36 | D | Wave 7 Tempo | 38.03% | 245 / 425 / 82 | Bad Lil Cousin Tayaty; Young Bull; Fein; Red Pill; Simmy; Foodz; Bus Pass; Soul Food; Cognac Bottle; Bust-Down Watch |
| 38 | D | Crip / Blue Set | 37.83% | 250 / 433 / 69 | CLUE COOKY; LOOK OUT; OG Blue; Ganger Blue; Blue-Nose Pit; INITIATION; Water Boy; Alchy; Cognac Bottle; Bust-Down Watch |
| 39 | D | Cellblock Lane Sequence | 37.50% | 240 / 428 / 84 | Inmate Crafty; Inmate Boyfriend; Inmate Informant; Inmate Contraband; Inmate Kingpin; Regular guy named LeBron James; Bust-Down Watch; Cognac Bottle; Rastamon; Wifey |
| 40 | D | Blood / Red Set | 37.30% | 249 / 440 / 63 | RED PUNCH; BLOCK SPINNER; Red Plaid Petey; Ganger Red; Cane Corso (Red); INITIATION; Redneck Evil; Ruby Shades; Cognac Bottle; Bust-Down Watch |
| 41 | D | Late Scaling | 36.57% | 229 / 431 / 92 | Alchy; Ice Cream Truck; Water Boy; Laundromat Regular; Stoner Sr.; Foodz; Bus Pass; Soul Food; Cognac Bottle; Bust-Down Watch |
| 42 | D | Poison Entry Punishment | 35.64% | 225 / 441 / 86 | Bottle Girl; Cologne Criminal; Nail Tech; Mural Apprentice; Fein; Simmy; BBL Demon; All Jokes Roaster; Plug; Wifey |
| 43 | D | COMPOUND INTEREST | 33.44% | 216 / 465 / 71 | Cornball; Plug; Live Streamer; Rastamon; Gamer; STOCKZ; Snow Bunny; Bus Pass; BUDDY; Cognac Bottle |
| 44 | D | Demario and Luigion | 26.53% | 166 / 519 / 67 | Demario; Luigion; Rastamon; Cool Vibe YN; Plug; Bust-Down Watch; Soul Food; Black Cowboy; Hair Stylist; Stylist |
| 45 | D | Sherlock and Watson | 21.94% | 128 / 550 / 74 | Sherlock; Watson; Crossing Guard; Night Shift Medic; Wifey; Shotta; Oz; Rastamon; Bust-Down Watch; Tin Man |
| 46 | D | Counterplay — Legacy Comparison | 16.76% | 99 / 599 / 54 | Shotta; STUD; Pinay Nurse; Wifey; Rastamon; Goth Kid; Bus Pass; Soul Food; Cognac Bottle; Bust-Down Watch |

## Reading the evidence

- [Named rosters and stable IDs](deck-rosters.csv), [sortable rankings](rankings.csv), [all matchup rows](matchups.csv), [policy/seat splits](deck-breakdowns.csv), and [catalog snapshot](catalog.csv).
- `matrix/`, `stress/`, `confirmation/`, `coverage-completion/` retain separate plans, summaries, raw worker files and checksums. Keep their different policies and sample sizes visible.
- Historical runs with different rules, rosters, policy models or schedules are not direct before/after comparisons. Card deployment and emitted events are descriptive, not causal card-strength estimates.
