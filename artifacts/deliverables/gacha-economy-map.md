# Squabblemon: earned progression and Trading Post

Implementation map — September 8, 2026. Values below are initial tuning, not measured live balance.

## The player loop

Dr. Fade introduces play → Rookie Road grants a 17-card foundation → build a seven-card crew → finish verified practice → claim the welcome rewards → continue story or practice → earn Clout and character XP → train, learn moves, recruit, or pull → rebuild the crew → return to the streets.

The shop is at `/game/shop`; pack opening is `/game/shop?view=packs`. Wallet balances, collection inspection, battle results, and the safehouse point players into that loop. Story dialogue and authored chapter content remain under the story agent's direction.

## Wallets and earnings

| Resource | Earn it from | Spend it on |
| --- | --- | --- |
| Clout | Verified story/practice matches, bounties, authored story rewards, collection milestones, pack bonuses | XP, move coaching, tickets, extra saved crews, targeted Common recruits |
| Pack tickets | Welcome reward, Rookie Road bounty, weekly bounty, first perfect story clears, collection/story rewards, shop | Street Packs |
| Style Shards | Duplicate cards and pack bonuses | Tagged and Chrome cosmetics |
| Character XP | Owned characters actually played in a verified battle; shop training | Character levels; eligibility for coaching |
| Profile XP / Rep | Verified matches and authored progression rewards | Account progress and reputation; these are not spendable wallets |

| Verified result | Clout | Profile XP | Rep | XP per participating owned character |
| --- | ---: | ---: | ---: | ---: |
| Win | 40 | 50 | 8 | 30 |
| Draw | 30 | 35 | 4 | 25 |
| Loss | 20 | 25 | 2 | 20 |

No repeatable tickets are issued directly by a match. Offline guest battles do not save account rewards. Tutorial rewards remain separate. Every story battle grants the repeatable schedule; authored first-clear and first three-star ticket rewards are additive and remain one-time claims.

Existing bounties: finish a match for 100 Clout daily; win a match for 150 Clout daily; finish five matches for two tickets weekly. Claim buttons remain explicit. The daily reset is midnight UTC; weekly reset is Monday UTC.

## Shop inventory

| Offer | Cost | Result / limit |
| --- | ---: | --- |
| Practice Session | 100 Clout | +100 XP to one owned character |
| Intensive Training | 225 Clout | +250 XP to one owned character |
| Move Coaching I / II / III | 150 / 400 / 900 Clout | Activate the next authored tier, requiring level 2 / 5 / 8 |
| Street Pack Ticket | 200 Clout | One pack ticket |
| Extra Crew Slot | 350 Clout | One saved-deck slot; maximum 12 |
| Neighborhood Recruit | 400 Clout | Choose an unowned Common directly |
| Tagged Finish | 80 Style Shards | Cosmetic; requires the character |
| Chrome Finish | 140 Style Shards | Cosmetic; requires the character |

A pack also accepts 200 Clout directly. Buying a ticket costs the same. XP near the level cap is discounted proportionally so no paid XP is discarded. All three moves cost 1,450 Clout in total. Levels cap at 10 / 4,500 XP; thresholds follow `50 × level × (level − 1)`.

The 250-Clout welcome grant buys a first 100-XP session and first 150-Clout move. Alternatively, the player can save it for a pack. A ticket costs five wins or ten losses before mission and pack bonuses. The first match bounty covers the first XP session; a first win can also complete the 150-Clout win bounty. These are starting hypotheses for playtesting, not a promise that grind pacing is finished.

## Rarity and Common roster

| Display name | Color | Base full-pool card-roll weight |
| --- | --- | ---: |
| Common | Gray | 60% |
| Uncommon | Green | 25% |
| Rare | Blue | 12% |
| Super Rare | Purple | 2% |
| Legendary | Yellow | 0.8% |
| Mythical | Red with orange foil | 0.2% |

Red and orange are one Mythical tier, avoiding two tiers with the same name. The old persisted `Epic` identifier displays as Super Rare, preserving saves. Techbro Rich is Legendary; OG Uncle is Mythical. Rarity changes acquisition and presentation; it does not multiply combat stats. Cosmetics do not change combat.

Commons added: Young Bull, Racially Ambiguous Transplant, Bad Lil Cousin Tayaty, Edgar, Nguyen, Man-Man, Pinay Nurse, Honest Thot, Earthy Sugar Foot, Abuela, and Ice Cream Truck. They have individual transparent art, actual abilities, and three upgrade tiers. They are eligible for packs and targeted Common recruitment.

Each Street Pack contains three rewards. Slot one guarantees a missing card while one remains. If its rolled rarity has no missing cards, it selects uniformly among all remaining missing cards, so effective odds change with collection ownership. Slot two is 45% card / 30% shards / 20% Clout / 5% style, with an unowned style guaranteed on the tenth eligible opening. Slot three is 70% shards / 30% Clout. Duplicate cards become 25 shards. This pity applies to cosmetic styles, not Legendary/Mythical characters. The in-game odds panel discloses this distinction.

