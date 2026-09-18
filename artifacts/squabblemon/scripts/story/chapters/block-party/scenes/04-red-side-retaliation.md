# Red Side Retaliation

Scene 04 · Node `red-side-retaliation` · Revised screenplay, 2026-09-08.

Canon: [story bible](../../../STORY_BIBLE.md). Integration status: authored, not yet loaded into the game.

## 1. Stage

**Dramatic purpose:** Reveal the family connection on the required path before the return. Red's anger masks guilt about a secret he has kept.

Red has watched his loss back three times, once in slow motion. Snitch's thumbnail has given him a cartoon tear, visible briefly on the face-up phone before Red flips it over. Blue arrives carrying a paper plate as if he has come only to spectate. A folded memorial program slips from Red's notebook: Cracked Head's portrait, gold clouds, and an unnecessary white dove. Blue's smile goes.

```yaml
parallaxSceneId: "block-party:red-side:retaliation"
venueId: "red-fence-night-court"
mood: "night"
durationMs: 6400
grain: 0.05
layers:
  - { id: "night-sky", depth: 0, parallaxX: 0.05, parallaxY: 0, widthFactor: 1.3, anchor: { x: 0.6, y: 0.6 } }
  - { id: "red-fence", depth: 0.35, parallaxX: 0.3, parallaxY: 0.2, widthFactor: 1.3, anchor: { x: 0.6, y: 0.6 } }
  - { id: "results-table", depth: 0.6, parallaxX: 0.6, parallaxY: 0.2, widthFactor: 0.6, anchor: { x: 0.6, y: 0.6 } }
  - { id: "ganger-red", depth: 0.85, parallaxX: 0.9, parallaxY: 0.2, widthFactor: 0.6, anchor: { x: 0.6, y: 0.6 } }
  - { id: "ganger-blue", depth: 0.9, parallaxX: 0.95, parallaxY: 0.2, widthFactor: 0.6, anchor: { x: 0.3, y: 0.6 } }
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
  - lineToken: "red-side-retaliation:pre:0"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "My auntie called. Said if I lose again, don't bring the Red Side banner to her cookout."
  - lineToken: "red-side-retaliation:pre:1"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "That's family accountability. Beautiful to see."
  - lineToken: "red-side-retaliation:pre:2"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "You lost twice and called it community outreach. Put that plate down."
  - lineToken: "red-side-retaliation:pre:3"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Hold up. Why you got that program?"
  - lineToken: "red-side-retaliation:pre:4"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "It was in the notebook."
  - lineToken: "red-side-retaliation:pre:5"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "That's my brother, Red. Four years. You carrying his memorial next to a tournament bracket?"
  - lineToken: "red-side-retaliation:pre:6"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "Cracked Head taught us this table. I kept it. That's all I'm saying."
  - lineToken: "red-side-retaliation:pre:7"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "One more match. Win, I sign your final entry. Save some Motion. I'm not coming gentle in round four."
```

### After victory

```yaml
lines:
  - lineToken: "red-side-retaliation:post:0"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "You won. I'll sign. Somebody tell my auntie I'm still bringing the potato salad."
  - lineToken: "red-side-retaliation:post:1"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Don't put that program on the stream."
  - lineToken: "red-side-retaliation:post:2"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "I wasn't going to."
  - lineToken: "red-side-retaliation:post:3"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Yeah. You got a whole museum of shit you weren't going to."
  - lineToken: "red-side-retaliation:post:4"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "Snitch has the contender sheet up the hill. Get there before he puts your entry behind a subscription."
```

### Defeat / retry — optional integration hook

```yaml
lines:
  - lineToken: "red-side-retaliation:defeat:0"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "You spent all your Motion getting comfortable. I told you I was coming back."
```

**Exit:** Red signs the entry. Blue leaves the untouched plate on the table and walks off. Red folds the memorial slowly enough to conceal a smaller recording sleeve behind it. Hold that action without a joke. He knows more than he is saying.

## 3. Battle contract

```yaml
nodeId: "red-side-retaliation"
kind: "battle"
battleType: "standard"
mechanicsSource: "lib/squabblemon-engine/src/story.ts#blockPartyChapter/red-side-retaliation"
mechanicalChanges: none
```

Existing aggressive Red deck. CPU begins with +2 Motion and receives its existing +1 Motion in round 4. Teach saving Motion and protection. No family choice affects the battle.

**Rewards:** 125 street-xp; one additional ticket on the first three-star clear.

**Canonical stars:** win the encounter; finish holding all three districts; win without using SQUABBLE. Only victory is necessary for progression. Preserve this node's current map position, prerequisites, enemy cards, cinematic fallback, recommended collection, and teaching metadata in the engine.

## 4. Drama and director handoff

The memorial establishes presumed death rather than a legally verified death. Blue explicitly identifies the relationship. Red knows Cracked Head survived; his line about four years is guilt, not surprise. No obligatory clue is hidden in the optional alley.

- Dialogue is complete for this scene's main route.
- Proposed layers and speaker staging require art review; this file does not certify assets as delivered.
- Dialogue/camera cue integration should use input-driven beats, with no fixed cue advancing unread text.
- Sound direction: venue ambience beneath conversation; lower crowd sound during personal exchanges. Optional hooks require an audio-bus mapping before use.
- Validate rewards and node identity against the existing engine at integration time. Do not copy obsolete unlock promises from the earlier templates.

