# OpenArt special-animation production plan

> Superseded creative direction: use [RETRY-PLAN.md](RETRY-PLAN.md) for all new generations. The original three pilots were rejected for weak impact. Do not submit these old briefs.

Audit date: September 26, 2026. Engine snapshot: 1048674. Planning and asset preparation only; no generation jobs submitted or credits spent.

## What is missing

202 catalog cards: 78 have an enabled video assignment with its file present. 124 lack one: 108 characters, 6 support props, 10 Blockbusters. All 124 have a local reference portrait. See MISSING-LIST.md for every name and printed move, missing-specials.csv for reference paths and authoritative ability text, and coverage.json for the entire roster.

103 registered MP4s exist; 25 are not assigned to current catalog cards. Four additional files are old descriptive filenames, not proof of four new missing-character animations. Review unused clips for exact identity matches before spending, but do not assign a lookalike to a different character. This inventory checks registration and file presence, not every video's visual quality. Story NPCs, summons, alternate costumes, and cinematic scenes are separate from this base-card count.

Eight fairy-tale characters remain in the later-drop queue: Dorothy, Scarecrow, Tin Man, Lion, Oz, Alice, Cheshire, Queen of Hearts. That leaves 100 non-fairytale character gaps. Support cards and Blockbusters have separate briefs; they are not humanoid fighters.

## User-selected scope

Attempt all 100 non-fairytale characters today. Use TODAY-100.md, today-100.csv and today-100-jobs.json as the production queue: 3 pilots, 9 priority characters, then 11 batches of 8. No support, Blockbuster, or later-drop jobs in this run. A character counts as finished only after engine QA passes.

## Today's sequence

1. First 30–45 minutes: confirm OpenArt account/model availability, credits, queue limits, and per-job quote; inspect the priority reference art. Lock first-frame references with the safe framing below. Keep the approved face, outfit, proportions and props. Do not use screenshots containing card frames, stats or text.
2. Next 45–75 minutes: make THREE pilots—Dr. Fade (human/mentoring action), FOLKS (fire/VFX/keying), BUDDY (body shape and planted props). Use the same reference and prompt for a small model comparison if needed; then lock one successful model/settings preset. Choose from the account's actual image-to-video models; do not assume a model or price from an old list.
3. Import the three pilots into the actual special-move workshop and a battle BEFORE scaling up. Validate framing, cyan removal, native SFX, mute, skip, reduced motion, and phone readability. Reject failed pilots instead of carrying a bad preset into 100 jobs.
4. Next 2–3 hours: produce the priority batch (see FIRST-BATCH.md), keeping generation, review and import moving in batches of 6–10. Submit only as many concurrent jobs as the account supports. Persist job ID, model, prompt, settings, attempt, cost, reference hash, output file and QA result for every submission. Inspect completed jobs before retrying uncertain submissions.
5. Remaining work window: continue through all 100 non-fairytale characters. Supports, Blockbusters and later-drop characters are outside today's selected scope. Review every accepted clip; import batches as they pass. Reserve the final hour for real-battle verification and publishing. The target is the whole active queue, but a same-day finish is not guaranteed until the pilots establish throughput and rejection rate. A 12–20-character validated first delivery is a useful checkpoint, not permission to abandon the rest.

Budget math: 100 characters × average attempts × the account's quoted cost per generation, plus first-frame preparation if charged. At 2–3 attempts this is 200–300 video jobs. Budget the full 124-card scope separately. Recalculate remaining time and credits after the pilots; retries stop at the user's credit ceiling. No price or account capacity has been verified yet.

## Non-negotiable visual contract

- Illustrated, cel-shaded 2D fighting-game character; preserve reference identity, silhouette, costume, colors, anatomy, props and intentional aura. No live action, 3D makeover, extra fingers, wardrobe swaps, added characters, logos, captions or generated move-name lettering. Use character-specific visual motifs; do not introduce crowns. The active cinematic direction supersedes this plan's older text and camera restrictions.
- Locked camera: no zoom, pan, tilt, orbit, shake, cuts or reframing. Full body, both hands, both feet and every prop visible in EVERY frame. No entering/exiting the frame. Convey power through poses and contained effects.
- Proposed new master: portrait 9:16, 720×1280 minimum. Begin with character centered at 55–65% frame height. Entire moving silhouette and major VFX stay inside x=12–88%, y=10–90%; 10% outer border stays empty cyan. Wide poses/props need a smaller reference, not an optimistic prompt. Preserve aspect ratio in runtime; do not stretch legacy 3:4 files.
- Uniform, flat, unlit cyan RGB(0,255,255), #00FFFF from first to last frame. No room, floor, horizon, gradient, fog, vignette, backing shadows, background texture or lighting shift. Hard black/ink edges on warm-colored VFX. No full-screen flash or effect that replaces the backing.
- Cyan/turquoise character details are a PRE-GENERATION check: the current key removes pixels based on cyan dominance, not a background mask. Do not silently recolor an approved costume. Flag the character for a tested alternate key/matte workflow if its identity depends on cyan; test the pilot before allowing it into the standard cyan batch.
- One readable action: anticipation → motion → single clear impact → recovery/pose. No uncontrolled travel. Proposed 5-second master: 0–0.4 opening pose; 0.4–1.2 windup; 1.2–2.4 action/impact; 2.4–3.5 recovery; 3.5–4.5 full-body finisher; 4.5–5 hold. If the chosen model supports a different duration, render that duration and select an intact excerpt; do not speed up to hide a bad cut.
- Synchronized move SFX only: windup, whoosh, impact, character props. No music, narrator or invented catchphrase. Existing bespoke voiced specials retain their own approved direction. If the selected video model has no suitable audio, add designed SFX before acceptance; a silent result is not a finished special.