## Persistence and compatibility

- Prices, prerequisites, and purchase arithmetic are shared between the UI quote and server transaction.
- The server validates ownership and available funds; UI values are not accepted as prices or rewards.
- Every shop purchase has a UUID. Repeating it returns the existing receipt; changing its contents returns a conflict. Profile debit, inventory grant, and receipt commit together under the same player row lock used by packs, rewards, and normalization.
- The browser journals an unconfirmed request before sending it. A lost reply can be recovered without paying twice. Starting another purchase waits until the pending one is resolved.
- Character progression now stores `moveTier` alongside XP and level. Existing entries without that field retain previously earned eligible moves; new entries start at tier zero. No existing owned cards are removed.
- Bootstrap no longer hands the expansion catalog to every new account. The 17-card onboarding foundation remains. Existing expansion owners keep their cards.
- Match-start snapshots freeze the purchased moves for the whole battle. Training mid-match cannot change that match's replay or rewards.
- Story rewards continue to use the issued story snapshot. Replaying or retrying a completed match cannot repeat first-clear rewards.
- Shop receipts use namespaced keys in the existing collection claim ledger; this addition requires no new SQL table. Concurrent story work has its own schema additions that must also be applied before a combined deployment.

## Walkthrough to verify

1. Fresh account completes Dr. Fade / Rookie Road and receives the foundation exactly once.
2. Save a legal seven-card crew, finish practice, and claim the welcome reward.
3. Open Trading Post, choose Cornball, buy 100 XP, then buy the level-two move. Confirm 0 → 100 XP and 0 → 1 active moves.
4. Start a new match and confirm the purchased move is in its server snapshot and affects the authored ability.
5. Finish a story fight. Check Clout, account XP, Rep, participating card XP, bounty progress, and separate first-clear rewards.
6. Buy a ticket and open a pack. Check wallet debit, ownership, duplicate shards, and recoverable reveal.
7. Recruit a Common, equip it in a saved crew, and play it. Duplicate recruitment must be unavailable.
8. Retry an interrupted purchase and match result. Close/reopen the page. Check no double charge or duplicate grant.
9. In simultaneous requests, confirm wallet updates serialize and never overspend.

## Validation and remaining release dependency

Pure shop, progression, pack, combat, Common ability, purchase journal, and deck tests pass. API and client type checks pass. The shop was exercised at desktop and 390px phone widths: XP purchase, move coaching, insufficient funds, and ticket handoff.

Database-backed concurrency tests are present but skipped here because `DATABASE_URL` is not configured. Saved-account end-to-end verification requires a development database plus Clerk configuration. Netlify is connected through the app connector, but the local deployment CLI is not signed in. Deployment completion and the live phone URL must be recorded after those dependencies are resolved; this document does not claim a live release.

## Publishing this build

The repository now includes `netlify.toml`, a guarded release build, and a Netlify function adapter around the existing Express API. The adapter preserves JSON requests, query parameters, authentication headers, separate session cookies, and binary responses. Its transport tests pass; it has not been exercised against a live account database.

Use the existing Netlify project `squabblemon-triple-lane` (site ID `572e48d3-6f4d-427f-9a9b-df5e195ea47c`). Both matching Netlify projects were found, and the primary game's hosted environment contains no configured variables. The local workspace contains only the disposable preview-login setting.

Required configuration, entered through Netlify's environment settings rather than committed to source:

- Build: `VITE_CLERK_PUBLISHABLE_KEY`; public HTTPS origin (Netlify's deploy URL is also accepted).
- Function runtime: `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, and `NODE_ENV=production`.
- The Clerk application's allowed domains must include the chosen play URL. Use the same Clerk instance for browser and server.
- Apply the combined repository database schema, including the story agent's additions, to the intended development/release database. Then run the database-backed tests and verify a disposable account through onboarding, battle rewards, shop, and pack opening before promoting the release.

The build deliberately disables `VITE_E2E_AUTH`. It refuses a release without a real configured publishable key. Missing runtime account configuration returns a service-unavailable response. It never turns the disposable QA account into a public account system.

Current checks: 65 economy/gameplay/journal/deck tests passed, five database tests skipped; two hosting transport tests passed; release-configuration test passed; frontend and API type checks and builds passed; public entry is 185.4 KiB against a 475 KiB budget. Phone purchases and the shop-to-pack handoff were exercised at 390 × 844. Public account play remains unverified until configuration is supplied.

After successful deployment, verify the actual HTTPS phone URL and email that URL to the user's chosen address or their connected Gmail account (`me`). Email sending is explicitly authorized in this conversation. No deployment or play-link email has been completed yet.

Hosting adapter references: [Netlify Functions](https://docs.netlify.com/build/functions/overview/) and [serverless-http](https://github.com/dougmoscrop/serverless-http).

The Netlify function package was built successfully with the real Netlify bundler. No publishing request has been issued because account configuration and local hosting authorization remain pending.
