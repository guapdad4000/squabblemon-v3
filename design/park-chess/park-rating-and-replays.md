# Park Rating and tier replays

Park Rating tracks this player's performance against the Check the Block computer rivals. It starts at 800, stores a peak and rated-game count, and marks the first ten completed rated games provisional. It is separate from multiplayer ratings and calibrated human chess Elo. Existing results are not backfilled. All guided lessons remain free, local and unrated.

## Rating calculation

| Tier | Rival | Internal estimate |
| --- | --- | --- |
| 1 | Rookie | 600 |
| 2 | Park Regular | 800 |
| 3 | Hustler | 1000 |
| 4 | Tactician | 1200 |
| 5 | Block Master | 1400 |

These anchors describe game difficulty for this initial release; they are estimates rather than measured human-equivalent ratings. The shared pure implementation is `lib/squabblemon-engine/src/parkChessRating.ts`.

For player rating `R` and the rival's stored rating `B`:

```text
expected = 1 / (1 + 10 ^ ((B - R) / 400))
change = roundSymmetrically(32 * (score - expected))
next = clamp(R + change, 100, 3000)
```

Score is 1 for a win, 0.5 for a draw and 0 for a loss or resignation. Half-point changes round away from zero. The displayed change is the actual clamped difference. Stronger-rival wins earn more; draws can increase or decrease rating based on expected score. Repeat wins against weaker rivals yield diminishing gains. Rated-game count increases even when the rounded change is zero; peak never decreases.

This uses the score-versus-expectation principle described in the [FIDE rating regulations](https://handbook.fide.com/chapter/B022024). Our continuous curve, fixed K of 32, bounds, bot anchors and provisional display are game-specific choices, not FIDE's rating implementation.

## Replay progression

The campaign persists `unlockedTier` separately from lifetime wins. Its public `campaign.tier` remains the highest unlocked tier. A win against that frontier unlocks the next rival, capped at tier five. Wins against earlier rivals still count as wins, earn exactly one Pack Ticket, and update Park Rating, without unlocking a harder rival.

The existing new-game action starts the selected unlocked tier. A newly unlocked tier becomes the UI default; a replay choice persists while the frontier stays unchanged. An active match always retains its saved rival until finished. Locked choices cannot be started through the API. Older campaigns derive their initial frontier from the previous win-based progression, preserving all earned unlocks.

## Server authority and compatibility

`POST /api/player/park-chess/start` accepts `{ requestId, tier? }`, with an optional integer tier from 1–5. Omission selects the frontier. Start receipts retain both the requested choice and actual saved match tier. A retried ID cannot change its requested selection. An existing active match is resumed rather than replaced.

New runs snapshot the player's rating and rival estimate at start. Terminal results settle rating, campaign, match, action receipt and ticket together under the profile lock. Duplicate requests return saved state without settling twice. Snapshot mismatches reject before reward writes, and an existing rival estimate remains valid if anchors change later. Inputs cannot supply rating, results, FEN or rewards.

Older active runs with no rating snapshot finish unrated while retaining their tickets and frontier progression; their next match is rated. Old campaigns start rating at 800 with zero rated games. New frontend status fields are optional for safe rendering against older responses. Storage uses existing collection-claims JSON, so no SQL migration is needed.

## Validation

- 43 named focused tests: 17 rules/AI, 10 lessons, 9 rating and 7 navigation.
- 16 backend tests passed on both PGlite and a fresh native PostgreSQL cluster with five connections. Coverage includes concurrent retries, replay/frontier separation, snapshot mismatch rollback, stored rival estimates, forged inputs and legacy games.
- 16 browser scenarios passed with production components at 320, 390, 768 and 1440 px. Tier choices have 44 px targets and complete labels. Coverage includes repeat replay rewards, new-unlock defaults, saved lower-tier rivals, exact retry bodies, draw/resignation changes, old responses, reduced motion and all 14 lesson steps with no ranked writes.
- Frontend and API typechecks passed.
- The complete local production build passed, including the bundled API smoke checks, release guards, migration coverage and frontend bundle budgets. This validates the build locally; it does not publish the patch.

From `artifacts/squabblemon`, run `pnpm run test:park-chess` and `ARCADE_BASE_URL=http://127.0.0.1:<port> pnpm run test:park-chess-browser` against Vite with `VITE_E2E_AUTH=true BASE_PATH=/`. From the root, run `pnpm run test:park-chess:db` against an isolated database. Never use live player data for these tests.
