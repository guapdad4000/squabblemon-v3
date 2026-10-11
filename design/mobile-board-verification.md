# Mobile card-board verification

Verified October 10, 2026 against clean base `235bdc1f5c922835ec87aa751cb6760e521c957d` in the managed mobile-battle-design worktree. The primary and older art-cutout worktrees were left untouched. Release validation was refreshed October 11, 2026 before publication.

Preview: http://127.0.0.1:4232/e2e/battle-mobile.fixture.html?locations=bodega,pirate-radio,construction-site

Police preview: http://127.0.0.1:4232/e2e/boss-raid.fixture.html?demo=1&tier=1

## Browser checks

Measurements below are the actual document CSS viewport sizes. The in-app browser was zoomed to 80%; requested capture viewport dimensions were compensated and verified against `innerWidth` / `innerHeight`. Temporary viewport overrides were reset after verification.

| Surface | Viewport | Verified behavior |
| --- | --- | --- |
| Battle | 320 × 567 | Primary action fits; first crowded row remains complete at 44 × 55; deliberate scroll and View controls expose the remaining crew. Charged Mary with 107 Hands and four statuses shows its charge, first effect and +3 summary. |
| Battle | 390 × 843 | 2-column formations; live Hands at least 18 px; selected lane outlined. Selecting Barber Bro then Pirate Radio leaves field y=83.984375 and height=506.5625 exactly unchanged. |
| Battle | 430 × 932 | Normal and six-card formations remain contained. |
| Battle | 767 × 1023 | Tablet portrait keeps separate opponent/player formations and full canonical inspection. |
| Battle | 1023 × 767 | One row for normal landscape formations; exactly three cards do not overlap; card faces approximately 74 × 92 and Hands approximately 20.7 px. |
| Battle | 843 × 390 | Hand and actions dock beside the field. Field uses the remaining width. Primary action stays inside viewport. |
| Battle | 1440 × 900 | Four-card rows approximately 102 × 127; Hands 24 px. Bottom timer, hand and action remain visible. |
| Police raid | 390 × 843 | Board extends beneath the hand; crowded crew has explicit View 5 control. Full cards and normal inspector remain available. |
| Police raid | 1023 × 767 | Card selection, lane selection, native deployment, and inspection work. The Feds inspector uses `/assets/boss-raid/feds.webp`. |
| Police raid | 843 × 390 | Side hand dock, readable cards and reachable action. Field scrolls vertically when the whole formation cannot fit; no horizontal document overflow. |
| Police raid | 1440 × 900 | Contained NPC/player artwork; hand names wrap at about 13.2 px instead of clipping horizontally. Selected gold inset overrides the weaker legal-target style. |

The normal district popup still opens from the district name with artwork and full rules. Standard crowded formation inspection presents both sides as full cards. The police View 5 dialog presents five full cards and no combat tiles; selecting a card opens the canonical inspector and closing restores focus to the formation control. Normal player and police card details remain intact.

Ice/status materials are now below the authoritative live numbers and card name. Multiple status icons use a bounded first-icon-plus-count presentation; all effect names, itemized modifiers and form-charge thresholds remain in accessible labels and normal inspection. Artwork remains contained rather than cropped to fill the new 4:5 combat frame. The canonical full card remains 63:88.

## Automated checks

- Frontend TypeScript passes after building workspace library declarations.
- `Battle.test.tsx`: **70/70 pass**, including the new authoritative-number, charged-form, multi-status-summary, canonical-inspection and hand-preservation test.
- Production Vite build passes; bundle checks pass: public entry **212.5 / 475 KiB**, GameApp static JS **876.4 / 900 KiB**, Home static JS **950.1 / 1200 KiB**.
- `git diff --check` passes.
- Broader battle regression: **245 pass / 23 fail**. Separate BossRaid tests: **13 pass / 1 fail**. All 24 failure names and complete assertion bodies match archived base `235bdc1f` exactly, with no missing, extra or changed failures. See [baseline comparison](mobile-board-proof/baseline-comparison.json). The old Battle component tests on that base pass 69/69.

## Captures

- [Selected phone board](mobile-board-proof/phone.jpg)
- [Tablet landscape](mobile-board-proof/ipad-landscape.jpg)
- [Desktop](mobile-board-proof/desktop.jpg)
- [Minimum-phone charge/status stress](mobile-board-proof/status-stress.jpg)
- [Police phone](mobile-board-proof/raid-phone.jpg)
- [Police short landscape](mobile-board-proof/raid-short-landscape.jpg)
- [Police desktop](mobile-board-proof/raid-desktop.jpg)

