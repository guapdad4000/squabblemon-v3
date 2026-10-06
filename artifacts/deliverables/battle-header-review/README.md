# Battle header refinement

Offline battles use the PvP portrait treatment and a clearer mobile hierarchy: rival identity, round and timer above; turn status, claims, rival Motion and the menu below. Music lives in the paper menu, with dark text for contrast. The existing PvP header and tutorial header remain separate. The board and hand styling is unchanged.

Production build and TypeScript passed. Header browser checks passed at 320×568, 390×844, 430×932, 844×390 and 1440×1000, in light and dark root themes. Checks include identity/round/timer separation, menu position, music-dialog size, keyboard focus, long rival names, urgent/paused/disabled timer states, and existing PvP identity/music controls. The existing five-viewport battle integration checks also passed, including district/card inspection, card-origin targeting, hand scrolling, resizing, touch swipes and drag-to-play. No uncaught browser errors. These are browser-emulation results, not physical-device or hosted multiplayer verification.

- [Header close-up](390-header.png)
- [Phone board](390-dark.png)
- [Paper menu](390-menu.png)
- [PvP comparison](390-pvp.png)
- [Small phone](320-dark.png)
- [Large phone](430-dark.png)
- [Landscape](844-dark.png)
- [Desktop](1440-dark.png)
- [Header browser results](browser.json)
- [Battle interaction results](battle-interactions.json)

Run `node scripts/verify-battle-header.cjs` from `artifacts/squabblemon` against the production battle-mobile fixture preview. Set `TEST_BASE_URL`, `CHROMIUM_PATH` and `REVIEW_OUTPUT` when needed.
