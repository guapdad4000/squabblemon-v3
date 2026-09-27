# First compositing review — all 100 characters

## Current integration status

The user subsequently requested all 100 renders implemented now and replaced over time. All 100 are now installed as provisional runtime defaults, preserving original quality and source audio. This supersedes the pre-integration approval gate below. The sampled visual findings remain a replacement queue; they are not marked repaired. Demario’s runtime title now reads **Special Delivery**, matching the approved tool-based retry. See `../../../squabblemon/reference/OPENART-SPECIALS.md` for assignments and the swap process.

Integration checks passed: all 100 clips play through the actual workshop controls; complete 5.167- and 8-second samples reach their endings; sound, CPU fallback, reduced motion, missing-media fallback and mobile layout work. Four battle cases pass animation, impact and cleanup checks. Targeted tests, type check, production build and all 100 built-media hashes pass. These checks were run locally before release; consult Git history for main-branch publication. Details: `runtime-verification.json` and `integration-coverage.json`.

The first-review observations below are retained as historical evidence.

All 100 requested non-fairytale characters have completed renders. Original outputs are staged locally with source generation IDs, URLs and SHA-256 hashes. The rejected mushroom-based Demario output is excluded; this review uses his tool-based Special Delivery retry.

## Verified

- 100/100 files fully decode and contain non-silent audio tracks. Total original media: 306,698,711 bytes.
- All outputs are H.264, 768 × 1344, 24 fps, with native audio. Preserve the delivered aspect ratio instead of stretching to nominal 9:16.
- 100/100 load, seek and advance playback in Chrome against the local review fixture.
- The actual game GPU shader and CPU fallback match exactly in alpha and opaque RGB at 300 tested timestamps (three per clip), at the game's 288-pixel canvas width.
- Review controls passed: mute/unmute, playback speed, saved notes and 390-pixel mobile layout. No browser runtime errors.
- Visually inspected eight sampled keyed frames per character beside reference art. Followed up 14 questionable title sequences at 4–8 frames per second.

These checks establish media and renderer behavior. They do not establish frame-by-frame creative acceptance, full-speed action continuity, subjective sound quality, or battle integration. At the time of that first review, no new clip was accepted or assigned. All 100 are now provisionally installed under the user’s later instruction above.

## Findings

**91 clips are flagged for background/compositing repair or closer inspection.** Common failures are black/white backing changes, opaque teal radial panels, speed streaks cut off at video edges, and residual translucent teal over the background. This is a review queue, not a recommendation to regenerate 91 clips. Foreground props and deliberate closeups are not automatically failures; the automated opaque-frame flags are only triage signals.

Specific defects:

- **Miami Surgeon:** current cyan key removes visible parts of teal scrub trousers. Protect the original costume with a foreground matte; increasing the global key threshold is not a safe fix.
- **Airheaded Model:** settled title repeats GATE: “WRONG GATE, GATE, GREAT LIGHTING.”
- **E.V. Enthusiast:** the hero obscures part of FREE throughout the settled title.
- **Squabble House Worker — Female and STUD:** solid black backing appears during the finish.
- **Inmate Contraband:** the finish switches to white backing.
- **Gas Station Sushi Chef:** the final tray closeup crops the face out rather than returning to a whole-character finish.
- **Demario:** video correctly says SPECIAL DELIVERY, but legacy ability copy still says Mushroom Delivery. Reconcile display copy when integrating without changing the gameplay effect.
- **Sherlock and Sports Prodigy:** rendered eight seconds but have historical five-second prompt headers; inspect pacing during full playback.

The following nine have no hard issue identified in the sampled-frame pass and are candidates for full motion/audio review: **Dr. Fade, BUDDY, Tattoo Artist, Bboy, Corrupt Pastor, Electrician Foreman, Homeless Legend, Inmate Informant and Watson.** This is not approval; short defects can occur between samples.

Detailed title follow-up cleared twelve preliminary concerns. Brief overshoot crops settle into readable titles, and the five titles initially absent from sparse samples are present in denser scans. Only the two confirmed title defects above remain flagged.

## Original repair recommendations (now a follow-up queue)

1. Review the nine candidates at full speed with sound, including light and dark keyed backdrops. Approve only after identity, action, title, finish and sound pass.
2. Pilot a protected matte on Miami Surgeon and remove the solid background changes on one affected clip. Compare the original and repaired result to preserve costume colors, ink edges, particles and the complete impact.
3. Use those proven repair methods for clips with the same defect. Do not broaden the live global chroma key to hide all source problems.
4. Repair title placement/spelling and the Demario display label. If a render needs regeneration, use its recorded generation and the specific failure; first validate one replacement before batching more.
5. Promote accepted files to runtime assets, register their exact duration and assignment, then verify ability playback, sound preference, reduced-motion fallback and the once-per-match gate in battles.

No new credits were spent during this review. Previous completed renders retain their historical golden-fist motifs; the later user instruction remains in effect for future generation prompts.

## Review tools

Open `http://localhost:4211/e2e/openart-specials.fixture.html` while the local Vite server is running. It shows the original video alongside the real GPU and CPU compositors, with scrubbing, slow motion, opt-in sound, light/dark backgrounds and per-generation notes. Notes stay in browser storage until exported and do not alter game assignments.

- `technical-audit.json`: hashes, original files, stream metadata, audio levels, sampled key metrics and dispositions.
- `visual-findings.json`: individual observations for all 100 characters, including title follow-ups.
- `browser-verification.json`: evidence for all 100 browser checks and 300 renderer comparisons.
- `raw/`: original video files, locally staged and excluded from Git.
- `sheets/`: sampled comparison sheets and detailed title scans, locally excluded from Git.

To rebuild media diagnostics, run `python3 artifacts/deliverables/openart-specials/review-specials.py` from the repository root. This refreshes the machine-generated audit; retain and re-merge `visual-findings.json` afterward. To rerun browser verification against the local server, run `node e2e/verify-openart-specials.mjs` from `artifacts/squabblemon`.
