# Task 118 balance changelog and archetype map

This is the authored before/after record for the balance-lab patch. “Before” means the
pre-patch rule recorded in the task brief; “after” is the current engine definition. Card
IDs are engine IDs (the IDs used by the balance lab), not display names.

## Final before/after changes

| Card ID | Before | After |
| --- | --- | --- |
| `asphaltapostle` | 3 Motion / 4 Hands; protected the weakest other Earth ally **in its district**; existing forced-move guard gave that ally +2 | 3 / 4; protects the weakest other Earth ally **anywhere** and gives it +1; keeps the once-per-round forced-move guard and its +2 |
| `mansamusa` | 5 / 5; weakest other ally in each district +1; another-district discount | 4 / 4; weakest other character in each district +1, or +2 when that target is Earth; same discount |
| `johnhenry` | 5 / 5; +1 per other local friendly character, capped at +3; with two local allies, strongest enemy −1 | 5 / 6; +1 per other friendly Earth character across the board, capped at +4; with two Earth allies, strongest local enemy −2 |
| `partytitan` | 6 / 7; weakest other friendly card in each district +1 | 6 / 7; same targets now gain +2 |
| `landlord` | 4 / 6; first enemy card at this district each round paid +1 Motion, with no growth | 2 / 3; same non-stacking local +1 tax; when actually paid, Landlord gains +1 once per round |
| `sherlock` | 3 / 3; visible strongest-other-district trap cancelled the next entrance ability and expired after next round | 3 / 4; same trap and expiry; a real cancellation gives Sherlock +2 if still active on board |
| `watson` | 2 / 2; restored up to 2 damage-lost Hands only to a weakest injured local ally | 2 / 2; restores up to 3 actual damage-lost Hands and Protects that ally; without an injured ally, Protects the weakest other local ally; also Protects a friendly Sherlock anywhere |
| `oz` | 4 / 3; once per match repeated only the last ally that moved in the same round | 4 / 4; once per match repeats the most recent eligible other friendly entrance still on board, including earlier rounds; ability-copying effects remain excluded |
| `dorothy` | 3 / 3; return and next-deployment −1 Motion | 3 / 4; same return and discount |
| `scarecrow` | 2 / 2; swap with weakest ally in another open district; both +1 | 2 / 3; same swap and +1 |
| `tinman` | 2 / 2; first other ally entering each round gained Protection | 2 / 3; same once-per-round Protection |
| `alice` | 2 / 2; once-per-match round-end return except final round; next deployment +3 Hands | 2 / 3; same return/final-round exclusion/+3, plus one next-deployment −1 Motion discount, minimum 1 |
| `cheshire` | 3 / 3; first returned ally each round left a 2-Hand Grin, one per friendly district | 3 / 4; same limit, but leaves a 3-Hand Grin |
| `queenofhearts` | 4 / 3; executed weakest enemy at 3 or fewer Hands; successful execution summoned a 2-Hand Guard | 4 / 4; execution threshold is 4 or fewer Hands; Guard remains 2 Hands and conditional |
| `guap` | 6 / 5; FINNAM! counted other allies and reduced enemies only in GUAP’s district; Fire hand bond | 6 / 6; counts other friendly characters across the board (cap +5), gives every enemy across the board −1, and is capped once per owner per round; same Fire hand bond |
| `bigzoey` | 3 / 2; local weakest-other-ally +2 and weakest-enemy −2 | 3 / 3; same local exchange |
| `ronald` | 3 / 3; once-per-round actual enemy damage to another local ally gave weakest ally in each other district +1 | 3 / 4; same trigger, cap, and cross-district support |
| `bbldemon` | 4 / 4; every enemy here −1 | 4 / 5; same local −1 |
| `bottle` | 2 / 3; round 4+ gave +2; next printed 2-cost card −1 Motion | 2 / 3; same round 4+ +2; next Poison character −1 Motion, minimum 1, through the next round |
| `demario` | 3 / 3; summoned a 1-Hand Mushroom with room | 3 / 3; same summon, plus the next other friendly character consumes one Mushroom for +1; Powered Luigion gets +2 |
| `luigion` | 2 / 2; SQUABBLE transformation was the meaningful payoff and required the existing Mushroom interaction for its premium ceiling | 2 / 2; always gains +1, then buffs the weakest other local character +1 or gains a second +1 alone; SQUABBLE still transforms, may consume at most one same-owner local Mushroom for +2, then jumps to the weakest open other district and gains +1 if movement succeeds |

All other numbers in these abilities are unchanged, including existing Protection, immunity,
movement-lock, minimum-cost, and once-per-round/match guards.

## Unchanged boundaries and benchmarks

### Cellblock and Neighborhood baselines intentionally retained

`inmate-crafty` remains 2/2 with local +2 when a friendly **support** is present;
`inmate-boyfriend` remains 3/3 with weakest-other-ally +2;
`inmate-informant` remains 3/3 with blockable strongest-local-enemy −2;
`inmate-contraband` remains 2/2 with the capped 1-Motion refund only when another friendly
character is present. `demario` and `luigion` changes above are the only Neighborhood signature
rules in this patch; no generic faction passive was added. `lebron-james` remains the fictional
4/4 Mythical Normal support card with cleanse, Protection, and the conditional +1.
Mushroom and Powered Luigion remain battle-only, non-collectible, non-packable, non-deckable,
and without progression identities.

