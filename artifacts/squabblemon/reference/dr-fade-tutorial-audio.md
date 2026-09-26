# Dr. Fade tutorial narration

The current tutorial uses the full September 25, 10:00:33 ElevenLabs recording plus the 10:10:25 replacement recording. The five pickups replace the starter collection introduction, round-one Plug selection, round-two Wifey selection, Dr. Fade's THE TRAP instruction, and the result recap. No Alice or Oz narration is used on the new-account route.

The full walkthrough has 40 ordered paragraphs and 15 Safehouse stops. All 40 paragraphs now have supplied narration. Four additional generic clips cover alternate recruits, card choices, and districts. Identical repeated paragraphs reuse their first matching take at runtime.

Original speech and delivery speed are preserved. Word timestamps were aligned to the script and checked against silence boundaries. Short edge fades and loudness normalization to -16 LUFS smooth transitions. Both original MP3s remain untouched. Each output has a source-and-cut revision in its URL so browsers do not reuse an older recording with the same cue name.

- Source hashes, file names, boundaries, and speeds: `dr-fade-tutorial-audio.json`.
- Runtime text, duration, and revision: `src/lib/tutorialVoiceClips.json`.
- Main script and cue order: `reference/dr-fade-tutorial-v2-cues.json` and `artifacts/deliverables/dr-fade-tutorial-v2-raw.txt` at the repository root.
- Five revised lines: `reference/dr-fade-tutorial-recording-updates.json`.
- Audio: `public/audio/voice/dr-fade/tutorial/` in Ogg Vorbis and AAC.

Rebuild from the repository root (source argument order is irrelevant; both hashes are validated before encoding):

```sh
python3 scripts/prepare-dr-fade-tutorial-audio.py /path/to/full.mp3 /path/to/pickups.mp3
node scripts/export-tutorial-recording.mjs
```

A new prompt cancels its previous queue. Mute and backgrounding pause speech. Returning or unmuting resumes it; autoplay denial retries on a gesture. Music ducks to 30% of the selected volume during narration and restores afterward. Text matching prevents a recorded card, cost, or district from contradicting the current prompt; unmatched mechanics remain text-only.

Checks from `artifacts/squabblemon`:

```sh
pnpm test:tutorial-voice
UI_ORIGIN=http://127.0.0.1:4199/squabblemon pnpm test:tutorial-voice-browser
```

The browser test exercises the welcome, all Safehouse stops, Legendary introduction, deck swap, and all four battle rounds on desktop Ogg and phone AAC, including mute, cancellation, and overlap protection. Fixtures are isolated from player accounts and real rewards.