## Boundaries

This pass changes presentation, not game rules, card balance, tier HP, rewards, or population limits. Competitor evidence is documented in [the research report](mobile-card-board-research.md); exact live competitor gesture timing was not measured. No before/after frame-time or CPU-throttled long-task measurement was made, and no performance-budget win is claimed. Physical iPad/touch-device verification and a full measured contrast audit remain outside these browser checks. Old transient Vite reload warnings appeared during edits; the final production compilation and populated preview checks succeeded.


## Location artwork follow-up

Removed the rectangular title/target gradients and live-preview/character-mark backdrops. Legal and selected target states remain transparent, and the location shade overlay is disabled; localized text shadows keep the information readable. Full-lane selection outlines, fixed hub geometry, and the district explainer remain intact.

Verified populated desktop (1440×900), phone (390×843), and tablet landscape (1023×767) previews. Computed title/target/marker backgrounds are transparent, the selected lane keeps its gold outline, and Pirate Radio's normal location explainer opens and closes. This CSS-only correction passes `git diff --check`; the prior automated results above were not rerun for it.

- [Desktop with uncovered location art](mobile-board-proof/location-text-only-desktop.jpg)
- [Phone with uncovered location art](mobile-board-proof/location-text-only-phone.jpg)
- [Tablet with uncovered location art](mobile-board-proof/location-text-only-ipad.jpg)


## Responsive district centering follow-up

The old presentation stylesheet retained a two-column marker and put the score in column 2 on wide views. The board now explicitly uses one column for names, scores, rules, status, and action prompts, with wide score-label positioning reset. Projected scores share the status flex row instead of occupying the same grid cell as a separate overlapping element. The hub keeps its fixed height and transparent surfaces.

Resized the same populated preview between phone, tablet portrait, tablet landscape, desktop, and short landscape without reloading. Final selected-card checks at 389×842, 600×900, 700×500, 1023×768, and 1440×900 found no overlapping preview/status elements; each main info row was centered within 0.01 CSS px of its lane. `Battle.test.tsx` passes 70/70, frontend TypeScript passes, and `git diff --check` passes. Temporary viewport overrides were reset.

- [Centered desktop](mobile-board-proof/location-centered-desktop.jpg)
- [Centered short landscape](mobile-board-proof/location-centered-short-landscape.jpg)
- [Resize and overlap measurements](mobile-board-proof/location-centered-resize-checks.json)


## Six battle display upgrades

Implemented the six accepted follow-ups: readable transparent district information, issued-rule live progress, selected-hand move peeks and neighbor spacing, separately labeled score forecasts with signed changes, complete-row crew browsing, and district ambience with existing attack typography/pacing polish.

The main scores remain authoritative. Before a district is selected, previews describe each possible local play; after selection, all three lanes forecast the selected play, including Pirate Radio's cross-lane bonus. PvP has no speculative score previews. Progress uses the match's issued district definition, excludes hazards, and only activates the exact required ally count. The themed explainer and canonical card inspector remain available.

Hand selection keeps the same card width on phone/tablet/desktop. Only its own tray scrolls to keep a selected fighter visible after rotation; manual browsing is not intercepted. Short landscape now has a real content-height column instead of the old centered 100%-height row, so all hand cards are reachable. No document/field scroll is used. The move peek floats above the command deck and disappears when the card is committed. Small screens reserve a complete 55px combat row and 32px crew controls. Crew paging reports actual hidden cards, ignoring empty trailing scroll padding, and returns to the first row when the last row is visible; unlimited populations remain supported.

Bodega neon, Pirate Radio signal arcs, and Construction sparks use local CSS opacity/transform animation. Decorative loops pause during effect resolution and inspection, and reduced-motion styling keeps static cues. The existing attack uses a compact portrait caption, dark local number backing, less vertical number travel and the original 650ms envelope; engine phase timings, sound triggers and attack paths are unchanged.

Final populated checks at browser zoom 89%:

| Actual CSS viewport | Result |
| --- | --- |
| 320 × 568 | Full selected hand card; complete first crowded row; action fits. |
| 389 × 843 | Full selected hand card; full district info; stable board while selecting card/lane. |
| 768 × 1023 | Portrait tablet formations and selected hand card fit. |
| 1023 × 768 | Landscape tablet normal formations and selected card fit without the old width jump. |
| 1440 × 900 | Centered district rows; normal/full hand cards; action fits. |
| 843 × 389 | Scrollable side dock; selected card fits; crowded row and primary action fit. |

