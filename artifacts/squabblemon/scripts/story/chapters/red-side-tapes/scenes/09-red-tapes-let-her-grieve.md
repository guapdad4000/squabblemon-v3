# Who Told You That?

Chapter Two · Scene 09 · `red-tapes-let-her-grieve` · Authored 2026-09-08, not integrated.

Canon: [story bible](../../../STORY_BIBLE.md). [Full chapter](../CHAPTER_TWO_READTHROUGH.md). [Proposed encounter data](../chapter-two.proposed.json).

## 1. Stage

**Time and place:** Evening, OG Uncle's porch; corner-store-court.

**Dramatic purpose:** Complete the host reward, name Red's adviser, and end on OG Uncle's responsibility without revealing the rescue or his diagnosis early.

First, a short event wrap: the player's showcase card gets the final stamp. Save the actual reward panel for after the porch cliffhanger. Then the player accompanies Baby Momma and Red by invitation as a neutral witness. OG Uncle sits on his porch, coat over his knees, newspaper open. No medical props, cough, oxygen, or diagnosis cue. One bulb lights three empty chairs. He folds the newspaper before they reach the steps, as though he has been reading the same sentence for hours.

```yaml
parallaxSceneId: "red-side-tapes:red-tapes-let-her-grieve"
venueId: "corner-store-court"
mood: "dusk"
status: proposed
playback: player-advanced dialogue
```

Director: establish the location in a short moving wide shot, then alternate medium dialogue coverage with specific prop inserts and held reactions. Stage the actors with depth and preserve their current illustrated identities. The venue ID refers to existing battle art; a matching eye-level/time-of-day scene plate, new poses, props, and layer registration remain production work. Never force the full dialogue into an establishing-shot timer.

## 2. Dialogue

Use node/section/index tokens. Stage instructions and delivery metadata are not spoken. The recorded line in Scene 1 must sound like the same Cracked Head heard on the roof, played through the small recorder. All other lines are present-day speech.

### Event wrap and porch cliffhanger

```yaml
lines:
  - lineToken: "red-tapes-let-her-grieve:main:0"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "Showcase host confirmed. You kept the event standing while the rest of us tried to turn it into a group argument."
  - lineToken: "red-tapes-let-her-grieve:main:1"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "Next one, the kids eat first. Put that somewhere Snitch can't crop."
  - lineToken: "red-tapes-let-her-grieve:main:2"
    speaker: "Cornball"
    portraitAssetId: "assets/characters/cornball.webp"
    text: "Liquid Gold respects the decision of the community."
  - lineToken: "red-tapes-let-her-grieve:main:3"
    speaker: "Church Auntie"
    portraitAssetId: "assets/characters/church-auntie.webp"
    text: "Then let the community bury that dispenser."
  - lineToken: "red-tapes-let-her-grieve:main:4"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "Come with us. You've heard what was said. I'd like somebody there who isn't adding their own version."
  - lineToken: "red-tapes-let-her-grieve:main:5"
    speaker: "OG Uncle"
    portraitAssetId: "assets/characters/og-uncle.webp"
    text: "Red. I said call before you came."
  - lineToken: "red-tapes-let-her-grieve:main:6"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "I did."
  - lineToken: "red-tapes-let-her-grieve:main:7"
    speaker: "OG Uncle"
    portraitAssetId: "assets/characters/og-uncle.webp"
    text: "You said company. This is a reckoning with a handbag."
  - lineToken: "red-tapes-let-her-grieve:main:8"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "I brought something you've had four years to explain."
  - lineToken: "red-tapes-let-her-grieve:main:9"
    speaker: "OG Uncle"
    portraitAssetId: "assets/characters/og-uncle.webp"
    text: "Sit down."
  - lineToken: "red-tapes-let-her-grieve:main:10"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "I'll sit when you answer. Did you tell Red not to give me this message?"
  - lineToken: "red-tapes-let-her-grieve:main:11"
    speaker: "OG Uncle"
    portraitAssetId: "assets/characters/og-uncle.webp"
    text: "I told him to let you grieve."
  - lineToken: "red-tapes-let-her-grieve:main:12"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "Over a man you knew was alive?"
  - lineToken: "red-tapes-let-her-grieve:main:13"
    speaker: "OG Uncle"
    portraitAssetId: "assets/characters/og-uncle.webp"
    text: "Yes."
  - lineToken: "red-tapes-let-her-grieve:main:14"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "Then who exactly were you protecting?"
```

**Exit:** OG Uncle closes the newspaper the rest of the way. Red takes the chair farthest from him. Baby Momma does not sit. Hold the empty chair between her and the old man. Cut to black before he answers. Chapter Three begins with this unanswered question and Blue refusing his father's calls; the actual rescue explanation waits for Chapter Five.

## 3. Proposed game contract

Node `red-tapes-let-her-grieve` in [chapter-two.proposed.json](../chapter-two.proposed.json) contains the full proposed definition: prerequisites, map position, dialogue, rewards, and non-battle presentation metadata. All Chapter Two node IDs and media paths are new and unregistered.

Proposed reward: `baby` card ×1 and `story-key:chapter-three` ×1, granted after the node's final line completes. No bonus ticket, new cosmetic, or character unlock is proposed. This is a card reward, not ownership of a person. Chapter Three is not currently playable.

## 4. Continuity and handoff

The key reveal is that OG Uncle directed silence, not why he rescued Cracked Head. His serious illness is Chapter Three information and receives no medical tease here. The event recognizes the host before the porch scene; the game's actual reward grant occurs on completion of this reward node after the final line. A match cannot compel a confession. Do not advertise Chapter Three as playable.

Preserve before-fight versus victory gating. Keep retry lines outside the canonical dialogue arrays. New speakers need roster integration even if their portrait file already exists. See [production and integration handoff](../HANDOFF.md) for missing art, exports, and validation status.

