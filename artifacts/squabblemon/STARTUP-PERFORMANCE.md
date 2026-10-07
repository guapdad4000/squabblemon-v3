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
