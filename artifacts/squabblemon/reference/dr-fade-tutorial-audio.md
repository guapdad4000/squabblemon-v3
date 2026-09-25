# Dr. Fade tutorial narration

The revised Safehouse walkthrough now has 15 stops, including the left-wall TV, record player, back-left Growth Lab, profile shelf, mail door, bag, training, Fadecade, phone, and bounties. `src/lib/safehouseTour.json` is its text and target source. New text intentionally remains silent until replacement audio is supplied; old recordings still play only when the displayed words match.

Run `node scripts/export-tutorial-recording.mjs` from the workspace root to produce the 40-paragraph main-path recording script at `artifacts/deliverables/dr-fade-tutorial-v2-raw.txt` and its ordered cue map at `reference/dr-fade-tutorial-v2-cues.json`. The raw file contains only spoken lines, including repeated prompts. The cue map marks new recordings. This is the default fresh-player route; variable battle choices and optional mechanics retain the existing text-matched/generic audio behavior below. The original 31-paragraph recording and exports remain intact.

The supplied ElevenLabs recording is split into 31 paragraphs, plus four generic pickups cut from those same takes. Original speech is preserved; longer clips use pitch-preserving 1.06× or 1.12× tempo. Clips have trimmed outer silence, normalized loudness, and short edge fades. The source recording is untouched.

- Audio: `public/audio/voice/dr-fade/tutorial/` (Ogg Vorbis and AAC).
- Source hash, cut boundaries, and speeds: `dr-fade-tutorial-audio.json` beside this file.
- Runtime text and durations: `src/lib/tutorialVoiceClips.json`.
- User exports: `artifacts/deliverables/dr-fade-tutorial-vo-edited.mp3` and `dr-fade-tutorial-vo-clips.zip` at the repository root.

The welcome, Safehouse tour, Legendary introduction, deck lesson, battle prompts, matching result advice, and completion screen trigger narration. Identical repeated prompts reuse the first take. Text matching prevents a recorded card name, cost, or district from contradicting the current game state. The four generic pickups cover changed recruits, card choices, and districts. Unrecorded mechanic lessons and other result branches remain text-only.

Changing a prompt cancels its previous queue. Mute and backgrounding pause speech; returning or unmuting resumes it. Autoplay denial retries on the next gesture. Music temporarily drops to 30% of the user's chosen volume while narration plays and restores afterward. Generic Safehouse, SQUABBLE, and result voice cues are suppressed during guided narration.

Rebuild assets from the repository root:

```sh
python3 scripts/prepare-dr-fade-tutorial-audio.py /path/to/original-recording.mp3
```

Checks from `artifacts/squabblemon`:

```sh
pnpm test:tutorial-voice
UI_ORIGIN=http://127.0.0.1:4198 pnpm test:tutorial-voice-browser
```

The browser check needs a running Vite server and Playwright Chromium. `BROWSER_EXECUTABLE` can select an existing compatible Chrome installation. It exercises real playback and clicks on desktop and phone, both codecs, sequential clips, mute, cancellation, and all four battle rounds using isolated fixtures.

Verified: TypeScript, production build and bundle budget, 83 audio/music/battle/tutorial tests, desktop Ogg playback, and phone AAC playback. The existing synchronous CSS test loader is incompatible with this host's Node 22 loader chain; the combined component test run used an equivalent temporary asynchronous CSS loader. The dedicated tutorial voice test command runs without that loader.
