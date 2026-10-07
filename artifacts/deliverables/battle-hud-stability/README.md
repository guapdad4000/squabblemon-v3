# Battle HUD stability

Desktop combat controls share one row. Live status and commentary use a fixed space under the rival identity, so feedback cannot resize the battlefield. Mobile keeps its existing arrangement with fixed row heights. Reading and replay panels scroll over the board, and Skip, speed, claims, and timer slots remain stable.

## Verified

- 69 Battle component checks passed.
- TypeScript passed.
- 20 HUD and reading browser checks passed; the 8 HUD checks were repeated with artwork decoding required for screenshots.
- 16 district preview and popup checks passed.
- Browser layouts: 1688×943, 1366×768, 820×1180, 1180×820, 390×844, 320×640, 844×390, plus PvP at 1440×900.

Checks exercise repeated commentary and effect transitions, round recaps, speed and Skip callbacks, reading and replay controls, menu hit targets, selection previews, and the district details popup. Layout measurements exclude intended impact transforms. Final-review fixtures use independent pages because Chromium's cross-document WebGL teardown crash also reproduces on unmodified HEAD.

## Screenshots

- [desktop](/home/falcon/.codex/worktrees/squabblehouse-art-cutouts/New project 9/artifacts/deliverables/battle-hud-stability/screenshots/desktop.png)
- [mobile](/home/falcon/.codex/worktrees/squabblehouse-art-cutouts/New project 9/artifacts/deliverables/battle-hud-stability/screenshots/mobile.png)
- [ipad-portrait](/home/falcon/.codex/worktrees/squabblehouse-art-cutouts/New project 9/artifacts/deliverables/battle-hud-stability/screenshots/ipad-portrait.png)
- [ipad-landscape](/home/falcon/.codex/worktrees/squabblehouse-art-cutouts/New project 9/artifacts/deliverables/battle-hud-stability/screenshots/ipad-landscape.png)
- [laptop](/home/falcon/.codex/worktrees/squabblehouse-art-cutouts/New project 9/artifacts/deliverables/battle-hud-stability/screenshots/laptop.png)
- [short-phone](/home/falcon/.codex/worktrees/squabblehouse-art-cutouts/New project 9/artifacts/deliverables/battle-hud-stability/screenshots/short-phone.png)
- [phone-landscape](/home/falcon/.codex/worktrees/squabblehouse-art-cutouts/New project 9/artifacts/deliverables/battle-hud-stability/screenshots/phone-landscape.png)
- [pvp-desktop](/home/falcon/.codex/worktrees/squabblehouse-art-cutouts/New project 9/artifacts/deliverables/battle-hud-stability/screenshots/pvp-desktop.png)
- [desktop-selected](/home/falcon/.codex/worktrees/squabblehouse-art-cutouts/New project 9/artifacts/deliverables/battle-hud-stability/screenshots/desktop-selected.png)
- [mobile-selected](/home/falcon/.codex/worktrees/squabblehouse-art-cutouts/New project 9/artifacts/deliverables/battle-hud-stability/screenshots/mobile-selected.png)
- [mobile-district-popup](/home/falcon/.codex/worktrees/squabblehouse-art-cutouts/New project 9/artifacts/deliverables/battle-hud-stability/screenshots/mobile-district-popup.png)

## Commands

Run from artifacts/squabblemon:

```sh
pnpm run typecheck
node --import ../../scripts/battle-test-css.mjs --import tsx --test src/components/Battle.test.tsx
pnpm exec playwright test --config e2e/playwright.hud-stability.config.ts
pnpm exec playwright test --config e2e/playwright.district-reminders.config.ts
```

Included with the Safehouse, Collection and Battle performance release. The validation above was recorded before integration; combined release checks are recorded in the performance integration report.
