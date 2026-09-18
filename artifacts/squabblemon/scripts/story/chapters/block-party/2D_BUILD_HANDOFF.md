# Chapter One — the 2D build

The expanded screenplay is now integrated into the campaign. Open `/game/story` to play with a saved account or `/story-studio` to preview all scenes without account progress. The preview deliberately does not award rewards or simulate a victory.

## What is implemented

- 106 approved dialogue lines across eight nodes, including seven real card encounters. Each battle has an opening and a victory aftermath; the ceremony is its own scene.
- Reusable illustrated actors, breathing/sway animation, emphatic movement, listener reactions, cinematic landscape backgrounds, drifting light particles and scene-specific visual props.
- Player-controlled dialogue, transcript, skip, replay, resume after refresh, motion toggle, and operating-system reduced-motion support.
- Versioned dialogue markers preserve battle progress while avoiding collisions with the old short script.
- The campaign opens the existing deck selection and battle flow. Victory aftermath still depends on campaign clearance. Rewards and combat rules are unchanged.
- Chapter One no longer launches the old opening, encounter or finale videos. No generated videos or paid generation calls occur during play.

## Art and cost

The playable build reuses the existing WEBP character cutouts and landscape paintings. Native UI renders the editable signs and comic props. This is lightweight 2D puppet presentation, not a Live2D facial mesh or a voice/lip-sync system. Expressions currently come from posing, movement, focus and the source illustration; no replacement facial-expression sheets were generated.

The six reused landscapes are corner-store, moon-rooftop, red-court, gold-alley, civic-summit and crown-court. These are stylized interpretations; the corner-store plate depicts a diner, and several courts contain fantasy lighting. The existing Alley Runner art still shares Blue's sprite. Those are the remaining bespoke art jobs if the budget permits.

Two built-in image-generation calls attempted a distinct courier design and transparent cutout. Both returned RGB checkerboard artwork, so neither was installed as a gameplay sprite. The selected first concept is saved at `artifacts/story-2d-reference/alley-runner-concept.png`. It is a reference, not production-ready transparent art. No CLI or external paid API fallback was used.

Generation prompt: Create one full-body Black young adult courier, short twists, olive utility jacket with amber reflective accents, dark trousers, sneakers and crossbody satchel, angular painterly cel shading matching Ganger Blue's illustration style. Distinct identity; no weapon, blue bandana, logo or background. Request true transparent alpha with clean edges.

Edit prompt: Remove the checkerboard and white background; preserve the exact courier, hands and feet; return transparent alpha without floor, shadow or added elements.

## Source and verification

`scripts/integrate-chapter-one-2d.py` compiles the scene markdown into `lib/squabblemon-engine/src/chapterOneDialogue.ts`. Run it after approved script changes. The runtime uses `script-v3` dialogue markers; increment the revision for future incompatible script changes.

Presentation lives in `StoryStage.tsx` and `story-stage.css`; the campaign in `pages/game/Story.tsx`; the independent preview in `pages/StoryStudio.tsx`.

`scripts/verify-story-stage.mjs` checks all 15 scene sections, art responses, desktop/phone rendering, reduced motion and absence of video requests. Its controlled campaign API verifies failed saves, double-click protection, refresh resume, skip, replay without writes, battle routing and victory-only aftermath. This is browser integration coverage, not a live-account end-to-end server match.

The original handed-off video-agent ZIP remains unchanged. Chapter Two remains authored but unintegrated.
