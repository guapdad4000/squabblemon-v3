---
name: Visual regression proof
description: Requirements for trustworthy verification of authenticated layout and clipping fixes.
---

Authenticated UI fixes need real-component fixtures with required-element assertions, successful interaction callbacks, and visual inspection—not just geometry logs.

**Why:** Earlier polish checks could report success while skipping an absent result fixture, checking only the first Story action, or missing decoration anchored to the wrong parent. Build success did not establish visual correctness.

**How to apply:** Fail if the target component is missing; check the final action after scrolling, hit-test it, and verify its callback. Inspect screenshots of the relevant state. Keep fixtures out of production routes and mock API response contracts accurately. Test decoration bounds as well as page overflow.

For results, also assert that the primary continuation action is visible on first render and does not overlap earnings. Correct portrait asset selection and successful scroll-to-click checks alone can still leave an oversized scene with its primary action below the fold.

Use production-sized reward batches in layout fixtures, not shortened samples.

**Why:** A ten-pack fixture containing only ten rewards concealed the scrolling requirements of the real sixty-reward haul. Geometry checks also missed empty strips between an independently sized scene and its controls.

**How to apply:** Match real batch cardinality, inspect the final item and continuation action after scrolling, and measure spacing between adjacent regions as well as their viewport bounds.

Verify setup-screen reachability inside the real route shell at the reported viewport, not only in an isolated component at a wider size.

**Why:** An isolated wide-screen Story selector looked fixed while the real viewport-constrained shell still clipped the start action at an intermediate width. Automated locator clicks can also scroll an overflow-hidden ancestor that a user's wheel cannot scroll, hiding the bug.

**How to apply:** Assert the primary action is in view and hit-testable before clicking. Exercise wheel or keyboard scrolling of overflowing content, then select a crew and enter the actual first turn with a valid match-start response. Check both width and height breakpoints.