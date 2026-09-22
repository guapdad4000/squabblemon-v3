---
name: Visual regression proof
description: Requirements for trustworthy verification of authenticated layout and clipping fixes.
---

Authenticated UI fixes need real-component fixtures with required-element assertions, successful interaction callbacks, and visual inspection—not just geometry logs.

**Why:** Earlier polish checks could report success while skipping an absent result fixture, checking only the first Story action, or missing decoration anchored to the wrong parent. Build success did not establish visual correctness.

**How to apply:** Fail if the target component is missing; check the final action after scrolling, hit-test it, and verify its callback. Inspect screenshots of the relevant state. Keep fixtures out of production routes and mock API response contracts accurately. Test decoration bounds as well as page overflow.

For results, also assert that the primary continuation action is visible on first render and does not overlap earnings. Correct portrait asset selection and successful scroll-to-click checks alone can still leave an oversized scene with its primary action below the fold.