Across all six: no horizontal document overflow, transparent district-marker backgrounds, no projected-score/rule overlap, all 12 cards per crowded side remain mounted and inspectable, and main information centers are within 0.001 CSS px of their lane centers. See the [measurements](mobile-board-proof/battle-six-final-viewport-checks.json).

On 389 × 843, the field remains y=83.95365142822266 and height=506.96978759765625 through selected card/lane changes. A native Cornball play into Pirate Radio changes live status from **1/2 allies** to **ON AIR** and current player scores to **13 / 6 / 49**, matching the preview. Selecting a fighter from View 12 still opens the full Snow Bunny inspector with ability, statuses and upgrades. The final crowded row fits in short landscape, its continuation changes to Back to first row, and a next-row click advances the crew scroll.

A real Snow Bunny freeze fixture confirms **−4 / Frozen** with a 23px number and the original 0.65s animation envelope, Pirate Radio rival score **4 → 0**, a compact attack banner, and paused decorative loops. Optional fixture parameters `effect-card` and `effect-lane` now select actual engine-resolved examples for review.

Focused regression checks: **90/90 pass** across Battle, issued district cues, battle preview and feedback. Frontend TypeScript passes. Production build and bundle checks pass. The broad-suite baseline failures and unmeasured physical-device/performance/contrast boundaries above still apply; no broad-suite or frame-budget win is claimed.

- [Phone selected play](mobile-board-proof/battle-six-phone.jpg)
- [Small phone](mobile-board-proof/battle-six-small-phone.jpg)
- [Tablet portrait](mobile-board-proof/battle-six-ipad-portrait.jpg)
- [Tablet landscape](mobile-board-proof/battle-six-ipad-landscape.jpg)
- [Desktop](mobile-board-proof/battle-six-desktop.jpg)
- [Short landscape](mobile-board-proof/battle-six-short-landscape.jpg)
- [Real freeze attack](mobile-board-proof/battle-six-effect-phone.jpg)
- [Pirate Radio activated](mobile-board-proof/battle-six-on-air-phone.jpg)
- [Focused test output](mobile-board-proof/battle-six-focused-tests.log)

All work remains local and uncommitted. No push or deployment was requested for this follow-up.

## Centered battle controls pass

Round and countdown now share one centered anchor: large countdown numerals sit behind the round number, with a thin time track and an urgent red treatment. Rival Motion moved from the header beside Your Motion, with separate blue/gold values and light pools. Speed, Skip and menu form a compact right corner; Skip retains a reserved slot. The slimmer primary action is centered on wide screens, with Squabble to its right. Keyboard order follows the visual order.

The header keeps its reserved 76px desktop / 84px phone geometry during live play. Final-board inspection reserves its own 110px phone header and retains the inspector prompt. Reading, replay, tutorial and PvP handlers are preserved. PvP retains authoritative timing and never shows local speed controls.

Browser checks at 320×568, 389×843, 602×768, 640×768, 768×1024, 1024×768, 1440×900 and 843×389: round center error below .001px, exactly one timer and one counter for each side, no document overflow, all action bounds inside the arena, and right controls clear of the clock. Sizes are approximate by 1 CSS pixel because the browser is zoomed. Rotation was checked without reloading the fixture. Header geometry was unchanged when Skip appeared/disappeared. The menu opened inside the phone viewport and closed with Escape. Final-review centering was checked independently.

Native UI actions verified: select Plug / Pirate Radio, arm and disarm Squabble, commit the play (Your Motion 20→19, rival stays 2, Pirate Radio ON AIR), toggle speed and Skip back to the decision phase. Urgent 5-second timer styling and announcements were checked. Tests: 90/90 focused battle regressions, frontend TypeScript, production build and bundle validation passed. No performance or production-publication claim is made for this pass.

Proof: `mobile-board-proof/battle-command-viewports.json`, `battle-command-final-review-check.json`, the matching viewport captures and build/test logs.

## October 11 release validation

The approved battle, HUD, card presentation and police board changes were rechecked before publication: 90/90 focused tests, frontend TypeScript, production build and bundle budgets passed. The earlier baseline comparison and its 24 existing broad-suite failures remain the documented scope boundary. No gameplay-rule or balance changes are included.
