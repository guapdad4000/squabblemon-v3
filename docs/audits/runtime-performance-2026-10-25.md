# Runtime performance overhaul — October 25, 2026

Implemented locally by three GPT-6.1 Sol agents with parent integration review. Candidate worktree: `codex/v2-performance-api`, based on `61e9a86c1bd1ba49e350bd4a488671ab37d26ad2`, with earlier local hardening work retained. Nothing in this pass was pushed, deployed, or applied to a live database.

## Delivered changes

1. **Replay state and archive.** Defensive snapshots share unchanged historical structure while retaining the complete before/after presentation contract. A versioned lossless archive decoder accepts existing full snapshots; compact server writes remain explicitly gated for rolling deployment.
2. **Online synchronization.** Stored generated live metadata and a token cover every room writer. Authenticated unchanged human-room polls read that small projection without reading the archive or taking the room lock. Deadlines, bot turns, settlement, reactions, reconnects, corrections and actual commands retain authoritative handling.
3. **Battle worker.** One reusable module worker calculates previews and local rival turns. Historical replay boards stay out of worker messages; original history is joined back on return. Rapid forecasts have a bounded queue and cannot displace a pending rival turn. Cancellation, disposal, worker failure and fallback are covered. Existing presentation pacing remains intact.
4. **Background reads.** Automatic menu/mail/daily/account/mythic/bootstrap refresh yields during battles and hidden tabs, then refreshes on return. Explicit reward claims and notification receipts remain independent.
5. **Story delivery.** The player route loads a small authored index and only the requested chapter. All 35 canonical chapter payloads are preserved as revisioned external assets. Retries, stale deployments, direct-node entry and navigation cancellation are checked. Server validation and the full authoring Studio remain intact.

No art, card capacity, card balance, encounter rules or battle effects were removed by this architecture pass. Full gameplay/telemetry comparisons are recorded separately below rather than inferred from passing builds.

## Measured results and limits

| Workload | Before | Candidate |
| --- | ---: | ---: |
| Retained replay objects/arrays in 72-to-96-card microbenchmark | 137,196 | 2,424; 98.23% fewer |
| Same full replay / lossless archive | 17,816,304 bytes | 740,313 bytes; 95.84% smaller |
| Same snapshot workload, nine-sample median | 100.38 ms | 75.83 ms; 24.5% lower |
| Six-round database room archive | 2,571,565 bytes | 196,464 bytes with compact writes enabled |
| Unchanged-room live database projection | Full archive previously needed | 666 bytes in this fixture |
| 36-card worker input | 12,573,488 bytes with historical replay boards | 354,416 bytes without replay boards |
| Optional background reads in simulated battle | 8 scheduled reads/minute at menu baseline | 0 over 120 seconds of battle and 0 over 120 seconds hidden |
| Initial player Story catalog | Previously eager 575.14 kB full catalog | 65,369-byte index chunk; chapter bodies on request |

Replay and database figures are bounded local Node/native-PostgreSQL benchmarks, not phone frame rate or production endpoint measurements. Worker transfer figures are a development Chromium fixture with actual module-worker execution, 36 populated cards and 109 history events; the worker result equals the synchronous engine result. Worker dispatch was 0.5 ms in the final single sample, but total turn completion was 53 ms versus a 48.5 ms synchronous computation: moving work off the UI thread does not claim less total CPU time.

The worker adds a separate 439.45 kB uncompressed script, initialized with the battle session and reused for its requests. It is not free network or CPU work; the purpose is to keep expensive computation away from input and rendering.

The generated database fields add write work: in the native benchmark, full-format writes rose from 42.46 to 50.80 ms median; compact-format writes rose from 3.49 to 4.34 ms. The recurring read savings and this mutation tradeoff are both recorded in the [state/online audit](battle-state-sync-2026-10-25.md).

The production six-round renderer passed its unchanged 390×844, DPR 2, 4× CPU-throttle budgets in standard and reduced-motion modes. It retained 12 cards and all three districts: 93/86 React commits, respectively. This verifies an existing production-renderer workload. It is not a physical phone thermal test or a measurement of the complete live PvP shell. No sustained phone-temperature improvement is claimed.

## Integration verification

