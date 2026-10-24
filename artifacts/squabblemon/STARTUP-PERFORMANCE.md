# Startup loading pass - 2026-10-06

The game shell now prepares only the requested route while the player bootstrap loads. Hover, focus, and pointer-down still prepare the intended next route. Opening a non-Safehouse route no longer imports Home or preloads unrelated collection, Growth Lab, generic UI, and fight-room artwork. The lightweight level-up observer is separated from the Growth Lab module; existing exports remain compatible. No artwork, combat rules, timings, rewards, or battle resource preparation were changed.

## Evidence

Three cold browser contexts, 390x844, cache disabled, 2x CPU throttling, local Vite server, controlled API fixtures. Cold entry: `/game/challenges`. Measurements include six seconds after controls become available. This is a development-server comparison, not a production-phone benchmark.

| Measurement | Before | After |
| --- | ---: | ---: |
| Requests in capture window | 433 | 404 |
| Unrelated inspected resource requests | 13 | 0 |
| Median time until Girl Fade launch control is available | 1317 ms | 1286 ms |
| Game shell static production JavaScript | 853.2 KiB | 852.4 KiB |
| Home static production JavaScript | 937.9 KiB | 937.1 KiB |

The avoided optional image requests account for 2878.8 KiB (about 2.8 MiB) of existing image files. The time-to-ready difference is small; this pass primarily removes background bandwidth and decoding work. Do not claim a proven real-device FPS or large startup-speed improvement from these samples.

## Validation

Client production build and bundle limits pass (GameApp 900 KiB, Home 1200 KiB). Client TypeScript passes. Sixteen resource queue, reward receipt, and navigation memory tests pass. Desktop and phone browser journeys verify all three arcade games, loaded sprites, counter patterns, boosts, pauses, saved-state resume, rewards, and no automatic document reloads. Repeated navigation checks cover inventory, collections, Safehouse scene readiness, refresh history, settings, and retained collection tab state. Navigation fixture reward and campaign responses were updated for the current response shapes.

Screenshots: `screenshots/arcade-games/startup-after-390.png`, `screenshots/navigation-desktop.png`, `screenshots/navigation-phone.png`, and the gameplay captures under `screenshots/arcade-games/`.


## API and cinematic loading pass — 2026-10-23

Player initialization now resets expired missions and reconciles earned ownership inside one profile-locked transaction. It reads the locked profile once. Thirteen collection, shop, promo, and legend-bounty endpoints initialize without assembling bootstrap data they discard; responses still read fresh state after mutations. Immutable reward recovery, cadence checks, retries, and wallet locks remain active.

Measured emitted SQL statements for equivalent local API fixtures:

| Request | Before | After |
| --- | ---: | ---: |
| Settled player bootstrap | 16 | 12 |
| Pack opening with ownership recovery | 39 | 27 |
| Training purchase with ownership recovery | 38 | 26 |
| New-account welcome availability | 16 | 8 |
| New-account legend status | 17 | 9 |
| Public patch list | 3 | 2 |
| Catch-up delivery of 100 patch letters | 105 | 6 |

Bootstrap uses one initialization transaction/lock instead of two. Patch catch-up uses one ledger insert instead of 100, retaining inbox order, claim state, conflicts, and concurrent delivery ownership. These are SQL-work measurements from disposable local databases, not production latency or an overall game speed multiplier. No account-response cache, database schema change, or pool-size tuning was introduced.

The loading presentation now uses a randomized authored scene without immediate repeats, a centered gold logo, and a small transparent fighters loop. The loop uses existing `search.gif` frames 0, 1, and 7, excluding the fight-cloud frame; it is 55,244 bytes rather than the original 1,313,341-byte GIF. Original art remains intact. Visible captions, progress, and playback controls are removed; screen readers retain a loading status. Short waits use stills, background cinematics start only during longer waits, and optional media never gates player readiness. Data saver, reduced motion, hidden tabs, and download failures retain still fallbacks.

Defeat atlases receive a shared, bounded preload at battle entry. Each effect chooses decoded authored media or a complete procedural fallback at impact and retains that choice for the beat. Late/failed media cannot freeze the portrait, leave a blank finale, or restart a running defeat. Authored timing and queued-gameplay progression remain unchanged. Special-move playback now ignores stale play-promise interruptions across hidden/visible transitions.

Repeatable checks:

- `pnpm run test:performance:db` — owned PGlite request/reward and SQL budgets.
- `pnpm run test:performance:native` — owned PostgreSQL cluster, actual independent connections and row locks, migrations, patch/reward/startup checks; requires native PostgreSQL, Node, an unprivileged user, and no supplied `DATABASE_URL`.
- `pnpm --filter @workspace/squabblemon test:battle` and `test:broadcast` — battle/defeat and loader selection regressions.
- `pnpm --filter @workspace/squabblemon exec playwright test --config e2e/playwright.loading.config.ts` — loading browser checks; set `LOADING_BASE_URL` and `CHROMIUM_PATH` as needed.
- `pnpm --filter @workspace/squabblemon test:death-browser` — death/special-move browser checks against `UI_ORIGIN` (default local Vite port 4242).

The browser checks use local fixtures and browser visibility events. They do not establish live authenticated, physical-device, or deployed PvP behavior.