## Master prompt

Use the supplied approved character reference as the exact first-frame design. Create a 5-second 2D cel-shaded fighting-game special for [CHARACTER], called [PRINTED MOVE]. [ONE SPECIFIC CHOREOGRAPHY PARAGRAPH]. Preserve face, outfit, body proportions, colors and every identifying prop. Fixed camera, single uninterrupted full-body shot, portrait 9:16. Start with the character at 60% of frame height. Keep the entire moving character, hands, feet, props and effects inside the central 76% width and 80% height for the complete clip. No part touches or crosses an edge. Keep the outer 10% border empty. Solid uniform #00FFFF background throughout, no floor, no shadow on the backing, no gradient or scenery. Use clear ink outlines and warm-colored contained effects. Finish on a readable full-body pose and hold it. Synchronized action sound effects only, no music or speech. No camera movement, cuts, closeups, cropping, offscreen travel, text, logos, extra people, anatomy changes or color drift.

Use this as positive constraints plus a negative-prompt field only if the chosen model provides one. Prompts do not guarantee compliance: the acceptance checks below are mandatory.

## Export and engine integration

- Keep original OpenArt masters and job metadata outside the runtime folder. Export accepted runtime videos as MP4, H.264, yuv420p, constant 24 or 30 fps, faststart; AAC audio if present. Suggested size target ≤5 MB per 5-second runtime clip, visual inspection before acceptance. This is a new production target, not an existing engine hard limit.
- Use stable keys such as `oa-dr-fade-v1`, filename `oa-dr-fade-v1_chroma.mp4`, and map to ENGINE ID `drfade`, not catalog ID `dr-fade`. The CSV includes both IDs.
- Register in `src/specialMoves.json`: file, label, printed move, enabled, chroma="cyan", startSeconds, durationMs, playbackRate=1, content revision. Proposed default for the 5-second choreography: startSeconds=0.4, durationMs=4000; inspect each cut. Never allow start + duration×rate to exceed source length.
- Remove/update the corresponding forced-null entry in `src/specialMoves.ts` when approving that card. The Blockbuster blanket override also needs an intentional adjustment. Do not remove fallbacks for unanimated cards.
- Existing canvas preserves video ratio and caps its rendering width at 288px. Strong silhouettes and broad effects matter more than small details. Gameplay timings use the configured clip duration. No engine rewrite or sprite-sheet conversion is needed for this MP4 path.
- Extend/reuse `scripts/import-special-moves.cjs` only after registering new keys; the historical charNN scanner is not a complete validator for OpenArt filenames. Revisions must change whenever media bytes change.

## Acceptance gates

1. Metadata/decode: correct file, dimensions, fps, codec, audio, duration; valid excerpt; nonempty content hash.
2. Every-frame foreground-boundary scan using the same cyan-key rule as the engine: reject when opaque subject/effect pixels invade the protected border. This flags likely clipping; it does not prove feet/hands stayed intact. Human review checks the actual body/props throughout.
3. Backing/key review: inspect the keyed composite against light, dark and checkerboard surfaces. Reject holes in clothing, cyan halos, flicker, background debris or VFX erased by the key.
4. Identity/action review: compare against the latest approved portrait; inspect start, anticipation, impact and finisher, plus the complete motion at normal speed. A technically valid but generic or wrong-character clip fails.
5. Real engine: workshop and battle on desktop + small phone. Confirm correct character assignment, no clipping, readable effect, synchronized SFX, mute, skip, reduced motion, missing-file fallback, and cleanup between consecutive specials.
6. Only mark accepted and publish after these checks. Keep rejected masters and reasons locally so the next prompt fixes a specific problem.

OpenArt references checked for this plan: https://openart.ai/features/ai-image-to-video/ and https://github.com/OpenArt-AI/cli . OpenArt supports image-to-video with model-specific duration/aspect/resolution settings; its documented CLI offers model discovery, pricing, job history and asynchronous generation. CLI/account access was not configured during this planning pass.
