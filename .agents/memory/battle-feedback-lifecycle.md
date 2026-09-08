---
name: Battle feedback lifecycle
description: How sound and haptic feedback stays synchronized with cancellable battle presentation.
---

Battle sound and haptic cues must be keyed to structured event sequence plus the active presentation generation, and must run directly from the presentation loop rather than from a separate timer or rendered-state effect.

**Why:** Skips, navigation, fast-forward, and future replay controls can invalidate visual beats mid-sequence. Independent cue scheduling can produce late or duplicate impacts after the matching visual event is gone.

**How to apply:** When adding or changing battle presentation, emit feedback only while processing the authoritative event, deduplicate within the active generation, and suppress cues for fast-forwarded or hidden presentation.