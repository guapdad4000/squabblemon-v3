# Blue Side Pressure

Scene 02 · Node `blue-side-pressure` · Revised screenplay, 2026-09-08.

Canon: [story bible](../../../STORY_BIBLE.md). Integration status: authored, not yet loaded into the game.

## 1. Stage

**Dramatic purpose:** Turn Blue from a tutorial gatekeeper into someone with a defensible grievance and a bad solution. Establish what the Crown actually grants.

Harbor lights rise behind a borrowed throne made from two folding chairs and a gold graduation sash. Blue is about to sit when Wifey removes the sash, folds one chair, and hands him an extension cable. A box labeled BLUE SIDE EXECUTIVE OPERATIONS contains paper plates and a single oven mitt. The player arrives while Blue tries to kick the box under the table.

```yaml
parallaxSceneId: "block-party:blue-side:pressure"
venueId: "harbor-skyline-court"
mood: "dusk"
durationMs: 6400
grain: 0.05
layers:
  - { id: "harbor-sky", depth: 0, parallaxX: 0.05, parallaxY: 0, widthFactor: 1.3, anchor: { x: 0.6, y: 0.6 } }
  - { id: "court-fence", depth: 0.35, parallaxX: 0.3, parallaxY: 0.2, widthFactor: 1.3, anchor: { x: 0.6, y: 0.6 } }
  - { id: "folding-chairs", depth: 0.6, parallaxX: 0.6, parallaxY: 0.2, widthFactor: 0.6, anchor: { x: 0.6, y: 0.6 } }
  - { id: "ganger-blue", depth: 0.85, parallaxX: 0.9, parallaxY: 0.2, widthFactor: 0.6, anchor: { x: 0.6, y: 0.6 } }
  - { id: "wifey", depth: 0.9, parallaxX: 0.95, parallaxY: 0.2, widthFactor: 0.6, anchor: { x: 0.3, y: 0.6 } }
cameraPath:
  - { x: 0.5, y: 0.5, zoom: 1.0, holdMs: 1800, ease: easeInOut }
  - { x: 0.6, y: 0.55, zoom: 1.2, holdMs: 2400, ease: easeInOut }
  - { x: 0.5, y: 0.6, zoom: 1.05, holdMs: 2200, ease: easeInOut }
```

These layers are a proposed art brief. This scene ID is proposed and requires registration. Venue labels identify existing battle settings; the story venue registry still needs population. The 6.4-second camera move is an establishing shot only. Hold the last frame and advance dialogue on player input. Draw the dialogue box as UI, not text baked into art. Focus on `ganger-blue` for the principal exchange; keep readable reaction shots for the other speaker.

## 2. Dialogue

Dialogue is player-advanced. Tokens match the current node/section/index convention; stage business is never spoken. This is the heightened comedy-drama revision.

### Before the match

```yaml
lines:
  - lineToken: "blue-side-pressure:pre:0"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Everybody want a seat at my table. Nobody ask who built the empire."
  - lineToken: "blue-side-pressure:pre:1"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "Your empire is plugged into Nail Tech's bathroom. Don't nobody use that hair dryer."
  - lineToken: "blue-side-pressure:pre:2"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "I kept these lights on!"
  - lineToken: "blue-side-pressure:pre:3"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "WE kept them on. You brought a speaker and asked if we had ice."
  - lineToken: "blue-side-pressure:pre:4"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Winner gets the Crown. Runs the next open-play schedule. That's real power."
  - lineToken: "blue-side-pressure:pre:5"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "You pick who plays at seven. You are not the mayor of Electricity."
  - lineToken: "blue-side-pressure:pre:6"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "You want slots for your little independent situation? Beat me right here. In front of my taxpayers."
```

### After victory

```yaml
lines:
  - lineToken: "blue-side-pressure:post:0"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Fine. Your crew gets in. No colors. I said what I said."
  - lineToken: "blue-side-pressure:post:1"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "And I wrote what you said. In ink. We know how your memory acts after a loss."
  - lineToken: "blue-side-pressure:post:2"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Red's over there filming everything. Go be somebody else's emergency."
  - lineToken: "blue-side-pressure:post:3"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "Take the big entrance. He been practicing his disappointed face since lunch."
```

### Defeat / retry — optional integration hook

```yaml
lines:
  - lineToken: "blue-side-pressure:defeat:0"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "You came for the Crown and left with a learning experience. Shuffle up."
```

**Exit:** Blue finally sits. The folding chair gives one warning creak. Wifey points at the cable box without looking. He stands back up and carries it. One court light flickers as a distant hair dryer starts; everybody freezes until it stops.

## 3. Battle contract

```yaml
nodeId: "blue-side-pressure"
kind: "battle"
battleType: "standard"
mechanicsSource: "lib/squabblemon-engine/src/story.ts#blockPartyChapter/blue-side-pressure"
mechanicalChanges: none
```

Existing balanced Blue deck; no new modifiers. Teach tempo and lane commitment. This node unlocks both Receipts on Camera and the optional Side Alley Challenge.

**Rewards:** 75 street-xp; one additional ticket on the first three-star clear.

**Canonical stars:** win the encounter; finish holding all three districts; win without using SQUABBLE. Only victory is necessary for progression. Preserve this node's current map position, prerequisites, enemy cards, cinematic fallback, recommended collection, and teaching metadata in the engine.

## 4. Drama and director handoff

Wifey corrects Blue without becoming his narrator or mother. His work mattered, but he did not do it alone. 'Holding the switch' sets up the season's argument about control.

- Dialogue is complete for this scene's main route.
- Proposed layers and speaker staging require art review; this file does not certify assets as delivered.
- Dialogue/camera cue integration should use input-driven beats, with no fixed cue advancing unread text.
- Sound direction: venue ambience beneath conversation; lower crowd sound during personal exchanges. Optional hooks require an audio-bus mapping before use.
- Validate rewards and node identity against the existing engine at integration time. Do not copy obsolete unlock promises from the earlier templates.

