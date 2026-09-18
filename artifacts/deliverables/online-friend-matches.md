# Online friend matches — first playable release

The Fight destination now opens live friend matches. Players select a legal saved crew or owned starter recipe, create a room, share its link or 12-character code, ready up, play six rounds, and request a mutual rematch. Solo training remains reachable from the online lobby.

## Rules shipped

- Seven unique owned cards, in the saved opening order. Decks are captured when creating/joining the room.
- Both players use base move tiers. Each has an independent once-per-match SQUABBLE.
- Sequential, openly resolved turns. Play multiple cards within the Motion budget, then end the turn.
- The server randomly chooses the opening player; the first player alternates each round and flips for a rematch.
- Three districts selected from the shared district catalog, with their rules captured at match start, and existing six-round Motion rules. Both players see the same locations and their own district status. Two district wins decide the result; otherwise a draw.
- Each entire turn has 75 seconds. Playing a card does not restart the clock. Surrender or an expired turn forfeits the match.
- Disconnected players can refresh/rejoin while their clock continues. The server enforces expiration on the next read or command; no browser reports a timeout outcome.
- Waiting rooms and completed-match rematch offers expire after 30 minutes. Active-match room lifetime resets when both players ready up.
- Both players must request a rematch and ready up again. The captured crews are reused.
- These are friendly matches: no currency, XP, mission credit, ranked rating, or automatic matchmaking.

## Server boundary

`lib/squabblemon-engine/src/multiplayer.ts` coordinates two human seats using the shared card rules. It never calls the CPU decision functions. The existing `player` and `cpu` engine labels represent the two stable room seats internally; the UI shows names and You/Rival.

`online_rooms` stores the official state in PostgreSQL. Mutations lock the room row, require membership and the current revision, validate the action, and persist the result atomically. `online_commands` records accepted commands, revisions, timestamps, and unique request IDs. A repeated request ID cannot apply the action twice. Room creation also has a per-account request key and an open-room limit.

The response is explicitly constructed for each participant. Opponent hands, unrevealed draw order, Clerk user IDs, internal match snapshots, and full event replay frames are excluded. Complete deck lists are revealed only on the result screen. Responses use `Cache-Control: private, no-store`. Current public events are a short feed rather than a complete replay download.

The client polls while a room is open, refetches on focus/reconnection, and rejects older revisions received after newer state. It never submits scores or match outcomes. The first transport works with the existing HTTP API and does not require a WebSocket server.

## API

All routes require the existing authenticated Clerk session. Cross-origin mutation protection is supplied by the existing API middleware.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/multiplayer` | List the current user's recent unexpired rooms |
| POST | `/api/multiplayer` | Create; body contains `deckId`, UUID `requestId` |
| GET | `/api/multiplayer/:code` | Fetch the requesting participant's private view |
| POST | `/api/multiplayer/:code/join` | Join using a server-validated `deckId`; safe to retry |
| POST | `/api/multiplayer/:code/actions` | Submit `requestId`, `expectedRevision`, and `command` |

Commands: `ready`, `play` (instance ID, district, SQUABBLE), `end-turn`, `surrender`, `rematch`. Player identity is always taken from the authenticated session, never the body.

The client/server DTOs live in the shared multiplayer module. These endpoints use a small typed HTTP client; the existing generated solo API remains unchanged.

## Verification

- Frontend, API, and shared-library TypeScript checks pass.
- 59 selected engine, multi-card-turn, transcript, activity, multiplayer, and real-route checks pass.
- Online route tests use an isolated PGlite PostgreSQL-compatible database over its local PostgreSQL socket, with real transactions and HTTP handlers.
- Coverage includes unauthorized reads/actions, invalid crews, simultaneous joins, wrong turns/hands, overspending, duplicate cards, duplicate request IDs, stale revisions, concurrent actions, private responses, both SQUABBLES, full six-round results, mutual rematches, persisted timeout decisions, and an open-room cap that excludes finished matches.
- A browser playthrough uses two separate authenticated test sessions and the real local API: invite link, join, ready, twelve human turns, card plays, both SQUABBLES, reload, brief network loss, matching results, and mutual rematch. No browser exceptions were observed.
- Desktop, 390px phone, and 320px phone layouts were inspected. Phone action controls stay accessible at the bottom of the screen.
- Card inspection supports Escape to close; surrender confirmation can be cancelled without ending the match. Both dialogs were checked in the phone browser flow.
- Production frontend and API builds, plus the public-entry bundle budget, pass.
- The additive SQL migration runs successfully against the isolated test database.

The browser CLI named by the verification skill was unavailable in this environment; the project's installed Playwright/Edge tooling performed the browser checks instead.

## Running the checks

The normal workspace uses `pnpm --filter @workspace/squabblemon test:online` and `pnpm --filter @workspace/api-server test`. Database route tests require a disposable `DATABASE_URL`.

For this Windows workspace, `node scripts/check-online.mjs` bundles tests against the current workspace sources, avoiding stale copied package links and the sandbox's OS-user lookup limitation in the TypeScript runner. It honors `DATABASE_URL`; without it, the database integration check is explicitly skipped.

The local browser harness is test-only. Start the existing isolated database with `node artifacts/gameplay-test-db/server.mjs`, initialize it with the schema in `artifacts/gameplay-test-db/drizzle.config.ts`, then run `node scripts/online-preview.mjs` with `ONLINE_E2E=1`, `VITE_E2E_AUTH=true`, `PORT=4196`, `BASE_PATH=/`, and `DATABASE_URL` pointed at localhost:55439. Run `node artifacts/squabblemon/e2e/verify-online.mjs` from the repository root. The harness binds only to loopback and refuses another database address; it is never imported by production.

## Public beta

Deployed at https://squabble.today on September 17, 2026 with production Clerk email sign-in, a Netlify PostgreSQL database, and the same-origin API. The new empty database received the complete tracked migration at `netlify/database/migrations/202609170001_initial-game/migration.sql`; do not also apply the older standalone online-room migration to this database.

HTTPS, Clerk domain/email verification, the public entry, registration form, API health, and signed-out API protection have passed live checks. See `squabble-today-launch.md` for deployment and remaining tester checks.

Two real player accounts should finish a match on separate networks, including a physical phone, refreshing, surrendering, and rematching. Measure turn-order advantage, completion rate, disconnects, and rematch rate in the small beta before public matchmaking or ranked rewards.

The rules version must be bumped when changing multiplayer card behavior or turn semantics. Existing active matches with a different version reject play rather than silently changing rules. Full replay export, richer attack choreography, public queues, ranked play, reward settlement, push notifications, and deployment/load testing are subsequent work.
