# Snitch at the Corner

Scene 06 · Node `snitch-at-the-corner` · Revised screenplay, 2026-09-08.

Canon: [story bible](../../../STORY_BIBLE.md). Integration status: authored, not yet loaded into the game.

## 1. Stage

**Dramatic purpose:** Make Snitch's power transactional. Secure the player's final slot and prepare the return without revealing information Snitch never possessed.

Snitch has built a media desk on the hill from a folding table and an unopened air-fryer box. A homemade sign reads EXCLUSIVE, with the price crossed out twice and increased. A second phone buzzes; he hides it under the contender sheet. Red arrives as Snitch applies lip balm using the black screen of the player's match replay.

```yaml
parallaxSceneId: "block-party:snitch:corner"
venueId: "civic-hill-climb"
mood: "night"
durationMs: 6400
grain: 0.05
layers:
  - { id: "city-silhouette", depth: 0, parallaxX: 0.05, parallaxY: 0, widthFactor: 1.3, anchor: { x: 0.6, y: 0.6 } }
  - { id: "hill-guardrail", depth: 0.35, parallaxX: 0.3, parallaxY: 0.2, widthFactor: 1.3, anchor: { x: 0.6, y: 0.6 } }
  - { id: "street-lamp", depth: 0.6, parallaxX: 0.6, parallaxY: 0.2, widthFactor: 0.6, anchor: { x: 0.6, y: 0.6 } }
  - { id: "snitch", depth: 0.85, parallaxX: 0.9, parallaxY: 0.2, widthFactor: 0.6, anchor: { x: 0.6, y: 0.6 } }
  - { id: "phone", depth: 0.9, parallaxX: 0.95, parallaxY: 0.2, widthFactor: 0.6, anchor: { x: 0.3, y: 0.6 } }
cameraPath:
  - { x: 0.5, y: 0.5, zoom: 1.0, holdMs: 1800, ease: easeInOut }
  - { x: 0.6, y: 0.55, zoom: 1.2, holdMs: 2400, ease: easeInOut }
  - { x: 0.5, y: 0.6, zoom: 1.05, holdMs: 2200, ease: easeInOut }
```

These layers are a proposed art brief. The scene ID already exists, but its current layers/cues differ from this screenplay. Venue labels identify existing battle settings; the story venue registry still needs population. The 6.4-second camera move is an establishing shot only. Hold the last frame and advance dialogue on player input. Draw the dialogue box as UI, not text baked into art. Focus on `snitch` for the principal exchange; keep readable reaction shots for the other speaker.

## 2. Dialogue

Dialogue is player-advanced. Tokens match the current node/section/index convention; stage business is never spoken. This is the heightened comedy-drama revision.

### Before the match

```yaml
lines:
  - lineToken: "snitch-at-the-corner:pre:0"
    speaker: "Snitch"
    portraitAssetId: "assets/characters/snitch.webp"
    text: "Look who survived both sides. Independent crew, undefeated attitude. Your documentary just got a second episode."
  - lineToken: "snitch-at-the-corner:pre:1"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "Post the contender sheet. You are not the Department of Outside."
  - lineToken: "snitch-at-the-corner:pre:2"
    speaker: "Snitch"
    portraitAssetId: "assets/characters/snitch.webp"
    text: "One qualifier. Same as everybody. This is a professional operation."
  - lineToken: "snitch-at-the-corner:pre:3"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "You're sitting on an air fryer. Who asked you for the footage?"
  - lineToken: "snitch-at-the-corner:pre:4"
    speaker: "Snitch"
    portraitAssetId: "assets/characters/snitch.webp"
    text: "A returning customer. Very emotional demographic."
  - lineToken: "snitch-at-the-corner:pre:5"
    speaker: "Snitch"
    portraitAssetId: "assets/characters/snitch.webp"
    text: "I watched your matches. Round four, I get active. That's when the subscription renews."
  - lineToken: "snitch-at-the-corner:pre:6"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "Two extra Motion. Keep some for it. The ring light doesn't make him mysterious."
  - lineToken: "snitch-at-the-corner:pre:7"
    speaker: "Snitch"
    portraitAssetId: "assets/characters/snitch.webp"
    text: "Could you stop reading my damn business model out loud?"
```

### After victory

```yaml
lines:
  - lineToken: "snitch-at-the-corner:post:0"
    speaker: "Snitch"
    portraitAssetId: "assets/characters/snitch.webp"
    text: "Your slot's up. Don't tag me in the celebration. I'm rebranding."
  - lineToken: "snitch-at-the-corner:post:1"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "Who is the other finalist?"
  - lineToken: "snitch-at-the-corner:post:2"
    speaker: "Snitch"
    portraitAssetId: "assets/characters/snitch.webp"
    text: "They paid for an entrance. I'm contractually obligated to let this get messy."
  - lineToken: "snitch-at-the-corner:post:3"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "You made a contract?"
  - lineToken: "snitch-at-the-corner:post:4"
    speaker: "Snitch"
    portraitAssetId: "assets/characters/snitch.webp"
    text: "Voice note and a deposit. That's a contract with feelings."
```

### Defeat / retry — optional integration hook

```yaml
lines:
  - lineToken: "snitch-at-the-corner:defeat:0"
    speaker: "Snitch"
    portraitAssetId: "assets/characters/snitch.webp"
    text: "That ending needs work. Lucky for you, humiliation comes with unlimited reshoots."
```

**Exit:** A gospel-organ flourish blasts from upstairs, clips into static, and stops halfway through a chord. Heavy footsteps follow. Red looks up and goes still. Snitch snatches both phones off the air fryer. Whoever arranged the entrance has arrived.

## 3. Battle contract

```yaml
nodeId: "snitch-at-the-corner"
kind: "battle"
battleType: "mini-boss"
mechanicsSource: "lib/squabblemon-engine/src/story.ts#blockPartyChapter/snitch-at-the-corner"
mechanicalChanges: none
```

Existing reactive receipt deck; CPU hand size 4. Watching the Feed triggers once at round 4 and adds 2 CPU Motion. Dialogue telegraphs this deterministically; filming itself adds no mechanical effect.

**Rewards:** 175 street-xp; one additional ticket on the first three-star clear.

**Canonical stars:** win the encounter; finish holding all three districts; win without using SQUABBLE. Only victory is necessary for progression. Preserve this node's current map position, prerequisites, enemy cards, cinematic fallback, recommended collection, and teaching metadata in the engine.

## 4. Drama and director handoff

Snitch received a recent anonymous arrangement for the entrance; it did not tell him the rescue story. The reveal is not payment he withholds until the player wins. The match gates the tournament slot, not access to factual truth. Preserve the existing cinematic as fallback.

- Dialogue is complete for this scene's main route.
- Proposed layers and speaker staging require art review; this file does not certify assets as delivered.
- Dialogue/camera cue integration should use input-driven beats, with no fixed cue advancing unread text.
- Sound direction: venue ambience beneath conversation; lower crowd sound during personal exchanges. Optional hooks require an audio-bus mapping before use.
- Validate rewards and node identity against the existing engine at integration time. Do not copy obsolete unlock promises from the earlier templates.

