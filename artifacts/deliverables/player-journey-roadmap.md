# Squabblemon Player Journey and Deck-Building Roadmap

## Product direction

Squabblemon should make players feel that they discovered, assembled, and improved their own crew. The recurring experience is: play a match, notice an opportunity, choose a card, change the deck, and test the idea. Finishing a collection or claiming seven prescribed decks should not define success.

Keep the seven existing lists as balance benchmarks, CPU opponents, and optional learning examples. Make player-created decks the default object throughout onboarding, the home screen, rewards, story progression, and eventually competitive play. A temporary training list is useful, but the player should modify it during their first session.

The strongest first release is an integrated walkthrough using the current seven-card rules and existing roster. A larger catalog, competitive multiplayer, and limited formats are later investments. They should follow evidence that players understand and enjoy building with the cards already available.

This report separates observed implementation, published reference material, and proposed design. Timing, reward amounts, and success thresholds below are prototype hypotheses, not measured results. Local findings describe the working tree inspected on September 8, 2026; they are not claims about a deployed release.

## Research findings

### Marvel Snap: starting support and player ownership can coexist

Snap's November 18, 2025 patch introduced prebuilt decks as rewards in a new-player login calendar. Its May 19, 2026 patch added an earned Ultron deck, a synergy tutorial, clearer connections between upgrades and card acquisition, and an extension of timer-free early play. These are concrete examples of reducing the initial learning burden while teaching players how their collection and strategy develop.[^1][^2]

The useful lesson is to provide a playable starting point and then teach modification. Simply removing every starter aid would leave a beginner facing unfamiliar cards and an empty editor. Conversely, presenting seven named decks as the main product teaches selection rather than construction. Squabblemon needs a deliberate handoff between guided play and ownership.

Snap's own older acquisition announcement explicitly identified the frustration of missing one key card for a desired deck. Its April 2025 release subsequently introduced Snap Packs with an unowned-card guarantee and bonus rewards. The older announcement supports the targeting problem; its historical prices and collection thresholds should not be treated as current rules.[^3][^4]

For Squabblemon, a random new card and the particular card a player wants solve different problems. Preserve excitement from packs while guaranteeing an accessible route to a chosen gameplay card. The current implementation already has a guaranteed-new first pack slot; the missing product feature is clear, deliberate targeting.

Snap's August 2026 Draft event also demonstrates an endgame activity built around temporary decks independent of collection ownership. Its official help page describes choosing a foundation, drafting individual cards, and modifying the deck during a run. It was a limited event scheduled to end September 8, with its shop continuing afterward; this is a design reference, not an assertion that it is a permanent mode.[^5]

### Naruto: build around interactions, with edition boundaries kept explicit

“Naruto” can refer to different games. The historical Naruto CCG is the provisional reference here. An archived transcription of its early rulebook teaches adjusting a deck after playing, aligning resource symbols with intended Jutsu, and combining effects to create stronger plays. That particular edition uses a 40-card construction example. It must not be silently mixed with later 50-card rules or community variants.[^6]

Separately, Bandai's currently published Naruto Card Game introduction describes a Leader and characters selected according to that Leader's color. That is a different ruleset. It illustrates a deck-building constraint, but does not justify adding a mandatory leader or color lock to Squabblemon.[^7]

The transferable principle is functional coherence: choose a plan, supply the pieces that enable it, and include answers to interference. In Squabblemon, lore crews can help introduce characters without restricting which characters work together. A favorite character should inspire experimentation across the catalog.

### Magic: offer manageable choices that still belong to the player

Wizards' April 2023 Jump In! explanation describes choosing two themed packets to create a playable deck, with the second selection constrained to produce compatible combinations. It demonstrates how a game can reduce an overwhelming choice space without eliminating agency. These are historical mechanics, not a claim about current event prices or packet availability.[^8]

For Squabblemon, borrow the small number of understandable choices. Do not build a new packet-selection system that merely recreates the seven fixed decks under new names. The simpler adaptation is to show three individual card swaps, explain their different purposes, and let the player browse everything else if desired.

### Evidence limits

The publisher sources establish shipped mechanics and stated intentions. They do not provide controlled evidence that a particular tutorial or reward cadence improved retention. The recommendations below therefore require playtesting. No claim that this design will produce a specific retention or revenue increase is warranted.

## Current Squabblemon assessment

