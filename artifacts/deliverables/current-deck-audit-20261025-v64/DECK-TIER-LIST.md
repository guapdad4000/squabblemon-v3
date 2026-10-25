# Current tested deck tiers and named rosters

- Rules **64**, card balance **64**; base Git commit `61e9a86c1bd1ba49e350bd4a488671ab37d26ad2`; source SHA-256 `dfbfacef31b2fe22c0cfb012f0b0013b8b32fb66c4df325c138f320b25956a5b`.
- The source manifest in each plan.json binds the audited working source, including local uncommitted changes. The base Git commit alone cannot reproduce this run.
- **46 fixed league recipes; 17,296 league matches; 752 seat appearances per deck.** Mirror games contribute two deck appearances.
- Additional evidence: 2,816 stress/probe matches; 256 confirmation matches. 20,368 successful scheduled matches overall; zero failed cases.
- League recipes represent 219/301 collectible cards. Across all 3 schedules, 301 cards were observed played; 0 were not.
- Score = (wins + half draws) / appearances. Tier bands: S ≥60%, A ≥55%, B ≥50%, C ≥45%, D <45%. These descriptive bands are not confidence intervals.
- Policy model: `online-base-shared-legal-delayed-horizon-v3`.
- These are source-pinned automated **base-card PvP** samples, not live player win rates, an optimized/custom-deck search, PvE results or validation of upgraded cards. Confirmation, stress and supplemental coverage samples are not pooled into league ranks.
- Policies: chain-two, greedy. League: 184 distinct seed labels, rotations 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, both seat assignments. Seed labels need not produce independent district layouts.
- Live solo CPU uses chooseCpuPlay/revealCpuTurn with encounter behavior weights and a different search. These online-seat policy samples do not measure Story/training CPU performance.
- Known policy limits: live CPU retains a cheap-card Gamer setup heuristic and different paid/Squabble choices; ranked bots add a separate Squabble decision. This audit evaluator stops valuing spare resources after round five even when matches can extend. None of these samples establishes live-bot parity.
- No gameplay change or deployment is implied. Full input/output checksums and runtime resolution are in [provenance.json](provenance.json); deployment coverage is in [coverage.json](coverage.json).

