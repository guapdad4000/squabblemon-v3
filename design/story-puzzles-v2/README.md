# Story puzzle display pass

All 33 active story puzzles have individual generated environment illustrations. `inventory.json` records each node, original visible clues, answer and hints for audit; `art-manifest.json` records production asset dimensions, bytes and SHA-256. The 33 distinct runtime WebPs total 6,270,778 bytes and load only when their puzzle is displayed. Each provenance file records its original generated master and scene brief. Review every asset in `art-contact-sheet.png` or `REVIEW.html`.

## Final composition and redundancy audit

`PuzzleScene.tsx` owns one compact contextual illustration. `StoryPuzzle.tsx` owns one editable evidence list containing each full clue once, its position, and its reorder controls. The former workbench sequence preview, selected-clue lens, and second move-control set have been removed. The drawer now shows the puzzle title and solving instruction directly, without generic story/challenge labels, piece-count captions, a Notes heading, or repeated reorder instructions. Hints appear only when requested.

Destination labels remain where positions represent studios, claim windows, tea recipients or aliases. Diner booth portraits appear beside their corresponding clue instead of in a second seating display; only the left end, middle and right end need extra seat labels. Route and charge-ranking endpoints retain meaningful anchors. Generic first/second action, event, step and grill labels have been removed because the numbered position already gives their order.

`DinerPuzzleInstrument.tsx` now supplies only the dry-floor adjacency map and the live grill pickup clock. These calculate meaningful consequences of the current arrangement. The repeated kitchen action rails, receipt records, camera logs and booth preview are removed; their complete information remains in the evidence list. The redundant pickup-clock instruction is removed. No display compares against the hidden solution or corrects camera times for the player.

The artwork is 200px high on desktop and 150px on phone, bringing the evidence closer to the solving rules. The editor uses a two-column layout with compact actions on desktop and one column on smaller screens. Reordering retains a short position transition and respects system reduced-motion. Unused preview, clue-lens, paper-prop, stock-thumbnail and hint-heading styles have been removed.

Keyboard arrows, mouse dragging, touch grip, move buttons, hint state, authoritative server submission, idempotency, skip, retry and focus management are preserved. API routes, reward amounts, puzzle answers and visible clues were not changed by the cleanup.

## Validation

- `node e2e/verify-story-puzzle-pass.mjs`: 33 puzzles at desktop 1440×1000, phone 390×844, small phone 360×640, iPad portrait 768×1024 and landscape 1024×768. All 165 layouts check one scene/editor, full clues appearing once per piece, relevant instruments, decoded artwork, 44px controls and horizontal overflow. Desktop button solutions and small-phone keyboard solutions pass for all 33 puzzles, including hints and wrong answers.
- Existing `squabble-house-puzzles.spec.ts`: five browser regressions cover all six diner puzzles on desktop, phone and short phone, plus actual touch drag, focus wrap, live route/pass outputs, hints, wrong order, solutions, failed-save identity, duplicate locks, Escape and skip.
- `storySquabbleHousePuzzles.test.ts` and `storyAssets.test.ts`: 14 tests pass.
- The integrated production release build passes: API and frontend TypeScript, bundled Netlify function smoke test, story asset checks and bundle budgets. Public entry 212.5 KiB / 475 KiB, GameApp 870.1 / 900 KiB, Home 943.7 / 1200 KiB.

The integrated verification rerun passes 14 native unit tests, five existing browser regressions and all 165 layouts, including 66 solved arrangements. The portable runner accepts `STORY_PUZZLE_BASE_URL`; it waits for exact clue visibility and font readiness before checking geometry. Browser report and captures for the final cleanup are in `screenshots/story-puzzles-v3`. This pass ships with the Check the Block chess academy patch.