| Observed system | Implication for this plan |
|---|---|
| Seven named recipes exist in shared game data. | Preserve their IDs for balance and CPU compatibility; reduce their prominence in player navigation. |
| Custom decks already support seven unique owned cards and a hero selected from those seven. No faction restriction appears in deck validation. | Cross-crew construction already has a foundation. This is primarily a journey and progression change. |
| Onboarding proceeds through profile, tutorial, crew selection, and reward. | Insert a real construction lesson before onboarding ends. |
| The deck editor supports new decks and recipe cloning; recipe views themselves are read-only. | Start beginners in a saved editable deck, avoiding an unnecessary clone step. |
| The catalog contains 25 gameplay cards. Player initialization adds ten City Never Sleeps cards. | Reconcile grants before promising a slow collection journey. Players already receive substantial construction material. |
| Card levels reach 10 and unlock combat upgrades at levels 2, 5, and 8. | New cards can compete with trained cards on unequal terms; experimentation needs protection. |
| Collection Road uses ownership thresholds of 7, 9, 12, and the catalog total. | A broad starter grant can make several thresholds immediately claimable. Rework the road coherently. |
| Street Packs cost 200 soft currency or one ticket, with a guaranteed-new first slot while cards remain. | Add choice to this existing economy rather than introducing another general-purpose currency. |
| The published match-start schema includes practice, tutorial, and story. | Ranked multiplayer is a future project, not a feature this walkthrough can simply unlock. |
| The engine opens with the first five supplied cards and draws subsequent cards in supplied order. | Saved card order has gameplay consequences. The builder must expose this or the engine must change deliberately. |

These findings come from the source files listed in the implementation appendix.[^9]

The draw-order issue is particularly relevant. Removing a card and appending its replacement can change whether it starts in hand. A beginner could believe the card itself is unreliable when the editor changed its arrival time. For the first release, preserve the deterministic rules and replace cards in place, with an explicit opening-hand preview. Evaluate seeded shuffling separately; changing draw rules while redesigning onboarding would confound the learning test.

The current profile bootstrap and starter-grant paths also need one consistent ownership policy. Initialization unions in expansion cards, while choosing a starter assigns its seven cards. The new journey should perform an idempotent union of entitlements and avoid any intermediate loss or re-grant ambiguity.

## The player walkthrough

### First session: learn, change, and prove an idea

**Target: approximately 15–25 minutes, adjusted after observed playtests.** Progress is checkpoint based, so leaving midway resumes the next unfinished step.

| Step | What the player sees and does | What the game teaches |
|---|---|---|
| 1. Meet Dr. Fade | Enter a short guided match with a clearly labeled training crew. Read one instruction at a time. | Win two districts; a card's cost and Power are separate. |
| 2. Make an early decision | Choose between two affordable plays and inspect the resulting district totals. | Spending Motion and distributing Power. |
| 3. See an interaction | Play a scripted example where placement changes an ability's outcome. | Card text, timing, and targets matter. |
| 4. Take ownership | Receive the foundation collection and an editable seven-card saved deck. Choose its name and cover character. | These cards belong to the player; the list is changeable. |
| 5. Make a first swap | See three owned alternatives with one-sentence explanations. Replace one card in place, with undo. | Deck building is a strategic decision, not an administrative screen. |
| 6. Test the change | Play a short practice encounter that creates an opportunity for the chosen card. | Connect a pre-match choice to an in-match result. |
| 7. Review and continue | See what the card actually did. Keep it, undo, or change another slot. Enter Chapter One. | Experimentation includes revision, even after a win. |

Teach SQUABBLE and retreat after the player understands district scoring. Use a no-stakes guided situation first. Disable early tutorial timers rather than asking new players to understand settings before they know the game.

The first swap screen should start with a question about strategy: “What would help your crew?” Suggested choices can include moving Power, strengthening an ally, or disrupting an opponent. These are temporary suggestions drawn from owned cards, not permanent account classes. “Browse all cards” remains visible.

A concrete example using existing cards is swapping Rastamon for Nail Tech when the player wants a proactive friendly buff instead of a response to freeze or silence. The tradeoff is explicit: the new card adds support but gives up cleansing. A different player might keep Rastamon and replace another slot with Delivery Demon to reposition a cheap ally. Neither decision assigns the account to a predefined faction.

Tutorial completion should record a saved change and a completed test match, not require winning with one prescribed answer. If the player declines a swap, offer a brief guided comparison and let them retain their choice. Do not make arbitrary deck churn a gate to the game.

