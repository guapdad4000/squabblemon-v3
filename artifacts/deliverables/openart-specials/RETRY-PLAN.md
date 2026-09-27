# Special animation retry plan — spectacle with clean compositing

Status: planning only. No retry generations submitted. MiniMax H3 remains the selected model. The first three pilots were rejected by the user for weak creative impact; none is approved for runtime use. This document supersedes the creative direction, timing and text restrictions in PLAN.md and FIRST-BATCH.md. Their inventory and engine integration notes remain useful.

## What the existing specials establish

Visual evidence: sampled frame sequences from OG Uncle (char45), GUAP (char91), Simmy (char93), and KYLE (char103). This is a visual analysis, not a completed audio or live battle composite review.

- OG Uncle: cane anticipation and impact, then an oversized newspaper headline as the character-specific punchline.
- GUAP: compressed charging pose, expanding golden energy, enormous winged reveal, then FINNAM! lettering held over the payoff.
- Simmy: roses build and move forward, a broken-heart emblem and HEARTBREAK lettering dominate the impact, then a confident reaction.
- KYLE: crouch, smiley-bomb swarm, giant smiley explosion, then SUPER DUPER! beside the finishing pose.
- Shared visual language: bold uppercase comic lettering, thick black outlines, angled composition, bursts, abrupt changes in scale and a readable final tableau. Not every move needs the same attack choreography.
- Compositing weakness: speed lines and opaque backgrounds reach the source rectangle. Those non-cyan pixels survive cyan keying and can reveal the rectangle. Verify in engine; do not call this a confirmed live rendering defect from source frames alone.

## Creative standard

Every move needs five beats: character attitude, anticipation, rapid escalation, signature impact with a text slam, and an expressive finishing pose. An effect may occupy most of the usable frame. Keep the body legible at the payoff; preserve identity and intentional costume markings. No crowns.

Remove the old requirements for tiny effects, a single weak impact, an early return to idle, and no lettering. Keep full-body framing and a clean cyan backing. Create apparent scale through pose changes, prop motion, expanding effects and bounded foreshortening; do not rely on camera cropping.

Target a 7-second master, subject to a fresh model quote/settings check. The existing reference clips are roughly 6.6 seconds. Suggested beats: 0–0.6 attitude, 0.6–1.8 anticipation, 1.8–3.2 escalation, 3.2–4.4 signature impact/title, 4.4–6.2 payoff and settling effects, 6.2–7 finishing hold. These are directing guides; avoid forcing all characters into identical motions. Inspect the complete output before choosing runtime start/duration. Do not retain the old automatic four-second excerpt.

## Three revised pilots

| Character | Action and escalation | Signature payoff | Text and ending |
|---|---|---|---|
| Dr. Fade — The First Lesson | A knowing instructor stance, then a visibly compressed windup. Two sharp bag strikes establish a rhythm before a decisive rising glove strike. Keep the whole training bag and its support detail inside frame. | A huge gold glove-shaped impact and layered ink arcs flare around the bag. The bag recoils visibly; Dr. Fade remains planted and readable. | THE FIRST LESSON slams above him at the strongest impact. He settles into a composed teaching gesture, as if that spectacular display was easy. |
| FOLKS — Whole Block Hot | A low coiled stance draws orange-red fire tightly around the forearms. A forceful downward double-fist motion releases it into expanding layers. | A towering fire crest and broad radial fire burst make the jump from compressed energy to overwhelming release unmistakable. Black outlines and warm highlights preserve the effect after keying. | WHOLE BLOCK HOT hits with the eruption. He holds a powerful stance while embers settle; no immediate retreat to a tiny aura. |
| BUDDY — Buddy Buds | A relaxed planting gesture becomes a surprising surge: three distinct buds rise rapidly on thick curling vines, framing his complete body. Keep the flask and bag consistent with the reference. | The three oversized buds burst open in a staggered rhythm, then peak together in a lush leaf-and-pollen flourish. This is an exaggerated growth/support special, not an unrelated stone-fist attack. | BUDDY BUDS lands on the final bloom. He finishes with casual confidence beneath the enormous growth, preserving his character's personality. |