No rarity, pack odds, acquisition source, or automatic rarity combat multiplier changed.
The six-round economy remains 2 opening Motion, at most 1 carried Motion, and a 9-Motion cap.
Earth bonds on `torta` and `concrete` were not amplified. Normal cards remain flexible glue;
`techbro` remains the 4/5 conditional +2 benchmark. `folks`, `sneaker`, `counter`,
`captainjigga`, `ashlee`, `tayaty`, Stockz, Streamer, Boss Bae, and other high-sensitivity
engines were not buffed. Existing starter definitions, saved crews, card ownership, cosmetic
IDs, and starter selection are unchanged; these are lab compositions only.

## Recommended ten-card crews

These are reproducible test crews, not new starters:

| Archetype | Engine card IDs |
| --- | --- |
| Earth tax and finishers | `landlord`, `bigzoey`, `stud`, `torta`, `concrete`, `mansamusa`, `johnhenry`, `partytitan`, `asphaltapostle`, `failedathlete` |
| Sherlock / Watson | `sherlock`, `watson`, `crossingguard`, `nightmedic`, `wifey`, `counter`, `oz`, `rastamon`, `bustdown`, `tinman` |
| The Wiz movement | `dorothy`, `scarecrow`, `tinman`, `oz`, `lion`, `passportbro`, `break`, `bboy`, `ogdominican`, `delivery` |
| Wonderland return | `alice`, `cheshire`, `watson`, `vibe`, `snow`, `laundry`, `waterboy`, `conductor`, `alchy`, `squabbleserver` |
| Fire / GUAP | `guap`, `folks`, `hooper`, `bbldemon`, `cornercoach`, `cognac`, `krump`, `dancecaptain`, `og`, `baby` |
| Poison entry | `bottle`, `colognecriminal`, `nail`, `mural`, `fein`, `simmy`, `bbldemon`, `roaster`, `plug`, `wifey` |
| Cellblock lane | `inmate-crafty`, `inmate-boyfriend`, `inmate-informant`, `inmate-contraband`, `lebron-james`, `bustdown`, `cognac`, `rastamon`, `wifey`, `stud` |
| Demario / Luigion | `demario`, `luigion`, `rastamon`, `vibe`, `plug`, `bustdown`, `soulfood`, `black-cowboy`, `hair-stylist`, `stylist` |

## Deterministic evidence and open flags

The completed smoke run covered **160 matrix matches**: four decks, ten pairings, two fixed
district seeds, rotations 0 and 3, base and fully trained tiers, mirrored seats, and SQUABBLE.
The greedy policy produced 24 paired-swap cases; bounded first-legal and seeded-legal probes
each produced 12 cases. Reports include paired deltas and standard error. The smoke fingerprint
was `d007f346`, with 160/160 successful matches and the intentional blocker exit.

The completed final deliberate bounded full configuration is **11 decks / 55 pairings / 880 scheduled
matches**: the eight affected shells above plus `focus-wave7-legends` (Fire),
`focus-counterplay` (control), and `focus-air-bond` (movement). It uses exactly two fixed district seeds,
rotations 0 and 5, base and fully trained tiers, mirrored seats, and SQUABBLE. The full report
completed with final fingerprint `54f19dec`: **880/880 successful matches, zero engine failures**,
36.8% player-seat score, 20 blockers, and 25 reviews. Final deck score rates were Wave 7
72.8%, Poison 70.0%, Fire/GUAP 67.5%, Air Bond 64.4%, Earth 63.7%, Wiz 58.4%, Wonderland
50.6%, Demario/Luigion 33.8%, Counterplay 24.4%, Sherlock/Watson 23.1%, and Cellblock 21.3%.
The greedy policy produced 288 paired cases; first-legal and seeded-legal each produced 96,
with player-seat rates of 49.1% and 59.4% respectively.

The final guardrail decision rejected the optional Block Party Titan +2 spread candidate and
the optional BBL Demon 5/4 body candidate. Titan remains 6/7 with its established +1-per-
district spread, and BBL Demon remains 4/4 with its local -1-to-every-enemy identity.
Required GUAP, Landlord, Mansa Musa, John Henry, and Bottle Girl signature mechanics were
retained; Earth is now within the intended band at 63.7%.

Inherited findings are player-seat skew, existing Wave 7/Tayaty combo swings, and the
Late Scaling/Wave 7 Legends win-band behavior. Patch-sensitive shell findings are the new
Cellblock, Sherlock/Watson, Fire/GUAP, Poison, and Counterplay bands, plus GUAP, Landlord,
Oz, Demario, and Luigion probes. All are investigation signals rather than proof of a
regression or universal card win rates. The earlier 20-deck/6,720-match expansion is not the
release matrix.
Human fun, comprehension, strategy-discovery, and fairness approval remain **PENDING** under
`scripts/BALANCE_PLAYTEST.md`.