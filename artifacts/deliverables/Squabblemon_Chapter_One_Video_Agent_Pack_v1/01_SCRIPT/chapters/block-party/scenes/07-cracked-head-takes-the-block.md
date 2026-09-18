# Cracked Head Takes the Block

Scene 07 · Node `cracked-head-takes-the-block` · Revised screenplay, 2026-09-08.

Canon: [story bible](../../../STORY_BIBLE.md). Integration status: authored, not yet loaded into the game.

## 1. Stage

**Dramatic purpose:** Deliver the public return, show each brother's wound, and let the player resist Cracked Head's assumption of inherited authority.

Rooftop final. Snitch has taped gold gift wrap down as a red carpet; one corner is stuck to his shoe. The door swings open. Cracked Head stands in a cloud of smoke from the overworked fish-fry station downstairs, not a supernatural effect. Snitch jabs a soundboard. A huge organ chord lands, followed by a cheerful BATTERY LOW announcement. Blue reaches the landing, sees his brother, and stops so abruptly that Red nearly walks into him. Hold on his face. The joke has arrived at a real wound.

```yaml
parallaxSceneId: "block-party:cracked-head:finale"
venueId: "crown-rooftop-court"
mood: "rooftop"
durationMs: 6400
grain: 0.05
layers:
  - { id: "night-sky", depth: 0, parallaxX: 0.05, parallaxY: 0, widthFactor: 1.3, anchor: { x: 0.6, y: 0.6 } }
  - { id: "rooftop", depth: 0.35, parallaxX: 0.3, parallaxY: 0.2, widthFactor: 1.3, anchor: { x: 0.6, y: 0.6 } }
  - { id: "antenna", depth: 0.6, parallaxX: 0.6, parallaxY: 0.2, widthFactor: 0.6, anchor: { x: 0.6, y: 0.6 } }
  - { id: "cracked-head", depth: 0.85, parallaxX: 0.9, parallaxY: 0.2, widthFactor: 0.6, anchor: { x: 0.6, y: 0.6 } }
  - { id: "ganger-blue", depth: 0.9, parallaxX: 0.95, parallaxY: 0.2, widthFactor: 0.6, anchor: { x: 0.3, y: 0.6 } }
cameraPath:
  - { x: 0.5, y: 0.5, zoom: 1.0, holdMs: 1800, ease: easeInOut }
  - { x: 0.6, y: 0.55, zoom: 1.2, holdMs: 2400, ease: easeInOut }
  - { x: 0.5, y: 0.6, zoom: 1.05, holdMs: 2200, ease: easeInOut }
```

These layers are a proposed art brief. The scene ID already exists, but its current layers/cues differ from this screenplay. Venue labels identify existing battle settings; the story venue registry still needs population. The 6.4-second camera move is an establishing shot only. Hold the last frame and advance dialogue on player input. Draw the dialogue box as UI, not text baked into art. Focus on `cracked-head` for the principal exchange; keep readable reaction shots for the other speaker.

## 2. Dialogue

Dialogue is player-advanced. Tokens match the current node/section/index convention; stage business is never spoken. This is the heightened comedy-drama revision.

### Before the match

```yaml
lines:
  - lineToken: "cracked-head-takes-the-block:pre:0"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Oh, hell no. Not in the hoodie we buried on the flyer."
  - lineToken: "cracked-head-takes-the-block:pre:1"
    speaker: "Cracked Head"
    portraitAssetId: "assets/characters/cracked-head.webp"
    text: "What's good, little brother?"
  - lineToken: "cracked-head-takes-the-block:pre:2"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "WHAT'S GOOD? I put your face on shirts! I argued with the printer about your damn hairline!"
  - lineToken: "cracked-head-takes-the-block:pre:3"
    speaker: "Cracked Head"
    portraitAssetId: "assets/characters/cracked-head.webp"
    text: "Blue. I'm standing right here."
  - lineToken: "cracked-head-takes-the-block:pre:4"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "That's the problem! We had a memorial! There was a slideshow! You smiled in transition number SIX!"
  - lineToken: "cracked-head-takes-the-block:pre:5"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "Snitch. Camera down. Right now."
  - lineToken: "cracked-head-takes-the-block:pre:6"
    speaker: "Snitch"
    portraitAssetId: "assets/characters/snitch.webp"
    text: "I'm live on two phones. I don't even know which one to disappoint first."
  - lineToken: "cracked-head-takes-the-block:pre:7"
    speaker: "Cracked Head"
    portraitAssetId: "assets/characters/cracked-head.webp"
    text: "Let it run. Everybody got something to say about me. They can say it while I'm here."
  - lineToken: "cracked-head-takes-the-block:pre:8"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Four years, no call. But you found the championship? Your GPS don't work for family?"
  - lineToken: "cracked-head-takes-the-block:pre:9"
    speaker: "Cracked Head"
    portraitAssetId: "assets/characters/cracked-head.webp"
    text: "I came back for what's mine."
  - lineToken: "cracked-head-takes-the-block:pre:10"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "That chair ain't yours. They earned it. You want the Crown, play the finalist."
  - lineToken: "cracked-head-takes-the-block:pre:11"
    speaker: "Cracked Head"
    portraitAssetId: "assets/characters/cracked-head.webp"
    text: "All right, new face. Pull up. Let's see if the block got better or just louder."
```

