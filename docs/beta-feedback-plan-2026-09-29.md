# Beta feedback intake and fix plan

Date: 2026-09-29  
Scope: feedback intake and planning only; no gameplay changes or release in this pass.

## Sources and evidence limits

- [Beta tester Google Doc: Squabble Today Thoughts](https://docs.google.com/document/d/1LVW8PfQBdNMxldqkbYQK9sI-avMBY-x2nGq_Jn0Qj4w/edit?tab=t.0). Read the complete two-page export, including the Landlord card and final-board screenshots.
- Additional laptop UX/UI and Guided Play notes supplied in chat.
- Current source at `ec51767f`, including the preceding release and deck-picker changes. The latest commit fixes Netlify's audio verification environment; it does not itself resolve these UX reports.
- This was a read-only source/history audit, not a fresh live onboarding reproduction or performance measurement. “Already present” below means a capability exists in code, not that the tester's issue is verified fixed.

Preserve what testers liked: the illustrated world, sound and visual presentation, the less-cluttered laptop experience, and Inspect final board. Improve teaching and control without replacing the game's visual identity.

## Consolidated intake

Paths in this table are relative to `artifacts/squabblemon/src/` unless they start with `lib/`.

| ID | Feedback | Current evidence / status | Planned response |
| --- | --- | --- | --- |
| B01 | “Choose a new recruit” calls the top number Motion cost, but the card has two numbers. | **Partly addressed, still ambiguous.** Current `components/DeckWorkbench.tsx` names Motion cost and Base Hands. The older “number at the top” wording remains in `lib/tutorialVoiceClips.json` and the matching logic in `lib/tutorialVoice.ts`. The supplied Landlord screenshot shows yellow upper-left 2 and white upper-right 3. | Explicitly identify **upper-left Motion cost** and **upper-right Base Hands**, with labels/targets rather than color alone. Audit active captions and spoken cue IDs together; remove ambiguity from both, and regenerate affected narration where needed. |
| B02 | Remove the timer from the first story battles, possibly the whole beginner chapter. | **Partial coverage only.** `pages/game/GuidedFirstSession.tsx` and `FirstDeckWorkshop.tsx` already disable timers. `pages/game/PlayerDeckPlay.tsx` passes the saved timer preference into story, and `components/PlayLoop.tsx` only automatically exempts tutorial mode. | Recommend all Chapter One story battles be untimed. Derive this from authored chapter/node identity at the story-play boundary; do not overwrite the saved preference or change round limits. Later chapters and other modes retain their existing policy. |
| B03 | Inspect board is useful, but the large white “FINAL DISTRICTS” heading obstructs it. | **Open; screenshot supplied.** `components/PlayLoop.tsx` retains this phase message at match completion and renders Battle again for final-board review. | Suppress the oversized broadcast during final-board inspection. Keep a compact accessible “Match complete” status and the return-to-results control; preserve district scores and card inspection. |
| B04 | Let players inspect their crew/deck before starting. | **Partial coverage only.** `components/Lobby.tsx` already supports card inspection. `components/StoryCrewSelect.tsx` shows a dossier and ten card names/images without equivalent per-card inspection. | Add a discoverable crew summary and card-detail action to story selection, reusing `CardInspector`. Preserve the selected crew, scroll position and focus when closing details. |
| B05 | Laptop is much better and less cluttered than phone, but still slow. | **Open; cause needs measurement.** Existing optimizations are documented in `../PERFORMANCE.md`, but the recorded throttled crowded-battle results still miss the existing budget. Those measurements are historical, not a fresh measurement of this release. | Feed the existing crowded-battle performance work. Separately measure startup/network waits, Safehouse idle/render cost, and battle frame stalls on laptop and phone. Do not “fix” slowness by shortening reading time. |
| B06 | Four quick items duplicate the Express menu. | **Source duplication found; visual identity still to confirm.** `components/venue/GameNav.tsx` renders four Home fan shortcuts: The streets, Cards & gangs, Fight, Shop. Express contains the same destinations. These are separate from the eleven illustrated room stations. | Confirm the tester means these four controls. Recommended simplification: retain Express and the room stations, remove the duplicate Home shortcut rail. Preserve all destinations and onboarding target reachability. |
| B07 | Clicking outside a popup should close it, as with Event Board. | **Inconsistent.** Event Board and Express implement backdrop dismissal. Mail/Growth need their own audit. Home's station detail is an ordinary section, not a modal, and has no outside-dismiss behavior. | Adopt a consistent close-button / Escape / backdrop contract for dismissible informational overlays. For retained scene panels, use a deliberately scoped outside-dismiss region, not a blanket page click handler. Preserve focus, internal clicks and guarded/transactional confirmations. |
| B08 | Remove unnecessary intermediary area screens. | **Open.** `pages/game/Home.tsx` generally selects a station detail first, then requires a second action to open its destination. | Direct-open destinations that have one clear action. Keep intermediate panels only where there is a meaningful choice or information that must be acknowledged. Update guided-tour targets, deep links, scene return and focus restoration together. |
| B09 | Back and Safehouse both return to the same place; place Safehouse at top center. | **Open.** `components/venue/CityHeader.tsx` renders Back and a Safehouse key outside Home. Some routes legitimately have a different contextual Back destination. | Use one prominent centered Safehouse return on area screens. Show a separate Back only when it returns somewhere different. Respect safe areas, short screens, unsaved-change guards and battle-exit confirmation. |
| B10 | After playing The Plug, its popup portrait covers some text. | **Reproduce first; not verified fixed.** Possible owners are the mechanic lesson, coach panel and effect/cinematic layers in `components/Battle.tsx` and `CoachSpotlight.tsx`. Existing target tracking is not proof of text/portrait separation. | Trigger the exact first-seen Plug effect on fresh onboarding state, identify the popup, then separate portrait/text layout and constrain decorative bounds. All text and the dismissal action must remain readable and reachable. |
| B11 | CPU Cornball text at the top disappears before it can be read. | **Reproduce first; no specific dwell proof.** Shared engine effect notes feed battle callouts/history. A first-mechanic dialog and a transient event announcement have different lifecycles. | Reproduce the actual Cornball event rather than assuming a particular effect. First-time Guided Play explanations should wait for acknowledgment; ordinary event notes need a readable dwell/queue and a persistent recap. Do not overwrite active narration with the next event. |
| B12 | Round 2/4 “Take VIP Section” diagrams do not explain the action. | **Open.** `CoachSpotlight.tsx` uses generic diagrams. `lib/squabblemon-engine/src/rookie.ts` supplies the deterministic Bodega / The Trap / VIP Section board. | Replace generic lesson diagrams with the relevant real board state: the actual lane, selected card, current/projected scores, applicable rule, and the intended action. If a diagram adds no information beyond the highlight, remove it rather than adding clutter. |
| B13 | VIP Section says printed cost 4 without naming the resource. | **Confirmed copy gap.** `lib/squabblemon-engine/src/districts.ts` says “printed cost of 4 or more”; the rule is +2 Hands at printed cost **4 or more**, not exactly 4. | Use “Cards with a printed Motion cost of 4 or more gain +2 Hands here.” Explain that printed means the base card cost before discounts; preserve the existing frozen-card/scoring behavior. Share wording across district details, coaching and diagrams. |
| B14 | “Commit the play” refers to a preview, but Focus highlights Play. | **Confirmed target mismatch.** `components/tutorialGuidance.ts` targets `button-lock`; `battlePreview.ts` already computes visible, known outcomes. | Give the visible preview a stable target and focus it when explaining predictions. Highlight Play only when explaining commitment. If preview is unavailable, change both target and copy coherently; never leave a blocking mask without an actionable fallback. |
| B15 | It is hard to follow the board when it is not the player's turn. | **Partially supported, not proven readable.** Staged reveal/effect phases and history already exist; source alone cannot show whether the tester could read them. | Make actor → card → effect → changed district score clear in sequence, keep the current phase visible, and retain a reviewable recap. Guided first occurrences can pause; do not impose arbitrary acknowledgment pauses on competitive matches. |
| B16 | The screen advances to Lesson Complete while the player is still reading stats. | **Reproduce first; two different completion flows.** `GuidedFirstSession` switches to its handoff via `onTutorialComplete`. `FirstDeckWorkshop` renders “LESSON COMPLETE” after leaving practice or restoring a saved tested state. The final match-finish beat and server/bootstrap updates also need tracing. | Separate server finalization from UI navigation. Keep result stats/final-board/card inspection available until explicit Continue/Exit, even after a late response or bootstrap refresh. Do not move reward writes behind an indefinitely open modal or grant rewards twice. |
| B17 | Lesson Complete cannot scroll. | **Reproduce in the real shell.** ResultScreen has a scroll owner, but `.rookie-review` in `styles/deck-workshop.css` only declares a minimum viewport height. That does not establish reachability inside its actual constrained parent. | Give review/handoff screens one usable vertical scroll owner. Keep the primary continuation action reachable on short screens, with expanded reward details and large text. Test wheel, touch and keyboard—not only automation's auto-scroll. |
| B18 | Combat/draw/standby phases are unclear. | **Teaching/discoverability gap.** Actual presentation phases cover round intro, player input, reveal, effects, round result and match finish. This is not a request to add a different game's standby/draw phase system. | Add a persistent plain-language status mapped to real state: Your turn, Your play resolves, Rival's play resolves, Effects resolve, Round result, Match complete. Explain when cards draw and when input is available without inventing phases. |
| B19 | Explain cards, elemental interactions and special abilities. | **Reference exists, discoverability incomplete.** CardInspector, Rules/Field Manual and the Field Guide exist. The shared engine also has real elemental matchup bonuses and in-hand elemental-bond effects. | Reuse one authoritative reference from crew selection, card details and battle. Explain Motion, Base/current Hands, abilities, reveal/ongoing timing, statuses, elements/bonds, SQUABBLE and district scoring with actual examples. Distinguish targeted elemental effects from universal damage multipliers; do not invent mechanics or let guide copy drift from the engine. |

## Recommended work order

### 1. Make learning screens readable and player-controlled

Covers B03, B10, B11, B15, B16, B17, B18.

- First reproduce fresh Guided Play and the separate saved-crew practice/review path. Record which screen, card/event and callback is involved instead of treating every “popup” or “lesson” as the same component.
- Fix portrait overlap and review/handoff scrolling.
- Hold first-time mechanic explanations until acknowledged. Reduced motion may simplify animation, but must not reduce reading time.
- Make result-to-handoff navigation explicit, keep board/card inspection stable, and preserve exactly-once server completion/rewards.
- Add persistent phase/actor context and remove the obstructing final-board headline.

Primary owners: `components/PlayLoop.tsx`, `Battle.tsx`, `BattleReadability.tsx`, `CoachSpotlight.tsx`, `ResultScreen.tsx`, `pages/game/GuidedFirstSession.tsx`, `FirstDeckWorkshop.tsx`, result/battle/coach/deck-workshop styles.

### 2. Correct teaching targets, diagrams and language

Covers B01, B12, B13, B14 and the core explanations in B19.

- Teach both printed card numbers with explicit positions and names.
- Correct VIP's Motion unit and preserve its 4-or-more threshold and discount semantics.
- Anchor the preview explanation to the actual visible preview; retain its known-information-only contract.
- Use the real rookie board for Round 2/4 guidance, not decorative generic diagrams.
- Keep captions, cue lookup, recorded speech, durations/revisions and both Ogg/AAC exports consistent. A text-only fix is incomplete if the voice still teaches the old line. Validate changed audio by full local decoding before updating the deploy checksum.

Primary owners: `components/tutorialGuidance.ts`, `CoachSpotlight.tsx`, `DeckWorkbench.tsx`, `battlePreview.ts`, `lib/tutorialVoice.ts`, `tutorialVoiceClips.json`, shared engine district content, voice assets/reference metadata.

Depends on the interaction/readability contract from step 1; these areas share components, so avoid concurrent incompatible edits.

### 3. Make Chapter One and crew selection safe places to learn

Covers B02, B04, and the entry points for B19.

- Recommend an untimed Chapter One, preserving saved timer preferences for later play.
- Add selected-crew composition/plan and inspectable cards to the story selector.
- Make the same card/mechanic reference easy to open before and during a match; restore selection and focus after closing it.
- Teach the engine's real elemental bonus/bond behavior without changing balance, card stats, progression or district rules.

Primary owners: `pages/game/PlayerDeckPlay.tsx`, `components/StoryCrewSelect.tsx`, `CardInspector.tsx`, shared rule/help components and authored chapter identity.

Coordinate selector changes with the existing **Add story deck edit link and polish fight action** proposal. An edit-deck shortcut does not by itself satisfy the request to inspect card/crew details; share the screen work without duplicating or dropping either behavior.

### 4. Simplify Safehouse navigation without losing the world

Covers B06, B07, B08, B09.

- Inventory visible controls at laptop and phone sizes and verify the tester's four shortcuts.
- Keep Express as the consistent global shortcut menu; remove the duplicate four-item Home fan surface if confirmed. Preserve all eleven world stations and their destinations.
- Bypass single-action intermediary panels; keep meaningful choices.
- Standardize informational overlay dismissal, return placement and focus recovery.
- Center the Safehouse return; retain contextual Back only when it has a genuinely different destination.

Primary owners: `pages/game/Home.tsx`, `components/venue/GameNav.tsx`, `CityHeader.tsx`, `SafehouseMail.tsx`, `SafehouseBulletinBoard.tsx`, `AccountRewards`, related navigation/scene styles.

This can be implemented separately from battle teaching, but it must preserve the Home onboarding tour and guarded route behavior. Do not delete room markers simply because their destinations also appear in Express.

### Parallel investigation: performance

Covers B05 and feeds **Get crowded battles under the performance budget on slow phones**, rather than creating a duplicate.

1. Separate real cold-start/auth/API delays, route/Safehouse loading and idle rendering, and crowded-battle frame stalls.
2. Use the existing optimized battle harness, real presentation lifecycle, fixed board, and fixed thresholds. Run paired standard/reduced-motion and CSS-fallback comparisons on the same runner; report variance and nonzero profiler values.
3. Use the existing navigation harness as synthetic evidence only; its API stubs do not establish real network performance.
4. Fix an attributed hotspot, not a guessed one. Preserve readable dwell, authoritative event sequencing, visual identity and input responsiveness.
5. Keep physical-phone verification under the existing hardware-validation work. Reconcile the existing performance task's waiting-for-input state before scheduling dependent implementation; this audit did not establish the missing input.

Existing recorded battle budget failures must not be relabeled as resolved, or “fixed” by raising thresholds. Freeze source during each complete verification run.

## Acceptance and release gates

### Coverage matrix

- Laptop: 1366×768 and a taller desktop viewport.
- Mobile: 320px and 390px widths; short/landscape viewport; safe areas; touch and keyboard input.
- Default and reduced motion; fresh onboarding and resumed/saved onboarding.
- Real route shells, not only isolated component snapshots.

### Required journeys

1. Complete recruit selection and the guided fight using visible controls. Identify both printed stats correctly; confirm both captions and narration.
2. Trigger the actual reported Plug and CPU Cornball states. Inspect screenshots for text/portrait bounds and use timers/narration completion assertions for event readability.
3. At Round 2 and Round 4, verify VIP's actual rule and visible preview against the engine. Confirm the spotlight highlights the described element, including a missing/late/moved-target case, and the final Play action remains clickable.
4. At match end, open stats, Inspect final board and card details; wait beyond existing animation/completion delays and refresh background account data. Nothing should replace the active review until the player chooses to continue.
5. Reach the final lesson action after expanding reward details. Prove real wheel/touch/keyboard scrolling works and the full final item fits between fixed controls.
6. Enter every Chapter One battle with the saved timer setting on: no countdown or forced timeout. Later modes still honor that preference. Keep authored round limits.
7. Inspect all selected-crew cards before starting; close details without losing crew/scroll/focus. Open the reference from selection and battle.
8. Open and dismiss every informational room overlay by each supported method; internal clicks must not dismiss it. Test direct/deep-link entry, return focus, scene fallback, and guarded exits.
9. Verify each remaining navigation destination is reachable without a redundant step. Retain meaningful contextual Back behavior.
10. Run the existing battle/navigation performance gates with their actual requirements and report any remaining failure honestly.

### Existing coverage to extend, not treat as current pass evidence

- `e2e/rookie-road.spec.ts`, rookie journey fixtures and `e2e/verify-tutorial-voice.mjs`.
- `src/components/tutorialGuidance.test.ts`, `src/battlePreview.test.ts`, `src/components/Battle.test.tsx`, presentation timeline tests.
- `e2e/result-overlay-regression.spec.ts` and `e2e/verify-result-reopen.mjs`.
- Events journey/keyboard suites and navigation-memory coverage.
- `e2e/verify-safehouse.mjs` currently contains a five-marker expectation while Home defines eleven stations. Reconcile that stale expectation before using it as proof; do not remove live stations to satisfy it.
- `scripts/battle-performance.mjs`, `scripts/profile-navigation.mjs`, and `PERFORMANCE.md`.

Extend the existing card-detail consistency, resource-naming and physical-phone timing work where these checks overlap. No new project tasks were created during this intake.

## Completion rule

Each intake item remains open until its acceptance case passes on the current implementation. An existing feature, a recent commit, a passing build, or an old screenshot is not sufficient evidence that the reported experience is fixed.

Recommended first implementation slice: step 1—readable Guided Play, stable results review and reachable lesson controls—then steps 2–3. Navigation can follow independently; performance measurement should begin alongside the first slice.