- Complete frontend/game suite: 2,435 tests passed, zero failures/skips/todos; chained service-worker, entry-bundle and balance-patch guards also passed.
- Required production build: 262 tests passed; generated Story freshness, external chapter coverage, entry JavaScript budgets, emitted CSS invalidation and panel guards passed. Frontend and API typechecks passed.
- Fresh native PostgreSQL: additive migration replay passed; social suite 35 tests; ranked settlement suite 15 tests; final conditional polling/retirement/reward suite 22 tests. The state agent's separate benchmark-enabled native run includes an additional measurement case.
- Actual guided player journey at phone and desktop widths: exact deck-save retry, worker-backed local battle, authoritative transcript win, reward handoff, reload and one-time claim passed against isolated mocked endpoints.
- Actual online renderer with mocked GETs: ten-card clock updates caused zero board-card renders or commits; genuine same-revision form/status corrections, private-hand cost and completion still updated correctly.
- Four responsive viewports (320×568, 390×844, 844×390, 1440×1000): all 72 fighters remained present, six crowded stacks scrollable, no horizontal overflow; district/final-card inspection, focus return, actions, artwork and motion-setting restoration passed.
- Story browser checks at phone/desktop widths: theater requests zero chapter bodies; requested chapter only; cached revisit; direct node; aborted fetch retry; stale revision reload; canceled-navigation completion. See [Story delivery audit](story-chapter-delivery-2026-10-25.md).
- Five preview tests now mount and await actual asynchronous Battle previews instead of requiring forecasts from server rendering. Two obsolete House winning transcripts were refreshed with lane changes only; full match and replay data remain deeply equal to the reconstructed pre-pass engine.

The source-bound deck audit is complete: all 20,368 cases (17,296 league, 2,816 stress, 256 confirmation) succeeded and match the original v64 packed gameplay/choice/card/current-classification rows exactly. 276 full-event/compact replay comparisons passed. All three source/runtime/plan freshness checks pass for source `db4e1aae087bbbee4ba1b76abe013eed25625c8a120ac7557fa540a83f8afe19`. The [fresh named report](../../artifacts/deliverables/current-deck-audit-20261025-runtime-v64-telemetry/README.md) covers 46 decks, 460 named slots and 301 observed cards; these remain automated diagnostics, not player win rates.

The broad embedded API run initially passed 363/365 tests. A campaign solver exceeded its wall-time budget while simulations shared the host; the quiet campaign recheck passed all 13 tests, including a new account completing every campaign node through HTTP, with the original per-node limits unchanged. The second failure was a brittle assertion of the internal field name in a TypeError for malformed relevant room data. The assertion now checks the same fail-closed TypeError behavior in both reference and optimized paths; its focused recheck passed 1/1. The initial failed run and both successful targeted rechecks are preserved separately. This is not a claim of a clean one-shot 365/365 run.

Current diagnostic ability classification now compares mechanical JSON values independently of object key insertion order, while respecting arrays and real value changes. This fixes false Ptang/Waterboy effect counts exposed by replay structural sharing. The historical exported raw-counter heuristic remains explicitly labelled and is not presented as a current ability-success rate. Six current telemetry tests pass separately. The final production build emits the same 290 asset filenames as before this diagnostics-only correction.

One historical saved-report assertion remains unavailable: its 57,634,051-byte Git LFS payload is absent locally, and the official repository LFS download endpoint returns object 404 for recorded SHA-256 `4f55c3f79827da57a777c4d1defb8f073ef796ff77eea67316d7a612ac426574`. The original assertion was not weakened, skipped, or fed replacement data. This is excluded from passed test claims; see `historical-fixture-status.json`.

## Evidence and rollout

Reviewable logs, browser reports, screenshots and runtime source hashes are under [runtime-performance-20261025](../../artifacts/deliverables/runtime-performance-20261025/). The full temporary production trace was lost in the tool-session restart; its structured metrics, build log and source identity were saved in the evidence bundle. No trace is bundled as application media. Existing earlier phone-rendering evidence remains a historical baseline, not a new live-site measurement.

Apply the additive online-room migration **before** deploying the new API. Keep `ONLINE_COMPACT_REPLAY` unset until every reader understands the new archive. Then enabling it is a separate rollout step. Before rolling back to an old API without decoding, disable compact writes and rewrite **every already compact room** to the full format; toggling the flag off alone is insufficient. No production migration or flag change occurred here.

After deployment, repeat the user's live ten-card phone scenario for a sustained session. That hardware test is still required to establish heat, battery and thermal-throttling improvement.
