# Runtime performance evidence

See [the integration audit](../../../docs/audits/runtime-performance-2026-10-25.md) for implementation, measurements, verification limits, deployment order and outstanding physical-phone validation.

- `release-build.json` and `.log`: required production build and 262 critical tests, bound to the dirty candidate source.
- `frontend-tests.log`: complete 2,435-test frontend/game suite plus chained guards. Test inventories overlap the release suite; counts must not be summed as unique tests.
- `runtime-source-sha256.json`: 1,227 frontend/API/engine/database source files. Base Git commit alone does not reproduce these uncommitted changes.
- `battle-performance.json`: optimized renderer, 390×844, DPR 2, 4×CPU throttle, standard/reduced motion; no physical-phone thermal claim.
- `worker-browser.json`: actual module worker, synthetic 12/36-card engine histories; deterministic parity, transfer sizes and a single timing sample per case.
- `online-browser.json`, `responsive-browser.json`, `story-browser.json`, `player-journey.log`: isolated actual UI browser paths with synthetic/mock service data. These are not live-service or real-account proof.
- Native database logs cover schema migration, social/online/concurrency and ranked settlement on fresh owned clusters. Embedded API evidence is kept separate from native concurrency proof.
- `campaign-database-initial.log`: 363/365 passed in the initial embedded API run. `campaign-quiet-recheck.log`: all 13 campaign tests passed with original limits. `social-records-malformed-row-test.log`: corrected behavioral assertion passed 1/1. These targeted rechecks are not a fresh full-suite run.
- `verification-summary.json`: final check inventory and remaining evidence limits.
- `historical-fixture-status.json`: missing preexisting Git LFS report; its archived assertion remains unweakened and is not counted as a pass.

`phone-ten-card.png`, `phone-72-card.png` and `desktop-72-card.png` show retained artwork and crowded-board presentation. No application media was altered by this pass.

This evidence is local. No push, hosted deploy, live migration or compact-write activation was performed.
