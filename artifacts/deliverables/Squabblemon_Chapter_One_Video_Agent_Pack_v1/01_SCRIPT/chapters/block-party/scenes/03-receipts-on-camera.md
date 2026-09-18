# Receipts on Camera

Scene 03 · Node `receipts-on-camera` · Revised screenplay, 2026-09-08.

Canon: [story bible](../../../STORY_BIBLE.md). Integration status: authored, not yet loaded into the game.

## 1. Stage

**Dramatic purpose:** Differentiate Red's demand for a complete record from Snitch's appetite for a useful edit. Win the player a publicly acknowledged route toward the final.

Red's court looks like a community-access courtroom. A phone sits beneath a cardboard rain hood labeled OFFICIAL MEDIA. Snitch has clipped a ring light onto the maintenance barrier and is trying to get a flattering angle on an argument that has not happened yet. Red places a kitchen timer beside the deck. Its ticking is much louder than necessary.

```yaml
parallaxSceneId: "block-party:red-side:receipts"
venueId: "red-fence-night-court"
mood: "night"
durationMs: 6400
grain: 0.05
layers:
  - { id: "night-sky", depth: 0, parallaxX: 0.05, parallaxY: 0, widthFactor: 1.3, anchor: { x: 0.6, y: 0.6 } }
  - { id: "red-fence", depth: 0.35, parallaxX: 0.3, parallaxY: 0.2, widthFactor: 1.3, anchor: { x: 0.6, y: 0.6 } }
  - { id: "maintenance-barrier", depth: 0.6, parallaxX: 0.6, parallaxY: 0.2, widthFactor: 0.6, anchor: { x: 0.6, y: 0.6 } }
  - { id: "ganger-red", depth: 0.85, parallaxX: 0.9, parallaxY: 0.2, widthFactor: 0.6, anchor: { x: 0.6, y: 0.6 } }
  - { id: "phone-stand", depth: 0.9, parallaxX: 0.95, parallaxY: 0.2, widthFactor: 0.6, anchor: { x: 0.3, y: 0.6 } }
cameraPath:
  - { x: 0.5, y: 0.5, zoom: 1.0, holdMs: 1800, ease: easeInOut }
  - { x: 0.6, y: 0.55, zoom: 1.2, holdMs: 2400, ease: easeInOut }
  - { x: 0.5, y: 0.6, zoom: 1.05, holdMs: 2200, ease: easeInOut }
```

These layers are a proposed art brief. This scene ID is proposed and requires registration. Venue labels identify existing battle settings; the story venue registry still needs population. The 6.4-second camera move is an establishing shot only. Hold the last frame and advance dialogue on player input. Draw the dialogue box as UI, not text baked into art. Focus on `ganger-red` for the principal exchange; keep readable reaction shots for the other speaker.

## 2. Dialogue

Dialogue is player-advanced. Tokens match the current node/section/index convention; stage business is never spoken. This is the heightened comedy-drama revision.

### Before the match

```yaml
lines:
  - lineToken: "receipts-on-camera:pre:0"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "I watched your match. Then I watched Blue explain your match. That's two different genres."
  - lineToken: "receipts-on-camera:pre:1"
    speaker: "Snitch"
    portraitAssetId: "assets/characters/snitch.webp"
    text: "His explanation got more views. Facts need better lighting."
  - lineToken: "receipts-on-camera:pre:2"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "Film both sides of the table. Last time your thumb had more screen time than the winner."
  - lineToken: "receipts-on-camera:pre:3"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "Middle district closes in round two. Both of us. That orange barrier ain't an aesthetic."
  - lineToken: "receipts-on-camera:pre:4"
    speaker: "Snitch"
    portraitAssetId: "assets/characters/snitch.webp"
    text: "Damn. You doing the safety briefing before the beatdown?"
  - lineToken: "receipts-on-camera:pre:5"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "I'm removing your excuses in alphabetical order."
  - lineToken: "receipts-on-camera:pre:6"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "Win and your name goes forward. Whole match stays up. No cousins in the comments demanding a recount."
```

### After victory

```yaml
lines:
  - lineToken: "receipts-on-camera:post:0"
    speaker: "Snitch"
    portraitAssetId: "assets/characters/snitch.webp"
    text: "I got the PERFECT title. LOCAL MAN HUMILIATED IN FRONT OF HIS OWN PHONE."
  - lineToken: "receipts-on-camera:post:1"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "Keep the beginning. They earned the win. You didn't discover it."
  - lineToken: "receipts-on-camera:post:2"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "Your name goes forward. One more Red Side test. Don't turn a good afternoon into a personality."
  - lineToken: "receipts-on-camera:post:3"
    speaker: "Snitch"
    portraitAssetId: "assets/characters/snitch.webp"
    text: "Too late. Blue's already posted a paragraph with no punctuation."
```

### Defeat / retry — optional integration hook

```yaml
lines:
  - lineToken: "receipts-on-camera:defeat:0"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "I explained the barrier. I pointed at the barrier. What part of orange betrayed you?"
```

**Exit:** Red writes down his own loss with painful precision. Snitch rotates the ring light toward him. Red rotates it straight back toward the table without looking up. The kitchen timer rings. Nobody ordered food.

## 3. Battle contract

```yaml
nodeId: "receipts-on-camera"
kind: "battle"
battleType: "rule-twist"
mechanicsSource: "lib/squabblemon-engine/src/story.ts#blockPartyChapter/receipts-on-camera"
mechanicalChanges: none
```

Existing aggressive receipt deck. Both players start with 2 Motion; middle lane locks in round 2; both receive the existing +2 power bonus in lane index 2. Keep engine timing and lane semantics unchanged.

**Rewards:** 100 street-xp; one additional ticket on the first three-star clear.

**Canonical stars:** win the encounter; finish holding all three districts; win without using SQUABBLE. Only victory is necessary for progression. Preserve this node's current map position, prerequisites, enemy cards, cinematic fallback, recommended collection, and teaching metadata in the engine.

## 4. Drama and director handoff

Red is demanding, not secretly fixing the match. Snitch's editing instinct foreshadows Chapter 4. The scene does not claim that a win makes the player's opinions true.

- Dialogue is complete for this scene's main route.
- Proposed layers and speaker staging require art review; this file does not certify assets as delivered.
- Dialogue/camera cue integration should use input-driven beats, with no fixed cue advancing unread text.
- Sound direction: venue ambience beneath conversation; lower crowd sound during personal exchanges. Optional hooks require an audio-bus mapping before use.
- Validate rewards and node identity against the existing engine at integration time. Do not copy obsolete unlock promises from the earlier templates.

