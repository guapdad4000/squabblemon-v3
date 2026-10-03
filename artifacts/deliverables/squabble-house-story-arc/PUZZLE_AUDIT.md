# Squabble House puzzle audit

Original audit: 2026-10-02; release recheck: 2026-10-03. Independent auditor: `squabble_house_puzzle_audit` subagent.

Status: **APPROVED for the six-puzzle subsystem after improvements and re-audit.** The release recheck also passed 16/16 database tests against the current global story payout contract. Final gates: 7/7 independent logic tests, 5/5 browser tests (18 complete puzzle playthroughs), and 16/16 real database tests. It is not a cinematic, deployment, or production-account approval.

## Independent logic and fairness proof

Every required rule is printed in the puzzle itself. No answer depends on remembered dialogue, color alone, real-world cooking knowledge, a hidden camera offset, or an unstated ordering tie-break. Both hints are accessible and optional. The second hint provides an explanation and complete reconstruction.

| Puzzle | Independent rule model | Permutations checked | Legal answers | Result |
| --- | --- | ---: | ---: | --- |
| Build the Last Waffle | State machine: cold/empty iron, heat, batter, cooked waffle, plate, syrup | 120 | 1 | Pass |
| Sort the Damage | Food + extras − discount; strictly ascending $4, $6, $7, $9, $11 | 120 | 1 | Pass |
| A Booth Apart | End seats, screen-relative right, center seat, immediate adjacency | 120 | 1 | Pass |
| Keep the Pass Moving | Sequential non-preemptive cooking; cumulative finish ≤ deadline | 120 | 1 | Pass |
| Respect the Wet Floor | Start A1, end D3, Manhattan-distance-one steps, each dry tile once | 720 | 1 | Pass |
| The Feather File | Correct each printed clock error, then sort 02:21, :22, :23, :25, :27 | 120 | 1 | Pass |

Total: 1,320 permutations. All six unique answers match the authored solutions. All six initial arrangements are unsolved. Missing, duplicated, extra, foreign, and empty piece lists are rejected. The independent models do not read the authored solution to decide legality. Test: `artifacts/squabblemon/src/storySquabbleHousePuzzles.test.ts` — 7/7 passing.

## Improvements and re-audit

The initial implementation had correct puzzles, but two presentation issues warranted improvement:

1. The five grill tiles were squeezed into a 360px screen, splitting “Toast” and its time into many lines. The mobile timeline now scrolls horizontally with readable minimum tile widths. A regression assertion requires ≥76px tiles; the last tile is scrolled into view and captured separately.
2. The sticky action box could cover the bottom of crew hints and wrong-answer feedback on desktop. Actions now stay in normal document flow. Reordering also clears feedback for the previous submitted arrangement. The browser suite verifies no geometric error/action overlap and no stale alert after rearrangement.

Other safeguards present and checked: a labeled modal, focus containment, Escape dismissal, clue descriptions linked to keyboard options, large move controls, touch-grip dragging, reduced-motion presentation, explicit dry/wet labels, solid/dashed route feedback, and text-based ON TIME/LATE states. The player can solve using buttons or keyboard without dragging.

## Browser evidence

Test: `artifacts/squabblemon/e2e/squabble-house-puzzles.spec.ts`.

Final isolated-output run: **5 passed in 29.8 seconds**, with zero page errors. This run includes the corrected grill width, non-overlapping actions, and stale-feedback regression assertions.

Uses the actual `Story`, `StoryPuzzle`, and `DinerPuzzleInstrument` UI via the existing season-theater fixture. Fixture transport simulates the API. It does not exercise production authentication or a live user account.

- All six puzzles at 1440×1000, 390×844, and 360×640: 18 complete playthroughs.
- Each initially wrong arrangement is rejected; both progressive hints display; the independently verified order clears the node.
- Desktop button reorder; real Chromium CDP touch gestures on the phone; arrow-key reorder on the short phone.
- Images and CSS backgrounds decode; no horizontal page overflow; all clue accessibility references resolve; first/last keyboard focus remains in the modal.
- Grill and route instruments update from the player's order; solved states have no late tickets or invalid jumps.
- A simulated failed save preserves order and hints; retry reuses its idempotency key; immediate double submission makes one request.
- Escape closes the puzzle. Explicit skip sends `skip: true` without an order and persists completion.
- All 18 main screenshots are saved under `puzzle-audit/`; phone grill end-of-timeline images are saved as `*-ch4-readable-toast.png`.

Visual review covered all six desktop designs and all six phone/short-phone layouts, including the corrected grill, character seating, dry route, receipt register, kitchen log, and evidence desk. Generated backgrounds and character art remain visible behind readable high-contrast ticket surfaces.

## Authoritative database evidence

Tests: existing `storyPuzzleTransactions.test.ts` plus new `storySquabbleHouseTransactions.test.ts` in `artifacts/api-server/src/lib/` — 16/16 passing, zero skips.

The runner starts its own in-memory PGlite process on a random loopback port, validates the child's token with the existing `assertOwnedPgliteReady`, validates the target with `assertCampaignDatabaseTarget`, then applies the local test schema. It does not use any inherited database URL and terminates its owned database afterward. Log: `puzzle-audit/database-results.txt`.

Both solve and skip were tested for every chapter. Locked puzzles and endings fail; incorrect solutions and the ordinary-completion bypass fail. Puzzle completion grants the standard once-only story Clout and ticket payouts, but no House card, and makes the battle available while keeping the ending locked. The ordinary endpoint cannot complete battles. Once a persisted victory fixture exists, each ending grants its authored card and the standard finale payout once; exact retries and new-key repeats do not grant a second reward. Owned cards convert into the configured Style Shards once, with one collection entry. Clearing an ending opens the next chapter.

The persisted victory row is deliberately a fixture: these tests prove progression and reward authority, not combat transcript generation. Combat transcript verification belongs to the separate content/engine test suite. No production credentials, players, or balances were touched.

## Reproduce

From `artifacts/squabblemon`:

```bash
node --import tsx --test src/storySquabbleHousePuzzles.test.ts
pnpm exec playwright test --config e2e/playwright.config.ts e2e/squabble-house-puzzles.spec.ts --project chromium-desktop --reporter line --output /tmp/squabble-house-puzzle-audit-results
```

From the repository root:

```bash
node artifacts/deliverables/squabble-house-story-arc/run-database-audit.mjs
```

Use a unique Playwright output directory when other agents are running tests concurrently. One intermediate run was invalidated by shared trace-directory cleanup; another test initially read an asynchronous skip request too early and was fixed to wait for completion. Neither was counted as a passing final audit.
