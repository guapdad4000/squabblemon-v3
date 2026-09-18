# Welcome to the Block

Scene 01 · Node `welcome-to-the-block` · Revised screenplay, 2026-09-08.

Canon: [story bible](../../../STORY_BIBLE.md). Integration status: authored, not yet loaded into the game.

## 1. Stage

**Dramatic purpose:** The player discovers that the Open has gatekeepers and accepts a fair, limited challenge. Blue's confidence comes from controlling the room, not cruelty.

Late afternoon. Somebody has cable-tied a red carpet to the corner-store fence. Half the OPEN ENTRY sign is covered by Blue's jacket; underneath it, Cornball has taped a handwritten VIP sign to the vending machine. He is addressing the machine through a karaoke microphone that is absolutely not plugged in. The player walks up with a deck. Blue puts on sunglasses to inspect them, then takes them off because the price sticker is still on one lens.

```yaml
parallaxSceneId: "block-party:opening:alley"
venueId: "corner-store-court"
mood: "block"
durationMs: 6400
grain: 0.05
layers:
  - { id: "sky", depth: 0, parallaxX: 0.05, parallaxY: 0, widthFactor: 1.3, anchor: { x: 0.6, y: 0.6 } }
  - { id: "storefront", depth: 0.35, parallaxX: 0.3, parallaxY: 0.2, widthFactor: 1.3, anchor: { x: 0.6, y: 0.6 } }
  - { id: "vending-machine", depth: 0.6, parallaxX: 0.6, parallaxY: 0.2, widthFactor: 0.6, anchor: { x: 0.6, y: 0.6 } }
  - { id: "ganger-blue", depth: 0.85, parallaxX: 0.9, parallaxY: 0.2, widthFactor: 0.6, anchor: { x: 0.6, y: 0.6 } }
  - { id: "cornball", depth: 0.9, parallaxX: 0.95, parallaxY: 0.2, widthFactor: 0.6, anchor: { x: 0.3, y: 0.6 } }
cameraPath:
  - { x: 0.5, y: 0.5, zoom: 1.0, holdMs: 1800, ease: easeInOut }
  - { x: 0.6, y: 0.55, zoom: 1.2, holdMs: 2400, ease: easeInOut }
  - { x: 0.5, y: 0.6, zoom: 1.05, holdMs: 2200, ease: easeInOut }
```

These layers are a proposed art brief. The scene ID already exists, but its current layers/cues differ from this screenplay. Venue labels identify existing battle settings; the story venue registry still needs population. The 6.4-second camera move is an establishing shot only. Hold the last frame and advance dialogue on player input. Draw the dialogue box as UI, not text baked into art. Focus on `ganger-blue` for the principal exchange; keep readable reaction shots for the other speaker.

## 2. Dialogue

Dialogue is player-advanced. Tokens match the current node/section/index convention; stage business is never spoken. This is the heightened comedy-drama revision.

### Before the match

```yaml
lines:
  - lineToken: "welcome-to-the-block:pre:0"
    speaker: "Cornball"
    portraitAssetId: "assets/characters/cornball.webp"
    text: "This machine stole my three dollars. I am outside its place of business demanding accountability."
  - lineToken: "welcome-to-the-block:pre:1"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Who you with? And don't say yourself. Everybody bringing themselves. That's the problem."
  - lineToken: "welcome-to-the-block:pre:2"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "No Blue. No Red. You just showed up unseasoned?"
  - lineToken: "welcome-to-the-block:pre:3"
    speaker: "Cornball"
    portraitAssetId: "assets/characters/cornball.webp"
    text: "The sign says OPEN, Blue. You can't put a jacket over a vowel and start a private school."
  - lineToken: "welcome-to-the-block:pre:4"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Beat me, you get a slot. Lose, get back in line. This ain't your cousin's mixtape release. Everybody don't get a turn."
  - lineToken: "welcome-to-the-block:pre:5"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Two districts wins it. Don't make me say it twice."
  - lineToken: "welcome-to-the-block:pre:6"
    speaker: "Cornball"
    portraitAssetId: "assets/characters/cornball.webp"
    text: "He said it eleven times in the car. We missed the exit because he wanted bass under it."
  - lineToken: "welcome-to-the-block:pre:7"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Deck. Table. Now. Before I charge your commentator a vendor fee."
```

### After victory

```yaml
lines:
  - lineToken: "welcome-to-the-block:post:0"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Okay. You got a slot. Don't be standing there looking like you just bought me."
  - lineToken: "welcome-to-the-block:post:1"
    speaker: "Cornball"
    portraitAssetId: "assets/characters/cornball.webp"
    text: "First day outside and already somebody's supervisor. That's nasty work."
  - lineToken: "welcome-to-the-block:post:2"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Come through Blue Side if you want more than a name on this sheet."
  - lineToken: "welcome-to-the-block:post:3"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "And don't write CHAMPION in the nickname box. I know how y'all get."
```

### Defeat / retry — optional integration hook

```yaml
lines:
  - lineToken: "welcome-to-the-block:defeat:0"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "You spread that hand out like one paycheck across six bills. Pick two districts and come back."
```

**Exit:** Blue snatches his jacket off the sign so hard the VIP sign falls off the machine. Cornball catches it and wears it as a badge. The drink drops halfway, stops, and stays there. Cornball turns his dead microphone toward it for a response.

## 3. Battle contract

```yaml
nodeId: "welcome-to-the-block"
kind: "battle"
battleType: "guided"
mechanicsSource: "lib/squabblemon-engine/src/story.ts#blockPartyChapter/welcome-to-the-block"
mechanicalChanges: none
```

Unmodified guided encounter against Ganger Blue's existing balanced deck. Teach district scoring and Motion. Winning any legal way advances; a perfect clear is optional.

**Rewards:** 50 street-xp. A first three-star clear additionally earns one Street Pack Ticket. No character unlock is configured.

**Canonical stars:** win the encounter; finish holding all three districts; win without using SQUABBLE. Only victory is necessary for progression. Preserve this node's current map position, prerequisites, enemy cards, cinematic fallback, recommended collection, and teaching metadata in the engine.

## 4. Drama and director handoff

Establish the sign and the entry sheet visibly. The player's participation accepts the stated challenge; no dialogue choice is required. Cornball's fake investigation and Blue's self-important entrance establish the broad comic scale. Cornball's drink is optional texture, never a progression item.

- Dialogue is complete for this scene's main route.
- Proposed layers and speaker staging require art review; this file does not certify assets as delivered.
- Dialogue/camera cue integration should use input-driven beats, with no fixed cue advancing unread text.
- Sound direction: venue ambience beneath conversation; lower crowd sound during personal exchanges. Optional hooks require an audio-bus mapping before use.
- Validate rewards and node identity against the existing engine at integration time. Do not copy obsolete unlock promises from the earlier templates.

