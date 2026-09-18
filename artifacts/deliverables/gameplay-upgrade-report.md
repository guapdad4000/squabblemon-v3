# Gameplay upgrade — implementation and test report

Completed locally September 10, 2026. All seven requested improvement areas now have playable or usable implementations. No deployment, new character art, or Street Pack odds changes were made.

## What changed

| Area | Delivered behavior |
|---|---|
| Smarter rivals | A bounded two-turn plan evaluates real ability outcomes, support setup, discounts and district control. Pressure, control, movement and support styles add different priorities. The bot can pass to preserve a better position. Private player hands and draw order are removed from its planning state. |
| Varied training | Open training rotates among suitable recipe difficulty bands and avoids the last eligible opponent. Six selectable challenges introduce mixed pressure, control, movement, support, freeze and cheap-chain crews. All rosters and seeds are captured at match start. |
| Deck-building help | Live Motion cost curve, affordable opening-card count, warnings for weak openings, and explanations for Nguyen, Gamer, support, movement, crowd payoffs and missing cleanse. Suggestions support unrestricted player-built crews. |
| Common balance | Edgar: 2 Motion / 3 Power, retaining his conditional +1. Abuela: 3 Motion / 4 Power, retaining her ally +2. Pinay Nurse: 2/2, always gives the lowest-Power other ally +1 and cleanses its freeze/silence if present. Self-upgrade and ally-effect budgets remain separate. |
| Battle clarity | Ability messages identify protection and Nail Tech mitigation. Dr. Fade provides one factual post-match observation drawn from actual events or final district margins. The result screen scrolls correctly on phones. |
| Experimentation and mastery | Weekly cleanse, movement-win and changed-crew missions. Each corresponding first-time career milestone earns one chosen unowned Common: up to three permanent card choices. Five wins in which an owned character was summoned unlock its gold mastery badge on the wall of fame. Destroyed cards retain participation credit. |
| Late-game activities | Equal Footing practice uses base move tiers on both sides. Neighborhood Night rotates three rule sets by Monday UTC. Street Draft offers seven rounds of three choices, with undo and a guaranteed affordable first offer. After-hours Boss adds three announced escalation phases. Event victories unlock display badges. |

Find activities through **Fight / Run the block**, or the safehouse training station. Find card choices and the mastery gallery under **Bounties → Experiments and mastery**. Deck guidance appears in both the normal builder and the first-crew workshop.

## Event and reward rules

- Equal Footing, Neighborhood Night, Street Draft and After-hours Boss all use level-one combat snapshots with no move upgrades. Owned progression remains intact and continues earning eligible XP.
- Draft cards are borrowed only for that event. They do not enter inventory; unowned borrowed cards earn no card XP or character mastery credit.
- Draft offers are deterministic within the event week. The server validates each pick against its own offer, rejects duplicates and stale weeks, and stores the chosen roster.
- Match completion replays the issued encounter and exact six-move transcript. Weekly rotation or later deck edits do not rewrite an active encounter.
- Mission progress, career flags, cosmetic unlocks and card choices use the existing profile transaction lock. Duplicate completion or claim requests cannot credit the reward again.
- Changed-crew milestones compare card membership against the last completed practice roster. Reordering the same cards does not count; drafts do not earn this milestone.
- Weekly mission currency can be earned again after reset. The three career card choices and mastery badges are permanent milestones.

## Additional issues found and fixed during testing

**Stored match snapshots:** PostgreSQL JSONB can reorder object keys. The previous upgrade validator compared serialized objects, rejecting valid saved snapshots as forged. It now compares explicit ordered fields while retaining roster, level and upgrade validation. The real HTTP start/complete tests exercise this database round trip.

**Fast-forward race:** A cinematic button fading out can retain an older event handler. A late click could restart the intro state after a turn was committed. Skip handlers now read the current match/presentation state, and cancelled timeline continuations cannot revive an older sequence. The complete rookie journey passes on both layouts after this change.

**Destroyed-card participation:** Participation now comes from authoritative summon events, so an owned card destroyed before the final board still earns its participating XP.

## Validation

- **100 app/shared-engine tests passed**, zero failures or skips: all eleven activities replay, draft legality, rival rotation, hidden-hand isolation, revised Commons, career goals, support upgrades, destruction, previews, presentation cancellation, deck workshop and existing battle rules.
- **12 server tests passed**, zero failures or skips: real activity HTTP routes, normalized snapshots, invalid drafts, duplicate completion, concurrent chosen-card claims and bootstrap reads, temporary draft ownership, progression and authorization.
- **Phone 390×844 and desktop 1280×900:** deck guidance, chosen Common reward, draft pick/undo, five complete activity battles per layout, and post-match coaching.
- **Rookie journey on both layouts:** tutorial, card swap, save/reload, failed-save recovery, verified personal match, recap, welcome reward and subsequent crew selection.
- Shared packages compiled; app and API type checks passed.
- Production build passed. Public entry bundle: **187.4 KiB / 475 KiB** budget.

Browser account requests use fixtures preserving the real contract and shared replay engine. Separately, the HTTP and transaction tests run the actual API route and reward code against an isolated local PGlite database, with a test-only authenticated session. Production authentication was not modified. PGlite supports the PostgreSQL protocol but multiplexes connections differently from a normal PostgreSQL server, so these checks are not a production concurrency/load certification. [PGlite socket documentation](https://pglite.dev/docs/pglite-socket).

## Practical limits

The bot's second-turn forecast is an optimistic plan for its own next play; it does not model every possible opposing response or learn from live players. Balance assessments are still code and scenario based, not live win-rate measurements. Competitive practice here is against the bot; this update does not introduce ranked PvP or a leaderboard. Mastery cosmetics are display badges, not additional character skins.

Existing three-tier self-Power scaling remains available in ordinary progression. Equal-footing events remove that advantage for their matches. Client and API combat changes should ship together, with old active matches finished or expired before rollout; historical snapshots do not preserve old executable engine versions.

## Evidence and rerunning

- App results: `gameplay-tests-app.txt`
- Server results: `gameplay-tests-server.txt`
- Production build: `gameplay-build.txt`
- Browser journeys: `artifacts/squabblemon/e2e/verify-gameplay-upgrade.ts` and `verify-player-journey.ts`
- Screenshots: `screenshots/gameplay-builder-390.png`, `gameplay-events-1280.png`, `gameplay-draft-390.png`, `gameplay-career-390.png`, `gameplay-result-390.png`.

Test-only database dependencies and startup/schema configuration live in `artifacts/gameplay-test-db`; they are isolated from the game runtime. Start its `server.mjs`, apply its `drizzle.config.ts` to localhost port 55439, and point the API tests at that disposable database. Browser tests accept `JOURNEY_ORIGIN` and run through the existing test-auth app configuration.
