---
name: Special-move preview checks
description: How to distinguish video preview-tool failures from broken imported move clips.
---

Do not diagnose a newly imported move video from the embedded screenshot alone. Compare the same fixture with a known older clip, then verify that a fresh Chromium session reaches a ready rendered canvas and advancing video time. Keep new videos web-sized so a cold load has a chance to meet the existing short preview deadline without weakening the failure fallback.

**Why:** The screenshot service showed "Clip unavailable" for both a new file and an existing working file. A separate browser rendered the new move normally. The original uploads were substantially larger than existing move clips, so web optimization also reduced the risk of real cold-load failures.

**How to apply:** For later video handoffs, check identity against card portraits, inspect actual media and duplicate characters, optimize oversized clips while preserving audio and dimensions, update revision hashes, and test in a real browser with the rendered frame and playback time rather than relying on a static screenshot or metadata alone.