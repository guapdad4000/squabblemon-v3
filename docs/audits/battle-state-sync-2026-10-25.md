# Battle replay and online live-state performance

Evidence state: **source inspected**, **local checks passed**, **isolated native database checks passed**. No live migration, compact-write activation, deployment, physical-device or production-latency claim.

## Preserved contracts

Presentation still receives every `EffectLogEntry.replay.before/after` as a complete `ReplayState`. Snapshot creation defensively copies mutable engine inputs and shares equal prior snapshot subtrees; no card, district, history event or unlimited population is removed. Historical JSON omission/normalization remains intact. Rules, random draws, event sequences and gameplay counters are unchanged.

`compactMatchReplay` stores the complete event metadata with a versioned lossless delta stream for its before/after frames. `restoreMatchReplay` restores the existing public shape with structural sharing and accepts legacy full snapshots. Unknown/incomplete archive versions fail closed. The room persistence adapter is used by online, social, invitation and Kumite room readers/writers. Worker calculation can retain all history metadata without repeatedly cloning historical replay frames.

## Conditional delivery and archive isolation

The additive PostgreSQL migration adds stored generated `live_state = state - 'match'` and `sync_token = md5(state::text)`. These are computed atomically for **every** state writer, including older APIs and raw invitation/Kumite updates. The token covers same-revision corrections and reactions as well as gameplay revision. Authorization always checks the requesting user against persisted seat IDs; a token grants no access.

A client may submit `GET /api/multiplayer/:code?since=<syncToken>`. Joined, active, current-rules human rooms whose turn/room/tournament clocks are still in the future can return `{ unchanged: true, syncToken, serverTime }`. The fast query selects only generated fields, without selecting/detoasting/transferring the replay archive or taking a room lock. Missing/mismatched tokens, bots, waiting/invited rooms, completed settlement paths, expired clocks and incompatible rules fall back to the existing authoritative transaction and social-lock ordering. Full responses carry `syncToken`; existing clients continue receiving full responses.

The client scopes cached snapshots to the account/room, reuses only the exact submitted token, accepts old APIs returning ordinary full views, and falls back to full reacquisition if an unchanged response cannot match the cached snapshot. Foreground/reconnection generations still require a confirmed fresh GET. Read-only reactions select generated live metadata and a narrow profile projection, avoiding the room lock and archive; reaction writes retain the existing authoritative transaction.

`live_state` is private server metadata and includes private seat/deck information. It is never returned directly; the existing per-seat public allowlist remains the response boundary.

## Rollout and rollback

1. Apply the additive development/Netlify migration **before** rolling out this API. New schema/API readers require the generated columns; the old API remains compatible with the expanded schema and automatically maintains them.
2. Deploy archive decoding to **every** API instance, background task and full-room reader. Keep `ONLINE_COMPACT_REPLAY` unset (the default), so new writes remain the historical full format throughout a mixed API deployment.
3. Only after that deployment is complete may an operator deliberately set `ONLINE_COMPACT_REPLAY=1`. No live activation occurred here. Existing full rooms remain readable and become compact when next saved; generated hot reads benefit immediately regardless of archive format.
4. For rollback to an API lacking the decoder, first disable compact writes **everywhere**, then explicitly load/decode/rewrite **all already compact rooms** as full JSON using the new adapter, and verify no `state.match.replayArchive` remains. Turning the gate off alone is insufficient. Only then roll back the old decoder. Retain the additive generated columns.

## Measurements

Raw sample arrays and source SHA-256 hashes are in [replay evidence](artifacts/state-replay-benchmark-2026-10-25.json) and [native database evidence](artifacts/state-online-native-benchmark-2026-10-25.json). Measurements used native Node v22.23.3 on this host, no rendering/network/device throttle; CPU-intensive sibling work was stopped during sampling.

Replay workload: 72 populated board cards followed by 24 Cornball plays, ending with 96 cards and 72 events. The baseline uses the same current gameplay source with only the snapshot algorithm restored to `JSON.parse(JSON.stringify(...))`. Complete match and every replay frame compare deeply equal after JSON normalization. Object property ordering is not treated as a gameplay difference.

| Measurement | Original snapshot implementation | Structural sharing / archive |
| --- | ---: | ---: |
| Distinct retained snapshot objects/arrays | 137,196 | 2,424 (98.23% fewer) |
| Serialized full match / lossless archive | 17,816,304 B | 740,313 B (95.84% fewer) |
| Median full workload, nine alternating GC-separated samples | 100.38 ms | 75.83 ms (24.5% lower) |

Distinct retained nodes measure retained replay structure, not all transient allocations or total process memory. CPU results are a bounded local microbenchmark, not frame-rate or phone-input proof.

Native PostgreSQL workload: one six-round Vibes CPU match, local fresh owned cluster, loopback node-postgres, 13 alternating samples, otherwise identical unindexed temporary tables. Full room payload was 2,571,565 B; compact room was 196,464 B (92.36% fewer). Selecting generated live fields returned 666 B in either case.

| Native driver operation | Full archive | Compact archive |
| --- | ---: | ---: |
| Read full state | 15.194 ms | 1.526 ms |
| Read generated live metadata/token | 0.494 ms | 0.160 ms |
| Write state without generated columns | 42.461 ms | 3.493 ms |
| Write state with generated columns | 50.795 ms | 4.340 ms |

The compatibility-default full format pays **8.334 ms additional median write cost** for generated projection/hash maintenance in this fixture; compact writes pay **0.847 ms**. This trades additional mutation work for eliminating recurring archive reads/locks. Compact writes reduce that overhead substantially but remain an explicit rollout step. These driver timings include local round-trip and JSON parsing; they are not complete endpoint latency or production database figures.

Reproduce replay samples with native Node: `node scripts/benchmark-replay-state.mjs`. Reproduce native samples using `ONLINE_POLL_BENCHMARK=1 node scripts/test-payments-database.mjs --online-retirement`; that harness creates and destroys its own native PostgreSQL cluster and refuses remote/caller-provided database targets for this mode.

## Verification

Focused existing engine/multiplayer tests and new replay tests passed. The native synchronization/retirement/reward suite passed 23 tests including both compact gate modes, held real row locks, unauthorized tokens, same-revision raw-writer and reaction changes, competing identical command retries, mixed legacy/compact reads, gate-off rewrites, due deadlines, bot fallback and incompatible-room retirement. Conditional transport tests cover token reuse, old-server full responses and mismatched-token reacquisition. API typecheck and Netlify migration coverage passed; parent integration owns final full release checks and migration replay.
