# Check the Block

Fullscreen chess in an illustrated overhead Oakland park, with actual Squabbler miniatures as the pieces. The interactive 8×8 board uses cream/navy concrete tiles; clear role letters distinguish the characters. It opens from the matching Fadecade arcade cabinet with `?game=check-the-block`. Existing Back navigation, browser Forward, refresh and saved match recovery are supported.

## Play and rewards

The player is White and the rival is Black. **GUAP is the king and Ashlee is the queen** on both sides; the guide, square labels and queen promotion identify them. Other roles are YN pawn, Bouncer rook, Simmy knight and John Henry bishop. Ordinary legal chess includes check, castling, en passant, all four promotion choices, checkmate and draw rules. Complete move history preserves repetition across reloads. Tap a piece and a marked destination, or use arrow keys and Enter; promotion, help and resignation use existing accessible dialogs. Confirm resignation before ending a match.

Every server-verified checkmate win credits exactly one Pack Ticket. There is no daily cap or cooldown. Draws, losses and resignations credit zero. Each win advances the next opponent: Rookie, Park Regular, Hustler, Tactician, Block Master. Tier five remains replayable for one ticket per subsequent win. Card XP/levels and owned-card stats do not change chess rules.

The server chooses legal AI replies. Tiers increase from seeded random moves to material/position alpha-beta search, with maximum depths of 0/1/2/3/4 and strict node caps of 0/96/650/1800/4000. Budgeted iterative search retains completed results; depth four is conditional on available nodes. These are game difficulty tiers, without an Elo rating claim. Measured opening/midgame/endgame median tier-five replies were 567/710/262 ms, with a peak of 743 ms in those samples.

## Always available chess academy

Learn chess opens before, during or after a match, including while saved-match loading or recovery fails. Three guided tables auto-load their preset positions: **Move & Capture** (seven moves covering all six pieces), **Protect GUAP** (four moves escaping/blocking/capturing check and castling), and **Checkmate with Ashlee** (three moves creating check and closing the king's escapes). Scripted rival replies play automatically; a correct move remains visible until Next step. Wrong moves explain the error and reveal a hint without moving the position.

Each lesson can be restarted and replayed any time. The beginner guide covers turns, coordinates, every piece, capture, check, checkmate, stalemate, castling, promotion and en passant. Arrow keys and Enter work on the same accessible board used by ranked matches. Practice uses only local state; saved matches, tiers and Pack Tickets remain intact, including pending ranked saves. Return to match restores the original game and entry focus.

## Persistence and authority

Authenticated `/api/player/park-chess` GET returns the saved match/campaign. POST `/start`, `/:runId/move` and `/:runId/resign` validate strict bodies. Client-supplied FEN, tier, result or rewards are rejected. Profile locks and permanent start/action receipts atomically save game state, campaign progress and exactly-once tickets. Lost responses retry the same IDs; changed, stale or foreign requests conflict. Existing collection-claims JSON stores the data; no SQL migration is required.

## Art and licensing

Built-in imagegen produced the overhead park, twelve padded Squabbler miniatures and matching Japanese cabinet. Masters, prompts and hashes live in `art-v1/`; production WebPs live in `artifacts/squabblemon/public/assets/park-chess/`. The live board is code, keeping all 64 cells aligned; illustrations supply the environment and pieces. New emblems use fists. Motion respects profile and OS reduced-motion settings.

The current Japanese arcade frame is `cabinet-v2.webp`, with GUAP on the left rail and Ashlee on the right. Its master, targeted edit prompt and manifest are in `art-v2/`; the original cabinet remains in `art-v1/`.

The live CRT shows a checkerboard preview with both teams' GUAP kings and Ashlee queens, a Japanese subtitle, five-tier/ticket copy and a yellow 44 px PLAY button. The target pulses on hover/keyboard focus and respects both OS and profile reduced-motion preferences.

Chess rules use pinned `chess.js` 1.4.0. Original BSD-2-Clause license is retained in `lib/squabblemon-engine/licenses/chess.js.txt` and public distribution at `artifacts/squabblemon/public/third-party/chess.js.txt`. See `lib/squabblemon-engine/park-chess-rules.md` for the verified upstream source and engine details.

## Validation

- Shared engine: 17 rules/AI tests and 10 lesson tests. All 14 preset moves and scripted replies are legal; wrong-move rejection, continuation, restart and completion are covered. A poisoned-pawn position verifies that the stronger tier avoids the greedy trap.
- Backend: 6 focused tests passed on both owned PGlite and native PostgreSQL with five connections. Seven same-day wins credited exactly seven tickets; retries/concurrency prevented duplicate rewards; draws/losses/resignation paid zero.
- Navigation: 7 named tests passed.
- Integrated browser: 10 scenarios covered 320/390/1440/reduced-motion layouts, real-engine moves, history/reload/Back, lost-response retry/sync, castling, en passant, keyboard underpromotion and checkmate wallet refresh. Read-only API mocks avoid live player writes.
- Persistent production-component browser runner: 12 scenarios cover four viewports, ranked play/promotion/rewards/retries/abort, all three lessons and 14 steps, scripted replies, hints, wrong legal moves, keyboard selection, guide, restart/replay, loading/recovery access and pending ranked saves. Practice makes zero ranked POSTs and leaves saved match/tier/tickets intact.
- Full frontend suite: 2,022 named tests passed (2,009 core, 5 bundle-budget tests and 8 balance checks).
- Final GUAP/Ashlee identity pass: both teams' kings and queens, accessible labels/tooltips, help guide and refreshed phone/desktop screenshots passed after the final atlas installation.
- Final frontend typecheck/build and bundle budgets passed; all six art manifest hashes verified and built assets/license match their sources byte for byte.
- Japanese arcade v2: actual hub cabinet checks passed at 320/390/1440 px and with OS/profile reduced motion. Preview/copy fit the measured aperture; 44 px PLAY, keyboard focus, launch/global Back and eight sibling machines passed. The final v2 art and fresh built asset hashes match.

Reproduce from `artifacts/squabblemon`: `pnpm run test:park-chess`, then start Vite with `VITE_E2E_AUTH=true BASE_PATH=/ PORT=<port>` and run `ARCADE_BASE_URL=http://127.0.0.1:<port> pnpm run test:park-chess-browser`. From the repository root use `pnpm run test:park-chess:db` for the isolated database gate.

This patch also includes the Punch on Patrol cabinet refresh and the 33-puzzle story display pass. See `../story-puzzles-v2/README.md` for the separate puzzle verification record.
