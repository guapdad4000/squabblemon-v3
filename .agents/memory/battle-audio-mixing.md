---
name: Battle audio mixing
description: Shared output clock and the boundary between automated playback checks and real phone audio mixing.
---

Keep the soundtrack and synthesized feedback on one browser audio output context while retaining separate nodes, volume controls, and cancellation lifecycles. Voice and special-video media remain independent media elements; never let their events drive music transport.

**Why:** Multiple Web Audio contexts can compete for mobile audio focus, while media-element playback may interrupt another element even when application code did not request a pause. Browser state tests cannot prove what comes out of a physical phone speaker.

**How to apply:** When changing battle sound, test track identity, position and pause/play events during concurrent cues and media. Preserve deliberate music pauses and autoplay denial. Follow automated tests with listening checks on physical iOS Safari and Android Chrome.