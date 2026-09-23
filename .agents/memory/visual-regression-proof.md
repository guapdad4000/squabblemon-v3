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

**Why:** An isolated wide-screen Story selector looked fixed while the real viewport-constrained shell still clipped the start action at an intermediate width. Payment-store checks similarly passed in a minimum-height scaffold that omitted the actual flex parent. Automated locator clicks can also scroll an overflow-hidden ancestor that a user's wheel cannot scroll, hiding the bug.

**How to apply:** Match the real route's height constraints, intermediate parents, and navigation—not just its component names. Assert the final action is in view and hit-testable before clicking. Exercise wheel or keyboard scrolling of overflowing content. Check both width and height breakpoints; for battle setup, select a crew and enter the actual first turn with a valid match-start response.

Prefer one vertical scroll owner for a screen with persistent foreground artwork.

**Why:** Independently scrolling the route, poster board, and poster list made the bounty screen feel unpredictable despite passing scroll-to-click checks. The user explicitly rejected the extra scrollbars.

**How to apply:** Count genuinely overflowing elements and verify wheel and keyboard scrolling. For foreground art over a scene, use a transparent, non-interactive overlay with enough trailing content padding for the last item to scroll fully above it. An opaque fixed panel can make the list look cut off even when scrolling technically works; the user rejected that arrangement too.

For effects attached to illustrated objects, verify the rendered transform and occlusion as well as the intended origin coordinates.

**Why:** A beam's coordinate attributes can match its lens perfectly while opaque artwork above it hides the visible start, making it appear disconnected.

**How to apply:** Test the transformed effect geometry independently of diagnostic attributes, inspect stacking against the source illustration, and confirm the visible join in a screenshot.

Isolate Vite dependency caches when running a browser-test server with different routing or auth flags alongside the managed preview.

**Why:** A test server using different configuration invalidated the preview's optimized dependency hashes, causing HTTP 504 module responses and a blank fixture until the preview restarted. This can look like an application regression.

**How to apply:** Prefer an existing real-component fixture on the running preview for narrow CSS checks. Give separately configured test servers their own cache directory; do not run them concurrently against the preview's cache.

Check both edges of the final item between sticky controls and floating actions, especially on short screens.

**Why:** A final card cleared the bottom action buttons but was almost entirely behind the sticky search on landscape phones. Bottom-only geometry assertions passed while the screenshot exposed the problem.

**How to apply:** Assert the whole item fits below the sticky controls and above the footer, then inspect its screenshot. A successful action hit-test does not prove the content between the controls is readable.
