# Punch on Patrol — daily boss raid

Entry: Fadecade → Punch on Patrol → choose a legal, owned ten-card crew.
The cabinet opens `?game=punch-on-patrol` on the arcade route. The existing shared Back control returns to the cabinets; direct entries use the same hub fallback, and browser Forward/reload preserves the game screen.
Officer Oink sits above a dedicated three-lane precinct battlefield with five persistent tiers. Six rounds, two starting Motion increasing each round, real base-level card abilities, native hand draws and round-end/round-start effects. Existing collectible Officer Oink stays unchanged.

## Blast and score

Each daily attack is a real six-round match against a ten-card enemy-only police deck. Both sides start with five cards and two Motion, retain unplayed cards, draw once per round, and spend Motion through native legal card plays. The player uses **End Turn**, then the police choose deployments based on visible lane scores and counter targets. Their planner never inspects the player's unrevealed hand. No scheduled reinforcements or automatic replacement of officers remains.

After police pressure and native round-end effects, each lane compares player Hands with police Hands. Every surviving player character supplies 2 blast charge. Winning lanes add full Hands, ties half, and losing lanes a quarter, rounded down; police armor absorbs this Hands bonus. The lane calculation is `(2 × surviving characters + max(0, floor(Hands × outcome factor) − armor)) × tier multiplier`. Officers add one armor except Sergeant Hog, who adds four; tiers 3–5 add one extra armor per officer. Tier multipliers are 3/4/5/6/7. The three lanes automatically combine into a boss blast after each round. Damage is capped to remaining boss HP, including the displayed per-lane amounts.

Authoritative round snapshots replay actual police deployments one at a time, show settled lane scores and outcomes, then animate the combined blast. The sixth round also shows the native match win/loss/draw. Oink's HP carries into tomorrow regardless of the match result.

The custom lanes have no normal elemental or district bonus. Movement, reveals, protection, silence, freezing, summons, buffs, traps, and Mary Mack's transformation use the existing engine. Surveillance lasts through round end and expires before next-round abilities refresh. Police Hands losses are explicit raid pressure modifiers; they are not standard character defeat actions.

## Ten-card police deck

| Officer | Pressure | Counter |
| --- | --- | --- |
| Plainclothes Backup | One-Motion lane-contesting body using undercover art. | Contest its lane |
| Officer Oink | Every friendly character loses 1 Hand at round end. | Protection, silence, freeze, removal |
| Police Hound | First printed-cost ≤2 deployment in its lane each round loses 2 Hands. | Change lanes, larger cards, protection |
| Police Drone | First character deployed in its lane is silenced before reveal, through round end. | Bait it, change lanes, protection |
| Drone Operator | Present friendly characters in its lane cannot move this round. | Remove/suppress the operator before the lock applies; protection |
| Sergeant Hog | Four armor; every friendly character in its lane loses 1 Hand at round end. | Silence, freeze, protection, spread out |
| Lieutenant Ham | Removes up to three positive modifier Hands from each friendly character in its lane. | Printed power, protection, another lane |
| Corrupt Judge | Highest-Hands friendly character on the board loses 3 Hands at round end. | Protection, silence, freeze, spread power |
| Fake Protester Fed | Confiscates hazards and district traps in its lane at round end. | Another lane, silence, freeze |
| The Feds | First deployment in its lane costs +1 Motion each round; summons/tokens lose 2 Hands at round end. | Another lane, protection, silence, freeze |

Silenced or frozen officers contribute no raid pressure or armor. Protection and uncounterable status block direct Hands losses and surveillance. Police deck order is date-seeded and uses ten unique cards: the nine counter kits plus Plainclothes Backup. Costs are 1 for Hound, Drone and Backup; 2 for Ham and Protester; 3 for Operator and Feds; 4 for Hog and Judge; 5 for Oink. Police gain one extra printed Hand at tier three and two at tier five. Native abilities may gift ordinary cards to their hand, which remain legally playable. Enemy-only definitions never enter collection, packs, ownership, or player deck building. Backup uses the supplied undercover artwork. The Feds uses its original trench-coat portrait, separate from the undercover card.

## Persistent five-tier campaign

HP stays down across daily resets, reloads and interrupted saves. Clearing a tier banks its bounty atomically and unlocks the next form for a later daily entry; unused damage does not spill into the next tier. Defeating tier five completes the campaign. Players can bring a different legal deck each day.

| Tier | Form | HP | Multiplier | Tier-clear bounty (Clout / tickets / shards) |
| --- | --- | --- | --- | --- |
| 1 | Patrol Shakedown | 1200 | ×3 | 500 / 5 / 50 |
| 2 | Riot Captain | 1500 | ×4 | 700 / 7 / 70 |
| 3 | Tactical Commander | 1575 | ×5 | 900 / 9 / 90 |
| 4 | Federal Warden | 1875 | ×6 | 1200 / 12 / 120 |
| 5 | Commissioner Iron Tusk | 2250 | ×7 | 1600 / 15 / 150 |

