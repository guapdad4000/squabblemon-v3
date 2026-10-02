---
name: Guided browser journeys
description: Source stability and explicit pauses in full first-session browser verification
---

Keep watched source files unchanged throughout a full first-session browser journey. Treat first-occurrence mechanic lessons as player-controlled pauses, not transient animations.

**Why:** Hot reload can reset an unsaved encounter without resetting the disposable account state, and lesson dialogs intentionally hold the presentation until acknowledged. Test-source and reference-asset edits can also reload a mounted screenplay fixture back to its first line, even when the story implementation itself is unchanged.

**How to apply:** Finish application, test, and reference-asset edits before running a real-control journey; do not assume test files are outside Vite's watched graph. Account for deliberate lesson pauses by using their visible controls, and reserve forced completion for tests that do not claim to verify the player's full match.