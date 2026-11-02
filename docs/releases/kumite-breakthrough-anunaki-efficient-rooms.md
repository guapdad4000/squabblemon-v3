# Anunaki conversion and efficient room foundation

November 2, 2026. Local implementation; public Breakthrough PvP remains closed.

All 311 canonical cards now have adapters, including Nabu, Enki, Utu, Ninhursag, Inanna, Yakub, Enlil, Ereshkigal, Caucus Mountaineer and Anu. Ruleset `breakthrough-v10-anunaki` invalidates earlier checkpoint/release evidence explicitly. Canonical cost, Hands and artwork remain authoritative. Normal lane populations remain unlimited.

## Gameplay

Ancient Tablets are side-owned lane resources: one per side/lane, persistent after the placing fighter leaves. Their public projection exposes only side and lane. Consumption uses normal event provenance and notifies each active local Ninhursag. Hostile effects use shared interception, Protection, immunity and Hands-loss rules. A blocked hit can still consume a Tablet when the printed ordering requires payment first.

Anu compares the complete taxed alternative price against a non-stacking two-Motion Tablet reduction. A tie preserves the Tablet for its entrance. Payment and quotation share one pure decision; invalid deployment cannot consume resources. The paid lane is preferred, then the lowest lane. Anu consumes remaining friendly Tablets on entrance. Existing Transfer Ticket arrival benefits still apply to the next character, independent of which price alternative won.

Yakub creates ordinary generated Caucus fighters without entrances; Squabble creates two, echoes one. Caucus uses seeded 35% rolls only after positive damage and caps each chain at eight extras. Generated fighters do not recycle into hands. Radiation occurs on global ten-second engine boundaries, including Last Stand. Scammer copies ongoing behavior without firing the copied entrance. Tablet placement/consumption, current Anu price and summons use the existing arena; the canonical Tablet asset is reused without modification.

## Data and persistence

`BreakthroughRoomOwner` is a serialized owner retaining the private checkpoint in memory. Reads do not tick, load repeatedly or write. The host drives 50ms ticks; clock journal entries batch at up to one second, with full checkpoints every ten seconds by default. Every command and terminal result flushes before acknowledgment. Lost commit replies invalidate the cache and recover the original receipt before retry. Unacknowledged clock ticks can be recomputed from the recovered journal and trusted time. Lease expiry blocks reads and writes; the durable adapter enforces the ownership fence and lease on every commit.

`PostgresBreakthroughRoomStore` provides transactional journal/head/checkpoint/outbox writes, unique revisions and terminal IDs, checkpoint compaction, renewal and exclusive takeover of expired leases. Takeover replays the old fence's suffix before checkpointing a new fence. JSONB key-order normalization is supported by semantic journal comparison. The migration is included but has not been applied to a hosted database. Outbox insertion is not reward settlement: an authenticated progression consumer still needs to atomically grant and deduplicate the final receipt.

`breakthroughRoomStream` sends full snapshots on join/reconnect and changes thereafter. Entity patches carry changed live fields, additions and removals, retaining ordering when required; events are sent once against the connection baseline. Mismatched revision, room, ruleset or seat requires a fresh snapshot. Each connection must bind its authenticated principal to its own projection and baseline. The transport must never send checkpoints, journal entries or raw engine state. Immutable definitions and artwork remain cacheable assets; ordinary updates reference IDs and live overrides.

## Reproducible benchmark

Command: `NODE_ENV=test node --import ./artifacts/squabblemon/e2e/supplied-battle-fx.setup.mjs scripts/benchmark-kumite-pvp.ts`.

Seed 20261102, 311-card catalog, 60 fighters, 60 simulated seconds, 20Hz engine and 10Hz output per seat. Every decoded frame is compared with the corresponding complete authoritative seat view.

| Metric | Previous full-state path | New owner/delta path |
| --- | ---: | ---: |
| Write transactions per simulated minute | 1,200 | 60 |
| Full checkpoints per simulated minute | 1,200 | 6 |
| Persistence argument bytes | 314,445,447 | 1,704,804 |
| Update bytes, both seats | 28,041,204 | 899,790 |
| Update bytes per player per minute | 14,020,602 | 449,895 |

This is an uncompressed application-JSON benchmark, not observed cellular usage or hosting cost. It excludes TLS/WebSocket overhead, compression, network RTT and database latency. The fixture exercises a populated board with clock changes; combat/status-heavy workloads will differ. No universal optimality claim is made.

## Verification entry points

- Required source/build suite includes the new Anunaki and room-owner tests: `node scripts/release-checks.mjs --build --evidence output/kumite-release.json`.
- Native PostgreSQL: `node scripts/test-breakthrough-database.mjs`. Always creates its own loopback cluster and ignores existing database URLs. Checks independent-connection contention, JSONB replay, expired lease takeover, stale owners, renewal, rollback and terminal deduplication.
- Browser: `breakthrough-anunaki.spec.ts`, using `breakthrough-anunaki.fixture.html` on the local Vite server. Checks actual arena placement, consumption, Anu quote, Yakub summons, loaded fighter images and no horizontal overflow at 320x568, 390x844, 844x390, 768x1024 and 1440x900. Screenshots are synthetic practice evidence.
- Shared libraries, API and frontend TypeScript remain required. Physical-phone and hosted authenticated two-client testing remain separate.

## Remaining launch work

The engine, protocol and store are local foundations. A persistent host still needs authenticated connections, room scheduling, lease management, matchmaking/cancellation/reconnect policy, deck ownership checks and transactional result/progression consumption. No public transport is registered by this change. The existing simulator retains its explicit simulation boundary. No real accounts were mutated, no hosted schema was changed, and no production release is implied.

The all-card acceptance ledger is still empty and launch approval remains false. Adapter presence and breadth smoke tests do not replace all-card interaction/presentation review. Do not switch on public PvP until those reviews, hosted lifecycle checks, physical-device checks and a matching staged deployment are complete.
