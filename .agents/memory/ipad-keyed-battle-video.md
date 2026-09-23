---
name: iPad keyed battle video
description: Device-specific guidance for transparent battle effects backed by ordinary video files.
---

Do not assume a `.webm` battle effect contains alpha or that native video compositing will remove its matte consistently on iPad. Render matte-backed effects through a bounded canvas keying pass.

**Why:** The SQUABBLE button animation contained an encoded green field and the battle-start dust contained a pale paper field; both could look acceptable in some phone previews but exposed their mattes on iPad.

**How to apply:** Inspect the asset pixel format before treating it as transparent. For keyed effects, test decoded canvas pixels for both low and high alpha values, and verify at tablet dimensions. Element presence or playback alone does not prove the matte was removed.

One-shot media lifetime must be independent of changing React completion callbacks, and its regression tests must observe natural completion during real parent updates.

**Why:** Pixel tests and synthetic ended events passed while frequent battle-clock rerenders still restarted the decoded video. A visually correct frame did not prove stable playback.

**How to apply:** Keep callback freshness separate from media setup/teardown. Exercise updates and reconnects while the actual clip is playing, then verify it finishes once without creating another player.