## Text and speed-line treatment

Use one shared comic lettering direction: heavy condensed uppercase, thick black outline, warm white/gold fill, a small dark offset extrusion, and a slight upward angle. Allow line breaks for long move names; keep words clear at the engine's actual display size. One exact title per move, no random lettering or extra catchphrases.

First test generated lettering as part of the animated impact. Misspelled, unstable, or unreadable lettering fails. If animation is strong but generated typography is the only failure, use a text-free take and composite a consistent transparent title animation into the final MP4 locally. Do not stack corrected text over garbled text. This fallback preserves the current video interface and needs no battle-engine title feature.

Speed lines should radiate from the action as short, disconnected, tapered strokes. Every stroke ends before the source edge. Never create an opaque rectangular manga panel, a vignette, a frame-wide burst backing or lines anchored to the four image edges. Localized white impact cores are allowed; full-frame white flashes are not.

## Technical guardrails

- Reference identity first: approved face, costume, anatomy, props and silhouette. Recompose the reference rather than copying its original background or crop.
- Portrait 9:16, 768P pilot, MiniMax H3. Check current supported settings and quote for seven seconds before submitting. No automatic prompt enhancement if that could weaken the art direction.
- Locked camera; full body and all important props stay inside the frame throughout. Character starts around 55–60% of frame height, leaving expansion room. Ordinary overlap during choreography is fine; edge cropping and missing limbs are not.
- Keep a clear cyan safety margin around the complete foreground: target at least 5% on each edge. The old 10% plus central-box restrictions unnecessarily reduced available spectacle. Foreground can fill the remaining area, but must terminate naturally before that margin.
- Flat #00FFFF backing throughout. No scene, floor plane, background shadow, gradient, opaque smoke wall or scenery. Avoid cyan/turquoise effects. Never silently recolor a character's costume to suit the key.
- Audio should build with the action: anticipation, accelerating whooshes, rhythmic impacts, a distinct strongest hit, and a short settling tail. No music or new spoken catchphrase. Evaluate the actual output; add designed SFX if necessary.
- Export accepted clips through the current H.264 MP4 path. Preserve aspect ratio, inspect duration, and revise registration only after acceptance. No engine rewrite is required for baked-in lettering.

## Retry order and decision gates

1. Retry Dr. Fade first, one output. It tests anatomy, props, humor, oversized impact and text in the same clip. Record fresh quote, settings, prompt and job ID before moving on. No new credit estimate is asserted here.
2. Review the full clip at normal speed and with sound, then inspect impact frames and the keyed result on dark/light backgrounds in the actual engine. Compare directly with the existing finishers at the same display size.
3. It passes only if the anticipation is obvious, the payoff feels substantially larger than the setup, the title reads, the ending has personality, and the composite has no rectangle, clipping or damaged costume. Technical validity alone is not acceptance.
4. Use that result to refine the shared direction, then retry FOLKS and BUDDY once each. These separately stress-test fire and complex plant silhouettes. Keep the first rejected masters for reference; never overwrite them.
5. Review the three pilots with the user before scaling to the remaining 97. Then produce the nine priority characters followed by the remaining queue in batches of eight, checking each batch before submitting the next. Write a distinct motif and payoff for each character before generation; do not reuse one punch with swapped colors.
6. Categorize failures as creative, identity/anatomy, framing/key, text, or sound. Fix the specific failed dimension instead of weakening every prompt. Preserve successful choreography when possible. Do not submit a third attempt for the same unresolved failure without changing the approach.

Scope remains all 100 non-fairytale characters. Support cards, Blockbusters and later-drop fairy-tale characters remain outside this run. Today is a production target, not a guarantee; update throughput and remaining credit estimates after accepted pilots. A clip counts as complete only after visual, audio and real-engine QA.
