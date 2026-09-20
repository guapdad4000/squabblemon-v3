# Fade Park

Fight opens `/game/online` with ranked Fade Park first. `/game/online?tab=friends` keeps private invites, room codes, ready checks and rematches.

## Shared battle screen

`MultiplayerBattle` feeds the server's public room view into the existing `Battle` component. PvP uses the same three-column board, hand tray, drag/drop, tap-to-play, SQUABBLE and inspection controls as story/solo. The viewer is always at the bottom. Scores, location status and legal costs come from the server. Rival hands and replay snapshots stay private; speculative local previews are disabled online.

The versus arrival clears after 1.2 seconds (350 ms with reduced motion), independently of polling.

## Matchmaking

Nearby ratings are preferred. The range widens while searching and accepts any rating after eight seconds. A labeled Park Bot fills the opponent seat after twelve seconds. Bots use the engine's public-board-only AI and the same legal commands as players.

Waiting searches expire after thirty seconds without a heartbeat. Active matches resume on reconnect. A sleeping server catches up the bot turn instead of awarding a false timeout win. Each player has 75 seconds per turn; missing a deadline forfeits the fade. Ranked matches return to matchmaking; private matches keep rematch votes and a ready check.

| Result | Player opponent | Park Bot |
| --- | ---: | ---: |
| Win | +25 RP | +12 RP |
| Loss | -15 RP | -6 RP |
| Draw | +5 RP | +2 RP |

RP cannot fall below zero. Tiers: Rookie 0, Bronze 100, Silver 300, Gold 600, Platinum 1000, Diamond 1500, Park Royalty 2200. Matchmaking uses separate Elo ratings.

Queue transactions use an advisory lock and room row locks. Match commands retain revision checks and idempotency keys. Rank awards lock profiles in consistent order and save both ranks plus the room settlement receipt atomically. Cancellation returns the active match if pairing won the race.

Existing tables are reused: `online_rooms`, `online_commands`, `player_profiles`. Rank records live at `story_progress.fadePark`; updates preserve story progress, owned cards and decks. No new schema migration is needed.

## API and verification

Clerk authentication and private/no-store responses apply to all endpoints:

- `GET /api/multiplayer/ranked`: rank and current search/match, refreshing a waiting search.
- `POST /api/multiplayer/ranked/search`: `{ deckId, requestId }`.
- `POST /api/multiplayer/ranked/cancel`: `{ code }`.
- Matches use existing room read/action endpoints. Private join endpoints reject ranked rooms. Decks must contain ten different owned cards.

`pnpm --filter @workspace/api-server test` runs the complete API suite against an owned isolated database. `pnpm run test:fade-park` tests real browser → API → isolated database flows: phone/desktop layouts, two players, card play, score synchronization, reconnects, results, cancellation, bot fallback, private invites and rematches. It uses installed Microsoft Edge, a temporary Vite harness on port 4201, and removes that harness on exit.

Battle and multiplayer unit regressions cover guest perspective, legal costs, public data, six rounds, SQUABBLE and summons. Production builds retain existing type, function, character and bundle-budget gates.

Publication uses GitHub `guapdad4000/squabblemon-v3` main and Netlify site `squabblemon-triple-lane` at `https://squabble.today`.