### First several sessions: learn how to build around a plan

**Target: matches 2–10, with flexible session length.**

Chapter One becomes a sequence of situations that invite different solutions. A wide opponent teaches selective commitment. A growth opponent teaches disruption or pressure. A freeze encounter teaches cleansing, protection where applicable, or playing elsewhere. A boss tests whether the player can recognize and revise a weak plan.

Before an encounter, describe the opponent's behavior. After a loss, identify one supported observation: “You had three cards left that cost more Motion than you could spend on the final turn.” Only display this if the recorded match establishes it. Offer an owned replacement and a free retry. Avoid unexplained deck scores or claims that one list is optimal.

Award a second meaningful deck-building moment by match five: build a second saved deck around a different favorite card, or duplicate the first and change two slots. Keep this as a rewarded challenge, not a requirement to abandon a successful deck. All current four deck slots should remain available from the beginning.

A chapter boss should accept multiple approaches. Mandatory progression rewards must not depend on perfect three-star clears. Additional stars can reward cosmetics or optional currency; the ordinary clear should provide the promised progression. Current objectives such as holding all three districts and winning without SQUABBLE can remain optional mastery goals, with clear separation from normal winning strategy.

### Midgame: deliberate specialization and counterplay

**Target: roughly matches 10–30; reaching this stage depends on demonstrated familiarity, not calendar attendance.**

The player can now state a deck's plan in one sentence and identify an unfavorable matchup. The primary loop becomes building a second approach, testing a counter card, and returning to a difficult encounter with a revised list.

Add a practice selector for recognizable opponent behaviors: spreading across districts, concentrating Power, interrupting abilities, and moving late. Use the existing seven lists as fixtures behind those opponents. Let the player retry the same scenario after a change; a controlled comparison is more useful than a vague win-rate number from two unrelated matches.

Introduce deck notes, copy-and-edit, comparison with the previous saved version, and optional community import when sharing infrastructure exists. Imported decks should identify missing cards and offer owned substitutions. Copying someone else's deck is legitimate player choice; success should not be defined as universal originality.

Story encounters can add one new complication at a time. Reuse the existing encounter modifiers and teaching metadata before inventing new card categories. Optional challenges can restrict the available pool or ask for a particular kind of interaction, but the default constructed game keeps cross-crew mixing open.

### Late game: mastery, adaptation, and expression

**Target: sustained repeat play after the player has a broad collection.** With only 25 current cards, this stage cannot depend on months of withholding basic gameplay access.

The repeatable offer should have three paths. First, a solo challenge circuit rotates combinations of existing opponent behaviors and encounter rules, with comparable baseline card strength. Second, collection-independent draft experiments let players solve a fresh construction problem with a temporary pool. Third, eventual competitive play lets players test custom decks against people under a common ruleset.

Mastery rewards include cover art, card finishes, titles, and documented challenge achievements. Reward thoughtful use of a favorite card and breadth across multiple decks. Avoid late-game mandatory missions that force everyone onto a featured recipe.

Ranked play requires matchmaking, authoritative two-player state, reconnects, timers, disconnect policy, outcome validation, and sufficient population. Until those are shipped and verified, the roadmap should expose a solo challenge circuit rather than a misleading competitive rank. Draft can initially be a small CPU prototype; a parallel live queue would be premature.

## Collection and rewards

### A concrete proposal for the current 25-card catalog

Adopt a common foundation entitlement for new accounts: the ten already-granted City Never Sleeps cards plus seven core cards. A candidate core is Cornball, Plug, Snow Bunny, Wifey, Hooper, Rastamon, and All Jokes Roaster. This candidate uses existing cards and requires balance validation; it is not a new collectible named deck. The editor can offer a temporary playable arrangement that the first lesson immediately makes editable.

This produces 17 unique owned cards at the first construction lesson. Reveal a manageable subset in the lesson, with all owned cards available through the full collection. Do not remove the expansion grant or take cards away from existing players to manufacture scarcity. The existing grant includes OG Uncle, so a legendary-first-unlock marketing beat would misrepresent current entitlement.

| Milestone | Guaranteed choice opportunity | Minimum ownership under the proposal |
|---|---|---|
| First construction lesson | Use any of the 17 foundation cards; no pack luck required for a swap. | 17 |
| Two completed non-tutorial matches | Choose two distinct missing cards. | 19 |
| Five completed non-tutorial matches | Choose two more missing cards. | 21 |
| Ten completed non-tutorial matches | Choose two more missing cards. | 23 |
| Twenty completed non-tutorial matches | Choose the final two if still missing. | 25 |

