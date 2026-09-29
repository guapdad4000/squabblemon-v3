---
name: WebGL preview fallback
description: How to assess animated 3D assets when the embedded screenshot browser has no WebGL context.
---

An embedded preview screenshot failing to create a WebGL context does not prove the GLB is broken. Present a static, transparent frame rendered from the actual model when WebGL is unavailable, rather than an error message or a different generated character. Check animation in a browser explicitly configured with software WebGL when the preview browser cannot render it.

**Why:** The ordinary app screenshot browser showed a WebGL context failure for an otherwise valid model. A separate headless Chromium session using SwiftShader rendered both animated character instances correctly. Without the still fallback, the design frame showed an error instead of the user's character.

**How to apply:** For future character-led scenes, test asset decoding and animation in a WebGL-capable browser, and test the no-WebGL path in the ordinary preview. Keep labels and controls in HTML independent of the canvas so either path remains readable.