# Check the Block rules and opponent tiers

Rules use the pinned `chess.js` **1.4.0** package, under BSD-2-Clause. Its original license is retained in [licenses/chess.js.txt](licenses/chess.js.txt). Official API reference: https://jhlywa.github.io/chess.js/ . Package source: https://github.com/jhlywa/chess.js .

The server starts an ordinary chess position with the player as White. Saved runs contain the initial FEN, every move in UCI form, and the resulting FEN. Restoration replays that history and verifies the final position, preserving castling, en passant, promotions, move clocks and threefold repetition. Browser requests contain a move only; they cannot submit positions, outcomes, rewards or opponent difficulty.

The shared module resolves checkmate, stalemate, threefold repetition, the fifty-move rule and insufficient material. A player checkmate resolves before an opponent reply. A bot checkmate is a loss. Resignation is a separate terminal result. Capture trays come from verified move history rather than subtracting board counts, so promotion does not create imaginary captures.

Each opponent tier increases bounded search effort. These are game difficulty settings, not claimed Elo ratings.

| Tier | Opponent | Maximum depth | Node budget | Behavior |
| --- | --- | --- | --- | --- |
| 1 | Rookie | 0 | 0 | Seeded random legal moves. |
| 2 | Park Regular | 1 | 96 | Material, captures and immediate mate. |
| 3 | Hustler | 2 | 650 | Opponent replies, development and position. |
| 4 | Tactician | 3 | 1,800 | Deeper tactical combinations. |
| 5 | Block Master | 4 | 4,000 | The deepest search and largest budget. |

The original opponent implementation uses iterative negamax with alpha-beta pruning, capture ordering and a deterministic node limit. It keeps the most recent complete search iteration if its budget expires, and never performs an unbounded search. Nodes, not elapsed time, determine the result, so retries choose the same move. Search depth can finish below the configured maximum in complex positions.

The player reward transaction belongs to the API service. Only a server-resolved White checkmate awards one Pack Ticket. Each win raises the next tier by one, capped at five; later wins still award one ticket. Draws, losses and resignations award no ticket. There is no daily ticket cap.

Run the shared rule checks from `artifacts/squabblemon`:

```sh
node --import tsx ../../lib/squabblemon-engine/parkChess.test.ts
```

The tests cover legal movement, pins, castling through check, en passant, all promotions, capture metadata, mate on either side, every supported draw condition, history integrity, resignation, deterministic search budgets, and a poisoned capture that the second tier takes and the third tier avoids.