These are cumulative one-time milestones, not four separate daily chores. Packs and story rewards can accelerate ownership, so actual completion can occur sooner. If only one card remains at a two-card milestone, grant that card plus a clearly disclosed cosmetic fallback; if none remain, grant the fallback for both choices. Never require buying a pack to advance this track.

This generous baseline is intentional for the small current catalog. If testing shows that players exhaust meaningful combinations quickly, the answer is better interactions, challenges, and eventually additional cards. Stretching eight missing cards over months would undermine the construction promise.

Keep the existing soft currency and pack tickets. Choice rewards should be stored as pending claims, not introduced as another wallet with an exchange rate. A card's detail page should show its exact available source and the next guaranteed choice milestone. For a future larger catalog, introduce a reliable recurring targeted claim with a visible completion requirement, then model acquisition relative to release cadence before pricing anything.

Rebuild Collection Road around milestones that remain meaningful after a 17-card start. Preserve historical claim records and earned rewards. Separate collection completion from the building challenges, so a player who already owns everything can still complete the learning journey without receiving duplicate onboarding gates.

The displayed pack odds and actual selection logic need a reconciliation pass during implementation: the current missing-card filter spans the catalog, and rarity fallback can select from the remaining pool. A displayed zero rarity weight is not necessarily a categorical exclusion in that fallback. Avoid promising a rarity can never appear without testing the final eligibility rules.

### Card mastery must support switching

The current upgrades are real combat effects. Keeping that progression unchanged everywhere would reward repeatedly using an established deck and make newly acquired cards harder to evaluate.

Recommended policy: use base card abilities at equal strength in the learning lab, standardized challenge circuit, and future ranked format. Preserve earned upgrades in story mode, where character growth is part of the experience. Clearly identify the active rules on each mode and in the card inspector. Snapshot the mode's upgrade policy when a match starts so the result does not depend on later profile changes.

A future story catch-up mechanism could bring newly acquired cards toward account progression through a short quest. Test whether it is necessary before adding it. Do not erase earned XP, and do not quietly treat cosmetic variants as extra gameplay copies.

## Deck builder and navigation requirements

The home screen should foreground the selected saved deck, “Edit deck,” and the next useful match or learning objective. New card results should offer “Try in a deck.” The deck page should lead with the player's decks and creation tools; examples belong behind an optional learning entry.

| Builder element | Required behavior |
|---|---|
| Seven slots | Every slot is editable. A full deck supports replace-in-place and undo. |
| Collection search | Search names and ability text; filter by cost, role, ownership, and type. Lore faction is descriptive. |
| Opening-hand preview | Show the first five and later draws under the current deterministic rules. Permit explicit reorder. |
| Cost guidance | Explain the distribution and flag a lack of affordable opening plays without enforcing a recipe. |
| Interaction hints | Explain a specific compatible interaction and its condition. Show tradeoffs when swapping. |
| Cover character | Cosmetic identity selected by the player; do not imply a new leader restriction. |
| Save behavior | Preserve incomplete drafts, but prevent queueing an illegal list with a specific corrective message. |
| Test behavior | Launch a free practice match with the saved revision, then return to that deck. |
| Missing cards | Allow planning with clearly marked unowned cards; require ownership for ordinary constructed play. |

A conceptual seven-slot teaching aid can suggest an early play, an enabler, a payoff, support, interaction, and two flexible selections. These are explanations, never deck legality requirements. Cards can fill several roles and players can intentionally ignore the pattern.

Do not add a single authoritative “synergy score.” Such a score would encode the current assumptions about approved combinations and could hide creative discoveries. Prefer concrete statements such as an ability needing another friendly target or a discount requiring a different district.

## Balance without prescribed decks

Maintain the seven existing benchmarks as regression fixtures. Extend evaluation with one-card and two-card substitutions, cross-crew hybrids, extreme cost distributions, and adversarial combinations. Test at the same upgrade policy first; otherwise card investment and deck quality become confounded.

For the 25-card pool there are 480,700 unordered seven-card combinations, calculated as 25 choose 7. That number is not a claim about viable decks. It excludes ordering, player decisions, opponents, and progression states; under the current deterministic draw order, order also matters. Broad sampling and targeted searches are more practical than assuming seven mirror matchups prove the full game is balanced.

