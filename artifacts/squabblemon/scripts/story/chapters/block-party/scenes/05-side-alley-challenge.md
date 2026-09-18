# Side Alley Challenge

Scene 05 · Node `side-alley-challenge` · Revised screenplay, 2026-09-08.

Canon: [story bible](../../../STORY_BIBLE.md). Integration status: authored, not yet loaded into the game.

## 1. Stage

**Dramatic purpose:** Give independent crews a voice and reward curiosity without making the optional route necessary to understand the plot.

An alley table rests on a courier bag and a folded eviction flyer someone has crossed out and rewritten as EVENT FLYER. Alley Runner is sorting deliveries while Cornball has returned to the vending machine with a clipboard. He has listed himself as lead investigator, key witness, and refreshments coordinator. This optional scene can happen any time after Blue Side Pressure; no dialogue assumes whether the Crown has been won.

```yaml
parallaxSceneId: "block-party:side-alley:challenge"
venueId: "corner-store-court"
mood: "alley"
durationMs: 6400
grain: 0.05
layers:
  - { id: "alley-wall", depth: 0, parallaxX: 0.05, parallaxY: 0, widthFactor: 1.3, anchor: { x: 0.6, y: 0.6 } }
  - { id: "service-gate", depth: 0.35, parallaxX: 0.3, parallaxY: 0.2, widthFactor: 1.3, anchor: { x: 0.6, y: 0.6 } }
  - { id: "side-table", depth: 0.6, parallaxX: 0.6, parallaxY: 0.2, widthFactor: 0.6, anchor: { x: 0.6, y: 0.6 } }
  - { id: "alley-runner", depth: 0.85, parallaxX: 0.9, parallaxY: 0.2, widthFactor: 0.6, anchor: { x: 0.6, y: 0.6 } }
  - { id: "cornball", depth: 0.9, parallaxX: 0.95, parallaxY: 0.2, widthFactor: 0.6, anchor: { x: 0.3, y: 0.6 } }
cameraPath:
  - { x: 0.5, y: 0.5, zoom: 1.0, holdMs: 1800, ease: easeInOut }
  - { x: 0.6, y: 0.55, zoom: 1.2, holdMs: 2400, ease: easeInOut }
  - { x: 0.5, y: 0.6, zoom: 1.05, holdMs: 2200, ease: easeInOut }
```

These layers are a proposed art brief. This scene ID is proposed and requires registration. Venue labels identify existing battle settings; the story venue registry still needs population. The 6.4-second camera move is an establishing shot only. Hold the last frame and advance dialogue on player input. Draw the dialogue box as UI, not text baked into art. Focus on `alley-runner` for the principal exchange; keep readable reaction shots for the other speaker.

## 2. Dialogue

Dialogue is player-advanced. Tokens match the current node/section/index convention; stage business is never spoken. This is the heightened comedy-drama revision.

### Before the match

```yaml
lines:
  - lineToken: "side-alley-challenge:pre:0"
    speaker: "Alley Runner"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Main route's over there. This table's optional. I know. A choice. We don't get many of those around here."
  - lineToken: "side-alley-challenge:pre:1"
    speaker: "Cornball"
    portraitAssetId: "assets/characters/cornball.webp"
    text: "I've opened a case against this machine. Three dollars missing. Suspect refuses to blink."
  - lineToken: "side-alley-challenge:pre:2"
    speaker: "Alley Runner"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "That's the display window. Your drink's behind the flap."
  - lineToken: "side-alley-challenge:pre:3"
    speaker: "Cornball"
    portraitAssetId: "assets/characters/cornball.webp"
    text: "Then why they got it behind glass like a damn museum piece?"
  - lineToken: "side-alley-challenge:pre:4"
    speaker: "Alley Runner"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Win here, you get a cardback tag. No crew tax. No uncle you gotta impress."
  - lineToken: "side-alley-challenge:pre:5"
    speaker: "Alley Runner"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Watch the whole table. I move around. Unlike your boy's investigation."
```

### After victory

```yaml
lines:
  - lineToken: "side-alley-challenge:post:0"
    speaker: "Alley Runner"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Tag's yours. If anybody asks what side you're on, show 'em the back of the card."
  - lineToken: "side-alley-challenge:post:1"
    speaker: "Cornball"
    portraitAssetId: "assets/characters/cornball.webp"
    text: "Got my drink. Room temperature. That's how they serve revenge."
  - lineToken: "side-alley-challenge:post:2"
    speaker: "Alley Runner"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Watch Snitch. He waits till people run out of answers, then starts acting like he invented the question."
  - lineToken: "side-alley-challenge:post:3"
    speaker: "Cornball"
    portraitAssetId: "assets/characters/cornball.webp"
    text: "He charged me to correct my own birthday post."
  - lineToken: "side-alley-challenge:post:4"
    speaker: "Alley Runner"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Keep something for the late rounds. Let him interview the loss."
```

### Defeat / retry — optional integration hook

```yaml
lines:
  - lineToken: "side-alley-challenge:defeat:0"
    speaker: "Alley Runner"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Run it back. Only thing charging interest here is that man's grudge against a soda machine."
```

**Exit:** Cornball takes a sip, studies the label, and discovers he has spent the evening fighting for unsweetened sparkling water. Alley Runner quietly passes him a packet of sugar from the courier bag. Cornball regards it as an insult and pockets it anyway.

## 3. Battle contract

```yaml
nodeId: "side-alley-challenge"
kind: "battle"
battleType: "standard"
mechanicsSource: "lib/squabblemon-engine/src/story.ts#blockPartyChapter/side-alley-challenge"
mechanicalChanges: none
```

Existing movement-profile opponent Alley Runner, using the existing Red deck. Optional and never a prerequisite for a required node. No vending-machine enemy, item check, or new mechanic.

**Rewards:** side-alley-tagged-cardback cosmetic; one additional ticket on the first three-star clear.

**Canonical stars:** win the encounter; finish holding all three districts; win without using SQUABBLE. Only victory is necessary for progression. Preserve this node's current map position, prerequisites, enemy cards, cinematic fallback, recommended collection, and teaching metadata in the engine.

## 4. Drama and director handoff

The vending-machine investigation escalates into a sparkling-water anticlimax, not a new opponent. Snitch's strategic warning is supplemental: Scene 6 independently explains his round-four pressure. Ceremony dialogue works whether or not this scene was played.

- Dialogue is complete for this scene's main route.
- Proposed layers and speaker staging require art review; this file does not certify assets as delivered.
- Dialogue/camera cue integration should use input-driven beats, with no fixed cue advancing unread text.
- Sound direction: venue ambience beneath conversation; lower crowd sound during personal exchanges. Optional hooks require an audio-bus mapping before use.
- Validate rewards and node identity against the existing engine at integration time. Do not copy obsolete unlock promises from the earlier templates.