`campaign-audit.json` runs all 15 existing decks against actual police turns on advancing daily seeds: **median 5/5/6/5/6 daily matches by tier**, 4–10 matches per tier, 426 daily attacks, 15 completed campaigns, zero engine errors. This greedy strategy does not model every human decision or custom deck. The fixed surviving-character charge prevents suppression from permanently stalling a campaign, while lane control makes wins hit harder. Reproduce from artifacts/squabblemon with `pnpm exec tsx ../../design/boss-raid/audit-campaign.ts`.

## Daily rewards

One rewarded entry per UTC day. Active runs survive reloads and can finish after reset; the next day's entry remains available after completion. Personal best and the latest 32 raid scores are saved to the account.

| Damage | Cumulative reward |
| --- | --- |
| 20 | 50 Clout |
| 50 | 100 Clout + 1 ticket |
| 90 | 175 Clout + 2 tickets + 15 style shards |
| 130 | 250 Clout + 3 tickets + 25 style shards |
| 160 | 350 Clout + 5 tickets + 50 style shards |

Tiers automatically credit only the difference from the previous tier. Server profile locks, revision checks, strict action validation and action IDs prevent forged damage and repeated wallet credits. A failed response can be retried with the same action ID. No database migration is needed: runs use the existing collection-claims JSON ledger.

## Artwork and motion

The original background-removal-only cutouts remain archived in `cutouts/` and `art-manifest.json`. The corrected mode uses the established pink/blue/white-cap/green-aviator Officer Oink as its identity reference; the original collectible remains unchanged. The old realistic brown Oink is not used in the new battlefield or cabinet. Superseded static WebPs were removed from the public bundle; original cutout masters remain archived.

Built-in imagegen produced **12 separate four-frame idle sheets**: five new Oink forms and seven police presences (The Feds now uses its original trench-coat portrait with a separate idle sway). All 48 frames are distinct. PNG masters, provenance/hashes and production prompts are in `motion-v2/`; normalized 1280×480 alpha WebP atlases are in `artifacts/squabblemon/public/assets/boss-raid/motion-v2/`. Atlases total 1,992,586 bytes. First-frame boss portraits power the five art cards and cabinet. Existing County Jail art supplies the full-screen precinct environment.

The game view puts Oink in the world above three lanes, with a slim persistent HP bar, animated police and large hand cards. Rewards, tier art, officer rules and attack history are accessible through dialogs instead of permanent sidebars. Idle animations use CSS frame steps and the shared visibility observer, stop off-screen/when hidden, pause behind popups, and respect reduced motion. No per-frame React state loop.

The blast uses three CSS/SVG charge paths, one impact and boss shake for 1.5 seconds. Reduced motion retains damage information with static presentation. No per-frame React state loop. The mode loads lazily from Fadecade; account-specific query keys and idempotent retries keep saves isolated.

## Verification

- Fourteen boss engine tests cover NPC exclusion, deterministic shuffles and legal police turns, armor, suppression, protection, movement lock, Fed tax, traps, Mary Mack, terminal scoring, and surveillance expiry before next-round guards.
- Four isolated PostgreSQL-compatible database/HTTP tests cover ownership, concurrent starts/actions, reward deltas, authentication, forged score rejection, reloads, daily reset, and foreign/stale requests, cross-day HP persistence, and exactly-once tier-clear bounty credits.
- Pre-campaign prototype `deck-audit.json`: 15 existing crews × three dates, 45 greedy automated runs, zero engine errors, 20 defeats, scores 63–160. This is compatibility/tuning evidence, not human win-rate measurement.
- `roster-audit.json`: 2,673 successful card/officer deployment-and-settlement checks, nine legitimate restricted plays, zero unexpected errors across the complete 298-card engine roster and all nine NPCs. These controlled checks do not cover every multi-card combination.
- Browser fixture exercises real UI and engine at desktop, two phones, and both iPad orientations, including reduced motion, dialogs, saved reloads, six-round results and interrupted-response retry. Fixture API is mocked; account/wallet authority is tested separately above.
- Screenshot evidence lives in `screenshots/boss-raid-v2/`. `motion-report.json` confirms all five forms load, advance real frames, pause behind dialogs/off-screen, stay still for reduced motion, and avoid title overlap on phones.

The Punch on Patrol cabinet refresh is included in the Check the Block academy and story puzzle patch.

## Battlefield UI refinement

The latest display uses a wider desktop arena, a larger centered boss with the identity label offset to the side on wide screens, a segmented HP bar, visible round numbering, larger deployed cards and readable lane Hands. Officers have grounded shadows and single-officer lanes center their sprite. Empty lanes show a quiet placement cue. The hand and End Turn controls anchor while the battlefield scrolls on shorter screens; selecting a card uses a reserved description area so the board does not shift. Tablet portrait has its own larger card and sprite sizing. Tier artwork cards have larger portraits and a stronger game frame.

`screenshots/boss-raid-match-v4/` contains desktop, 390×844 and 360×640 phones, 768×1024 and 1024×768 iPads, populated six-round journeys and blast/result captures. All five journeys end with the same 207 damage, pass reload/idempotent-retry checks, and show no browser errors or horizontal overflow. Rules tests (14), isolated database/API tests (4), workspace typechecks and production release validation pass. The production validation totals 369 passed tests and one intentional skip. Existing sprite evidence remains in `screenshots/boss-raid-ui-v3/`. This work is local and is not deployed.
