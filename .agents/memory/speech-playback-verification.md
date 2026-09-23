---
name: Speech playback verification
description: Avoid false lifecycle diagnoses and truncated speech exports when checking short voice cues.
---

When speech stops at the same word, inspect the decoded duration and compare it with the original recording before changing component cleanup. Preserve internal speech pauses; trim only the recording's outer edges when needed.

**Why:** A fight cue had been exported as just the first word even though its source contained the full line. Removing lobby cleanup could not restore words missing from the encoded asset.

**How to apply:** Verify both browser codec exports against the source and test actual native playback through `ended`, including navigation during playback. If upload names do not identify the cue, waveform correlation can establish provenance without guessing from duration.

Native audio can emit `pause` immediately before `ended` at its natural endpoint.

**Why:** A regression test that rejected every pause event incorrectly flagged uninterrupted full playback as a cutoff.

**How to apply:** Treat a pause as an interruption only if it occurs before the expected endpoint; also assert decoded duration and the final playback position, not just that `play()` was called.