Inspect whether a card is generically dominant or strong only in a particular interaction. Evaluate district outcomes, available counterplay, cost, sequencing, and matchup spread. A strong tournament deck is not itself a problem; a mandatory package appearing in nearly every successful deck is a stronger warning.

Require new cards to offer plausible uses in more than one configuration and to have observable counterplay. Validate those uses in playtests rather than assigning a faction tag and assuming variety follows. More printed cards do not automatically create more decisions.

## Delivery roadmap

The ordering below is dependency based. Durations should be estimated after content and engineering scope are agreed; this is not a calendar commitment.

| Phase | Deliverable | Exit condition |
|---|---|---|
| 1. Foundation | Unify grants; separate examples from saved decks in presentation; expose draw order; make swaps preserve slots. | A new and a returning account can save and play a mixed deck without losing ownership or progress. |
| 2. First-session slice | Guided match → editable deck → explained swap → practice test → Chapter One. | Observed beginners complete the loop and can explain what their change was intended to do. |
| 3. Progression | Choice claims, revised Collection Road, source hints, ordinary-clear rewards, and consistent mode upgrade policy. | A no-spend account can reach the published milestones without a specific random reward or perfect clear. |
| 4. Midgame depth | Behavior-based practice opponents, second-deck challenge, revision comparison, varied story problems. | Players make useful revisions across multiple opponents without being told the complete answer. |
| 5. Solo endgame | Standardized challenge circuit, cosmetic mastery, small collection-independent draft prototype. | Repeat play remains interesting after collection completion; no extra live queue is required. |
| 6. Multiplayer | Private battles, then competitive matchmaking and seasonal rewards when infrastructure and population support it. | Complete two-player flows and fairness rules pass reliability and playtest gates. |

The first implementation should be phases 1 and 2 as one vertical slice. That tests the core promise with minimal new content. Do not begin by creating seven longer unlock tracks or a large expansion.

### Implementation appendix

| Local source | Planned work |
|---|---|
| [Onboarding.tsx](E:/Apps/code/minimax/Squabblemon/artifacts/squabblemon/src/pages/game/Onboarding.tsx) | Replace permanent crew selection with editable ownership and the first swap lesson. |
| [Decks.tsx](E:/Apps/code/minimax/Squabblemon/artifacts/squabblemon/src/pages/game/Decks.tsx), [DeckEditor.tsx](E:/Apps/code/minimax/Squabblemon/artifacts/squabblemon/src/pages/game/DeckEditor.tsx) | Promote custom lists, preserve replacement position, add explanations and direct testing. |
| [data.ts](E:/Apps/code/minimax/Squabblemon/lib/squabblemon-engine/src/data.ts) | Retain benchmarks and unrestricted legality; add deliberate role metadata independent of recipe membership. |
| [gameEngine.ts](E:/Apps/code/minimax/Squabblemon/lib/squabblemon-engine/src/gameEngine.ts) | Preserve and document draw semantics in the first slice; apply explicit mode rules to upgrade snapshots later. |
| [player.ts](E:/Apps/code/minimax/Squabblemon/artifacts/api-server/src/routes/player.ts), [playerState.ts](E:/Apps/code/minimax/Squabblemon/artifacts/api-server/src/lib/playerState.ts) | Version onboarding, unify ownership grants, persist the selected custom deck and resumable checkpoints. |
| [collectionEconomy.ts](E:/Apps/code/minimax/Squabblemon/artifacts/api-server/src/lib/collectionEconomy.ts), [collectionTransactions.ts](E:/Apps/code/minimax/Squabblemon/artifacts/api-server/src/lib/collectionTransactions.ts) | Define targeted claims, duplicate handling, truthful odds, and a revised road. |
| [story.ts](E:/Apps/code/minimax/Squabblemon/lib/squabblemon-engine/src/story.ts) | Connect existing encounter teaching to construction problems; separate optional mastery from ordinary progression. |
| [abilityUpgrades.ts](E:/Apps/code/minimax/Squabblemon/lib/squabblemon-engine/src/abilityUpgrades.ts) | Keep earned story growth and standardize explicitly selected practice/competitive modes. |
| [openapi.yaml](E:/Apps/code/minimax/Squabblemon/lib/api-spec/openapi.yaml), [playerProfiles.ts](E:/Apps/code/minimax/Squabblemon/lib/db/src/schema/playerProfiles.ts) | Add versioned checkpoints and reward claims, then regenerate clients from the contract. |

