---
name: iPad keyed battle video
description: Preserve real alpha independently of mobile video decoding; distinguish decoder limitations from the asset itself.
---

Do not infer that a VP9 asset lacks transparency from ffprobe's `yuv420p` report or FFmpeg's default decoded frames. Inspect it using the explicit `libvpx-vp9` decoder, which reads the alpha plane.

**Why:** The dust clip really contains alpha, but FFmpeg's native VP9 decoder discards it. Treating the resulting opaque RGB as the artwork led to the wrong light-color key: the transparent center became an opaque brown field on mobile decoders without alpha support.

**How to apply:** Put `-c:v libvpx-vp9` before the input when extracting RGBA frames. Preserve true-alpha effects in a mobile-supported image format rather than approximating transparency with luminance. Reserve color keying for genuinely matte-backed footage, such as the green SQUABBLE icon.

Decorative one-shot effects must end on a fully transparent frame and have a bounded cleanup independent of media completion events.

**Why:** A few transparent pixels in a frame passed earlier tests while most of the mobile screen was still brown. Mobile media stalls and missing completion events can also retain the last frame.

**How to apply:** Verify the rendered middle/end of the animation against an unobscured board, plus natural completion, failed loading, backgrounding, and rematches. Keep a visible fade and deadline even when the asset itself ends transparently.

One-shot media lifetime must be independent of changing React completion callbacks, and its regression tests must observe natural completion during real parent updates.

**Why:** Pixel tests and synthetic ended events passed while frequent battle-clock rerenders still restarted the decoded video. A visually correct frame did not prove stable playback.

**How to apply:** Keep callback freshness separate from media setup/teardown. Exercise updates and reconnects while the actual clip is playing, then verify it finishes once without creating another player.
WebGL chroma keying must output premultiplied alpha (default `premultipliedAlpha: true`, rgb*a). An unpremultiplied WebGL canvas showed full green/cyan mattes on iOS Safari while desktop rendered correctly.

**Why:** The GPU keyer shipped with `premultipliedAlpha:false`; desktop passed, and players on iPhone saw every keyed VS/finisher video with its matte.

**How to apply:** Any new GPU compositing path needs a real iOS Safari check, not only desktop Chromium screenshots.