| Rank | Band | Deck | Score | Wins / losses / draws | All ten cards, in tested order |
|---:|:---:|---|---:|---|---|
| 1 | S | Light | 78.39% | 558 / 131 / 63 | Abuela; Church Auntie; Night Shift Medic; Foodz; Dr. Fade; Pinay Nurse; Crossing Guard; Leroy; Yasuke; Homeless Wiseman |
| 2 | S | Air | 71.94% | 512 / 182 / 58 | The Flight Plug; Promoter; Captain Jigga; Honest Thot; Big City Pigeon; Baby Crying on an Airplane; Airheaded Model; P. Tang; OG Dominican; Cheshire |
| 3 | S | The Wiz | 69.41% | 498 / 206 / 48 | Dorothy; Scarecrow; Tin Man; Oz; Lion; Passport Bro; Break; Bboy; Wicked Witch; Flying Monkeys |
| 4 | S | TOUR MONEY | 69.15% | 497 / 209 / 46 | Studio Couch YN; The Opening Act; Mixtape Cousin; The Rapper; The Hype Man; Tour Van Driver; Merch Table Hustler; The Manager — Nice; The DJ; One-Man Band |
| 5 | S | Fire | 68.35% | 485 / 209 / 58 | GUAP; FOLKS; Hooper; BBL Demon; Corner Coach; Krump; OG Uncle; Baby Momma; Young Bull; KYLE |
| 6 | S | EVERYBODY EATS | 67.82% | 480 / 212 / 60 | Homeless Guy; Homeless YN; Homeless Legend; Cracked Head; Community Cook; Foodz; Night Bus Driver; Delivery App Cyclist; Bluetooth Unc; Booster |
| 7 | S | Dark | 67.22% | 476 / 217 / 59 | Shotta; Gamer; Goth Kid; Closet Nerd; Red Pill; Sho'Nuff; Queen of Hearts; Repo Man; The Feds; Chess Regular |
| 8 | S | Fire and GUAP | 65.49% | 464 / 231 / 57 | GUAP; FOLKS; Hooper; BBL Demon; Corner Coach; Cognac Bottle; Krump; Dance Circle Captain; OG Uncle; Baby Momma |
| 9 | S | Wonderland Return | 63.96% | 456 / 246 / 50 | Alice; Cheshire; Queen of Hearts; Mr Rabbit; Dorothy; Laundromat Regular; Water Boy; GUAP; Alchy; Mad Hatter |
| 10 | S | NO EQUIPMENT NEEDED | 63.90% | 446 / 237 / 69 | Track Suit Auntie; Gym Bag YN; Stairwell Sprinter; Gym Spotter YN; Calisthenics YN; Jump Rope Menace; Personal Trainer; Fitness Girl; Last Set OG; OG Calisthenics |
| 11 | S | Plant | 61.97% | 438 / 258 / 56 | Performative Male; Ashlee; Rooftop Gardener; OG Vegan; Matcha Freak; A Spare Gus; The Street Apostle; Homeless Legend; Rastamon; Lola |
| 12 | S | SQUABBLEHOUSE SHIFT | 61.50% | 424 / 251 / 77 | SquabbleHouse Manager; SquabbleHouse Bus Boy; SquabbleHouse Cashier; SquabbleHouse Security; SquabbleHouse Teknician; SquabbleHouse Griddle Master; SquabbleHouse Inmate Reformed; SquabbleHouse Janitor; SquabbleHouse Waffle Warlord; SquabbleHouse A Side of Hands |
| 13 | A | Wave 7 Legends | 59.31% | 412 / 272 / 68 | Ashlee; Captain Jigga; Shotta; Bad Lil Cousin Tayaty; Young Bull; Honest Thot; Bus Pass; Soul Food; Cognac Bottle; Bust-Down Watch |
| 14 | A | ONE MORE REP | 58.71% | 397 / 266 / 89 | Failed Athlete; Fitness Girl; Fitness Bro; Personal Trainer; Lash Tech; Apartment Maintenance Sage; YN ATV Lord; Hooper; Sports Prodigy; Demon Trainer |
| 15 | A | Mushroom Garden | 58.31% | 411 / 286 / 55 | Demario; Luigion; Rooftop Gardener; OG Vegan; Matcha Freak; Performative Male; A Spare Gus; Hair Stylist; Stylist; Black Cowboy |
| 16 | A | FIX YOU A PLATE | 58.05% | 405 / 284 / 63 | The Favorite Grandchild; Cousin Back From College; Plate Auntie; Church Auntie’s Rival; Big Sister; Second Plate Cousin; Grill Uncle; Grandma Said Sit Down; Group Chat Instigator; Black Air Fade 1’s |
| 17 | A | Earth | 57.58% | 394 / 280 / 78 | Torta; Balikbayan Box Bot; Mansa Musa; John Henry; The Asphalt Apostle; Landlord; Big Zoey; STUD; Bouncer; Lion |
| 18 | A | Air Bond | 57.31% | 389 / 279 / 84 | Honest Thot; Ashlee; Captain Jigga; All Jokes Roaster; Bikelife YN; Cool Vibe YN; Bus Pass; Soul Food; Cognac Bottle; Bust-Down Watch |
| 19 | A | Earth Tax and Finishers | 56.91% | 387 / 283 / 82 | Landlord; Big Zoey; STUD; Torta; Balikbayan Box Bot; Mansa Musa; John Henry; Block Party Titan; The Asphalt Apostle; Failed Athlete |
| 20 | A | Cellblock Pressure | 55.45% | 374 / 292 / 86 | Inmate Crafty; Inmate Boyfriend; Inmate Informant; Inmate Contraband; Regular guy named LeBron James; Bust-Down Watch; Cognac Bottle; Tin Man; Shotta; All Jokes Roaster |
| 21 | B | WHO GOT THE AUX | 54.85% | 376 / 303 / 73 | The Opening Act; The DJ; The Hype Man; The Manager — Nice; The Rapper; The Janky Promoter; The Local Celebrity; The Battle Rapper; The Manager — Evil; The OG Rap Legend |
| 22 | B | Electric | 52.13% | 360 / 328 / 64 | Electrician Foreman; Pirate Radio DJ; TRON; Plug; E.V. Enthusiast; Game Developer; Dominican Phone Salesman; Tin Man; Techbro Rich; Boss Bae |
| 23 | B | Street Legends — Growth and Routes | 51.53% | 356 / 333 / 63 | Mr. Mc Hands; OG Uncle Harley Davidson; Pimp Swookie; Gas Station Window Wiper; The Bail Bonds Auntie; Ms. Mary Mack; Landlord; Bottle Girl; Nail Tech; Man-Man |
| 24 | C | Water | 47.67% | 319 / 354 / 79 | Gas Station Sushi Chef; Last Train Conductor; Cool Vibe YN; Water Boy; Laundromat Regular; Alchy; Ice Cream Truck; Hot Tub Hottie; Gator Boy; Watson |
| 25 | C | Poison | 46.81% | 310 / 358 / 84 | Bottle Girl; Nail Tech; Mural Apprentice; Fein; Simmy; Cologne Criminal; Seafood Assassin; God of Hookah; Bus Pass; Soul Food |
| 26 | C | Street Legends — Relationship Pressure | 45.94% | 306 / 367 / 79 | The Work Hubby; The Guy She Told You Not to Worry About; Crazy Ex-Boyfriend; Side Chick; Suga Mama; Wifey; Baby Momma; Ms. Mary Mack; BBL Nice; Barber Bro |
| 27 | C | RECEIPTS | 45.35% | 305 / 375 / 72 | Cornball; All Jokes Roaster; Closet Nerd; Snow Bunny; Plug; Baby Momma; Hooper; Bus Pass; Soul Food; Cognac Bottle |
| 28 | D | CRASHOUT SEASON | 44.48% | 296 / 379 / 77 | Cornball; Rastamon; Snow Bunny; Wifey; Baby Momma; Hooper; All Jokes Roaster; Bus Pass; Soul Food; Cognac Bottle |
| 29 | D | VOLTAGE IN MOTION | 42.29% | 282 / 398 / 72 | Game Developer; Electrician Foreman; E.V. Enthusiast; Dominican Phone Salesman; STOCKZ; Boss Bae; Plug; Live Streamer; Techbro Rich; Bikelife YN |
| 30 | D | WHO YOU KNOW | 41.02% | 272 / 407 / 73 | Cornball; Plug; Live Streamer; Gamer; Techbro Rich; Boss Bae; Wifey; Bus Pass; STOCKZ; Sneaker Reseller |
| 31 | D | Cellblock — No Kingpin | 40.96% | 266 / 402 / 84 | Inmate Crafty; Inmate Boyfriend; Inmate Informant; Inmate Contraband; Regular guy named LeBron James; Bust-Down Watch; Cognac Bottle; Rastamon; Wifey; STUD |
| 32 | D | Crip / Blue Set | 39.83% | 260 / 413 / 79 | CLUE COOKY; LOOK OUT; OG Blue; Ganger Blue; Blue-Nose Pit; INITIATION; Water Boy; Alchy; Cognac Bottle; Bust-Down Watch |
| 33 | D | THE BLOCK IS HOT | 39.16% | 255 / 418 / 79 | Cornball; Snow Bunny; All Jokes Roaster; Rastamon; Wifey; Officer Oink; Baby Momma; Bus Pass; Soul Food; Cognac Bottle |
| 34 | D | Blood / Red Set | 39.03% | 253 / 418 / 81 | RED PUNCH; BLOCK SPINNER; Red Plaid Petey; Ganger Red; Cane Corso (Red); INITIATION; Redneck Evil; Ruby Shades; Cognac Bottle; Bust-Down Watch |
| 35 | D | SLIDE THRU | 38.90% | 250 / 417 / 85 | Cornball; Bikelife YN; Cool Vibe YN; Plug; Snow Bunny; Hooper; Baby Momma; Bus Pass; Soul Food; Cognac Bottle |
| 35 | D | GOOD VIBES ONLY | 38.90% | 249 / 416 / 87 | Rastamon; Wifey; Snow Bunny; Cool Vibe YN; Hooper; Officer Oink; Plug; Bus Pass; Soul Food; Cognac Bottle |
| 37 | D | Street Legends — Investigations | 38.63% | 253 / 424 / 75 | Sherlock; Watson; Boo Boo the Fool; Parole Officer; Uncle Sam; Apartment Maintenance Sage; The Bail Bonds Auntie; Closet Nerd; Homeless Wiseman; Shotta |
| 38 | D | Wave 7 Tempo | 38.23% | 233 / 410 / 109 | Bad Lil Cousin Tayaty; Young Bull; Fein; Red Pill; Simmy; Foodz; Bus Pass; Soul Food; Cognac Bottle; Bust-Down Watch |
| 39 | D | Cellblock Lane Sequence | 37.10% | 245 / 439 / 68 | Inmate Crafty; Inmate Boyfriend; Inmate Informant; Inmate Contraband; Inmate Kingpin; Regular guy named LeBron James; Bust-Down Watch; Cognac Bottle; Rastamon; Wifey |
| 40 | D | COMPOUND INTEREST | 36.84% | 232 / 430 / 90 | Cornball; Plug; Live Streamer; Rastamon; Gamer; STOCKZ; Snow Bunny; Bus Pass; BUDDY; Cognac Bottle |
| 41 | D | Poison Entry Punishment | 35.37% | 222 / 442 / 88 | Bottle Girl; Cologne Criminal; Nail Tech; Mural Apprentice; Fein; Simmy; BBL Demon; All Jokes Roaster; Plug; Wifey |
| 42 | D | Counterplay — Dark Control | 34.97% | 236 / 462 / 54 | Shotta; Gamer; Goth Kid; Closet Nerd; Red Pill; BUDDY; Wifey; Pinay Nurse; Plug; Bust-Down Watch |
| 43 | D | Late Scaling | 34.77% | 225 / 454 / 73 | Alchy; Ice Cream Truck; Water Boy; Laundromat Regular; Stoner Sr.; Foodz; Bus Pass; Soul Food; Cognac Bottle; Bust-Down Watch |
| 44 | D | Sherlock and Watson | 23.60% | 145 / 542 / 65 | Sherlock; Watson; Crossing Guard; Night Shift Medic; Wifey; Shotta; Oz; Rastamon; Bust-Down Watch; Tin Man |
| 45 | D | Demario and Luigion | 22.81% | 136 / 545 / 71 | Demario; Luigion; Rastamon; Cool Vibe YN; Plug; Bust-Down Watch; Soul Food; Black Cowboy; Hair Stylist; Stylist |
| 46 | D | Counterplay — Legacy Comparison | 18.09% | 109 / 589 / 54 | Shotta; STUD; Pinay Nurse; Wifey; Rastamon; Goth Kid; Bus Pass; Soul Food; Cognac Bottle; Bust-Down Watch |

## Reading the evidence

- [Named rosters and stable IDs](deck-rosters.csv), [sortable rankings](rankings.csv), [all matchup rows](matchups.csv), [policy/seat splits](deck-breakdowns.csv), and [catalog snapshot](catalog.csv).
- `matrix/`, `stress/`, `confirmation/` retain separate plans, summaries, raw worker files and checksums. Keep their different policies and sample sizes visible.
- Historical runs with different rules, rosters, policy models or schedules are not direct before/after comparisons. Card deployment and emitted events are descriptive, not causal card-strength estimates.
