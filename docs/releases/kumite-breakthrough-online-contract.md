# Breakthrough online integration

Local candidate, November 2, 2026. Public admission remains closed by the existing all-card release gate. This document describes implemented behavior, not a hosted launch claim.

## Reused foundation

The persistent Node entry point uses the existing Express app, Clerk middleware, same-origin mutation protection, safe logging and database pool. Admission calls the same `loadMember` validator as ranked/friend PvP, on the matchmaking transaction's connection. Owned ten-card decks and completed onboarding are mandatory. The existing picker, portraits, arena, effects, accessibility controls and result ceremony present Breakthrough play. CPU practice stays available separately.

Format-specific code owns the continuous clock, room journal, compact stream and Breakthrough records. Regular ranked RP, weekly Kumite, wallet, collection, mastery and bounty progress are untouched. Shared concepts (idempotent commands, locked pairing, transactional receipts) follow the existing PvP behavior; the turn-based engine/state format is not used for real-time combat.

## API and retry contract

All routes use `/api/breakthrough` and require a Clerk user plus `x-breakthrough-protocol: breakthrough-online-v1`. Identity never comes from the body or query. Requests are private/no-store; missing auth is 401, wrong member 403, absent room 404, incompatible protocol/conflicting identity/sequence 409, unavailable owner/gate 503, excessive traffic 429. The server bounds accounts to 16 requests per second and two live streams.

- GET `/`: current search or most recent completed match, plus own trophy record. A waiting player heartbeats here once per second; 30 seconds without heartbeat makes the search ineligible. Idle clients poll every five seconds.
- POST `/search` `{deckId,requestId}`: UUID identity scoped to user, one open search/match per account, immutable server-validated deck snapshot. A short queue advisory lock serializes pairing/cancellation. Both players' search and the initial room commit together. An identical request recovers the same search; another deck under its ID is rejected. Searching expresses readiness, so pairing starts combat immediately. No bot substitutes for a human opponent.
- POST `/cancel` `{requestId}`: cancels only waiting searches. If pairing already committed, returns that room for recovery.
- GET `/:roomId`: authorized seat snapshot; never advances the match.
- GET `/:roomId/stream`: authenticated SSE, first frame a full snapshot, subsequent frames deltas at up to 10 Hz. Own hand/next draw/costs/target choices are private to the seat. Opponent hand, draw order, RNG and private checkpoint never leave the server. Backpressure ends the connection rather than accumulating unbounded frames. Streams close before token expiry or after 45 seconds; reconnection gets a fresh token and baseline.
- POST `/:roomId/commands`: shared `RoomCommandEnvelope` containing command ID, sequence and deploy/cancel-reinforcement/surrender intent. Only committed commands are acknowledged. Same ID/sequence/intent returns the original ack; conflicting reuse fails. The browser persists pending intent in account/room-scoped session storage before sending. Uncertain outcomes retry that exact identity. Acknowledged sequence wins even before the next stream frame arrives.
- GET `/:roomId/receipt`: own saved result or null while settlement retries. Reload recovers the last completed result until the player leaves its ceremony.

Command rejection consumes a sequence only when the authoritative room accepts the envelope and rejects the play. Auth/format/identity/sequence errors do not. Menus, hidden tabs, disconnects and animation never pause the server. Surrender requires a second click, ends the authoritative match and creates an unrated result. Leaving the page keeps the match running; reopening recovers it.

## Runtime and persistence

`BREAKTHROUGH_PVP_ENABLED=true` enables the persistent Node service only after the release gate passes. Run the existing API build/start commands on **one persistent replica**, with the normal database and Clerk configuration. Route `/api/breakthrough*` on the game's same origin to that service, including unbuffered streaming. The current serverless Netlify API entry does not start this runtime. No vendor, DNS, live environment, database or deployment has been changed by this local work.

A 50 ms owner loop runs independently of connected clients; clock journals batch at one second and checkpoints at ten seconds. Every command and terminal commits before acknowledgment. Leases last 15 seconds, renew before expiry, and use fenced atomic commits. Restart scans for expired active rooms, replays the durable journal and catches up elapsed time. Recovery can wait for the old lease to expire. The initial capacity cap is 100 active rooms. This is a bounded single-host integration, not a measured capacity guarantee. Multiple replicas require owner-aware routing; random load balancing is not supported.

Apply both mirrored room and online migrations through the normal migration pipeline before starting a staged service. No live migration was applied. Completed checkpoints/receipts currently retain their audit history; a deployment-specific archival policy remains an operations decision.

## Trophy policy candidate

`breakthrough-season-1` / `breakthrough-trophies-v1` is a new isolated policy for review: win +20, draw +3, loss −6, floor zero. A naturally completed match must last at least 30 seconds and both players must deploy twice. Only the first 20 eligible matches per UTC day and first three against a given opponent are rated. Expired, surrendered, short and inactive matches receive saved zero-award receipts. Currency, packs, cards and normal ranked tiers are not granted. No season tier thresholds are invented; this track displays raw trophy totals.

Unique outbox events and unique `(room,user)` receipts settle in one transaction. Both accounts' records lock in sorted order, so competing rooms cannot bypass daily/pair caps. An injected failure rolls back both players' records, receipts and outbox acknowledgment. A retry sees the saved receipt; a partial receipt is treated as corruption rather than paid again. Policy remains behind public admission until reviewed with staged evidence.

## Evidence boundary

`node scripts/test-breakthrough-database.mjs` runs an owned native PostgreSQL cluster and real HTTP/SSE, including auth/protocol rejection, membership privacy, pairing, cancellation races, restart/retry, rollback and anti-farming. Its eligibility/auth injection uses test principals; existing PvP tests cover the reused validator. `--browser` adds two Chromium clients, actual arena controls, Anunaki placement/consumption, network disconnect/reload, and a saved result at phone/landscape/tablet/desktop sizes. The accelerated browser fixture does not change the production match clock.

Required source checks include the lost-ack browser journal test and surrender replay. Full build, TypeScript, migration-history and existing PvP regressions run separately. Physical-phone behavior, real Clerk sessions, hosted latency, owner failover on the chosen host, all-card release evidence and matching ready deployment identity remain public-launch gates.