### After victory

```yaml
lines:
  - lineToken: "cracked-head-takes-the-block:post:0"
    speaker: "Cracked Head"
    portraitAssetId: "assets/characters/cracked-head.webp"
    text: "You got me. Crown's yours. Don't make me regret saying it in front of all these phones."
  - lineToken: "cracked-head-takes-the-block:post:1"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Look at that. He can acknowledge a stranger. Somebody get this miracle on the church calendar."
  - lineToken: "cracked-head-takes-the-block:post:2"
    speaker: "Cracked Head"
    portraitAssetId: "assets/characters/cracked-head.webp"
    text: "Blue, give me a damn minute."
  - lineToken: "cracked-head-takes-the-block:post:3"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "You had four years. That's a lot of damn minutes."
  - lineToken: "cracked-head-takes-the-block:post:4"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "The result stands. Family meeting is a different table."
  - lineToken: "cracked-head-takes-the-block:post:5"
    speaker: "Cracked Head"
    portraitAssetId: "assets/characters/cracked-head.webp"
    text: "I'll be back at this one."
  - lineToken: "cracked-head-takes-the-block:post:6"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "Then sign up. The ghost discount expired."
```

### Defeat / retry — optional integration hook

```yaml
lines:
  - lineToken: "cracked-head-takes-the-block:defeat:0"
    speaker: "Cracked Head"
    portraitAssetId: "assets/characters/cracked-head.webp"
    text: "You chasing every district like somebody yelled FREE PLATES. Pick your ground."
```

### Optional spoken phase cues

Retain existing one-time gameplay telegraphs. Spoken cues need integration.

- `territory-claim` — Cracked Head: “Slide that over. I used to sit right here.”
- `pressure-cooker` — Cracked Head: “Oh, you comfortable? Let me fix that.”
- `last-call` — Cracked Head: “One more coming through. Don't nobody start packing up.”

**Exit:** Cracked Head offers Blue a hand. Blue looks at it as if it has arrived four years late with no tracking number, then walks past him. Snitch's soundboard accidentally plays APPLAUSE. Red unplugs it. Cracked Head moves his deck out of the winner's space.

## 3. Battle contract

```yaml
nodeId: "cracked-head-takes-the-block"
kind: "battle"
battleType: "boss"
mechanicsSource: "lib/squabblemon-engine/src/story.ts#blockPartyChapter/cracked-head-takes-the-block"
mechanicalChanges: none
```

Keep existing combo-boss deck and all three one-time phases: Territory Claim at round 1 adds 1 CPU Motion; Pressure Cooker when the player holds two districts adds 2 CPU power in the middle; Last Call at round 5 adds a Snow reinforcement. CPU starting Motion bonus remains 2. Existing phase names/descriptions provide mechanical telegraphs; new spoken phase cues below are optional.

**Rewards:** 250 street-xp; one additional ticket on the first three-star clear.

**Canonical stars:** win the encounter; finish holding all three districts; win without using SQUABBLE. Only victory is necessary for progression. Preserve this node's current map position, prerequisites, enemy cards, cinematic fallback, recommended collection, and teaching metadata in the engine.

## 4. Drama and director handoff

All legal wins receive the same canonical post-battle exchange. Do not hide the season promise behind three stars. The player does not resolve the family feud by winning. Play the entrance at full ridiculous scale, then hold Blue's anger long enough for the four-year absence to hurt. Cracked Head's appearance is real and present-day, not a ghost, simulation, or unannounced flashback.

- Dialogue is complete for this scene's main route.
- Proposed layers and speaker staging require art review; this file does not certify assets as delivered.
- Dialogue/camera cue integration should use input-driven beats, with no fixed cue advancing unread text.
- Sound direction: venue ambience beneath conversation; lower crowd sound during personal exchanges. Optional hooks require an audio-bus mapping before use.
- Validate rewards and node identity against the existing engine at integration time. Do not copy obsolete unlock promises from the earlier templates.