Preserve existing saved decks, cosmetics, card ownership, and claimed rewards in migration. Existing accounts receive missing foundation cards through a union grant and can optionally take the new lesson. They should not repeat account setup. Legacy recipe IDs remain valid for opponents and saved-deck provenance; they must not become mandatory deck identities.

## Validation and release decisions

Start with 8–12 observed novice sessions spanning card-game experience, followed by a broader cohort if the first flow is understandable. This small round finds usability failures; it cannot establish retention impact statistically.

Provisional usability targets are: most participants finish the first guided match unaided; at least 8 of 10 can save and test a changed deck; at least 7 of 10 can explain the tradeoff they made. Treat misses as evidence to revise the lesson. Track median time to first deliberate edit, rather than rewarding speed at the expense of comprehension.

Instrument tutorial start and completion, collection grant, editor open, card replacement, deck save, test start, test completion, targeted claim, and second-deck creation. Associate match results with the saved deck revision and active upgrade policy. Measure voluntary later edits separately from the required lesson, since a forced swap is weak evidence of player ownership.

For a larger launch, compare first-session completion, return rate, voluntary editing, use of newly earned cards, and loss-to-rematch behavior against the existing journey. Examine novice and experienced cohorts separately. No baseline or sample size calculation exists yet, so avoid advertising an expected uplift.

Required functional checks include interrupted onboarding resume, duplicate reward requests, no-loss entitlement migration, unknown and unowned card rejection at match start, incomplete draft recovery, replacement order, chosen-cover validity, exhausted choice pools, and upgrade-policy snapshots. Also test the complete beginner flow using a fresh account and the preservation path using an existing account.

The go/no-go question for additional progression content is whether players can explain and enjoy improving their own deck. The proposed first release should demonstrate that before the team invests in a larger economy or competitive ladder.

## Sources

[^1]: Second Dinner. [Patch Notes: November 18, 2025](https://marvelsnap.com/patch-notes-november-18-2025/). November 18, 2025. New-player prebuilt deck rewards and calendar.
[^2]: Second Dinner. [Patch Notes: May 19th, 2026](https://marvelsnap.com/patch-notes-may-19th-2026/). May 19, 2026. Synergy tutorial, acquisition prompts, starter support, and timer changes.
[^3]: Second Dinner. [New Cards and How to Get 'Em](https://marvelsnap.com/new-cards-and-how-to-get-em/). Historical Token Shop introduction; publication date not displayed in the retrieved page. Used for the explicitly stated missing-key-card problem, not present-day pricing.
[^4]: Second Dinner. [Patch Notes – April 29, 2025](https://marvelsnap.com/patch-notes-april-29-2025/). April 29, 2025. Snap Packs launch and unowned-card guarantee.
[^5]: MARVEL SNAP Help Center. [Limited Time Game Mode: MARVEL SNAP Draft](https://marvelsnap.helpshift.com/hc/en/3-marvel-snap/faq/657-limited-time-game-mode-marvel-snap-draft/). August–September 2026 event; accessed September 8, 2026. Collection-independent construction and event scope.
[^6]: Bandai. [Naruto CCG Rulebook](https://paperzz.com/doc/8703931/naruto-ccg-rulebook), archived third-party transcription, especially printed pages 9–10 and 37–38. Exact edition/publication date unverified. Early 40-card rules are used only as a historical design reference.
[^7]: Bandai. [About Naruto Card Game](https://www.naruto-cardgame.com/en/welcome/). Undated official introduction, accessed September 8, 2026. Separate contemporary Leader/color framework.
[^8]: Clayton Kroh / Wizards of the Coast. [Jump In! Packets Update for March of the Machine](https://magic.wizards.com/en/news/mtg-arena/jump-in-packets-update-for-march-of-the-machine). April 17, 2023. Guided compatible packet selection.
[^9]: Squabblemon local working tree, inspected September 8, 2026. Primary files are linked in the implementation appendix; additional evidence: [cardProgression.ts](E:/Apps/code/minimax/Squabblemon/lib/squabblemon-engine/src/cardProgression.ts) and [deck-meta.ts](E:/Apps/code/minimax/Squabblemon/artifacts/squabblemon/src/lib/deck-meta.ts). Implementation inspection only; no runtime behavior or balance claims were validated by executing the game for this planning report.
