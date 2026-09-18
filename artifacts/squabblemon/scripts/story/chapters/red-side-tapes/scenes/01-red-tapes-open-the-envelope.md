# Put the Chairs Back

Chapter Two · Scene 01 · `red-tapes-open-the-envelope` · Authored 2026-09-08, not integrated.

Canon: [story bible](../../../STORY_BIBLE.md). [Full chapter](../CHAPTER_TWO_READTHROUGH.md). [Proposed encounter data](../chapter-two.proposed.json).

## 1. Stage

**Time and place:** Immediately after Chapter One, same night; crown-rooftop-court.

**Dramatic purpose:** Pay off the handed-over recording immediately. Establish the child, Red's concealment, and Baby Momma's control of the original; leave the rescue and Blue's leak for later chapters.

The exact Chapter One final tableau: Red in the chair Baby Momma chose, Cracked Head left standing, Wifey's two unopened water bottles on the table. The player waits by the crooked Crown. Snitch and Cornball are sent downstairs before playback. Baby Momma opens the sleeve: a tiny digital recorder with an OLD MESSAGE label. Red connects a power bank. Nobody hunts for a charger across an entire chapter.

```yaml
parallaxSceneId: "red-side-tapes:red-tapes-open-the-envelope"
venueId: "crown-rooftop-court"
mood: "night"
status: proposed
playback: player-advanced dialogue
```

Director: establish the location in a short moving wide shot, then alternate medium dialogue coverage with specific prop inserts and held reactions. Stage the actors with depth and preserve their current illustrated identities. The venue ID refers to existing battle art; a matching eye-level/time-of-day scene plate, new poses, props, and layer registration remain production work. Never force the full dialogue into an establishing-shot timer.

## 2. Dialogue

Use node/section/index tokens. Stage instructions and delivery metadata are not spoken. The recorded line in Scene 1 must sound like the same Cracked Head heard on the roof, played through the small recorder. All other lines are present-day speech.

### Conversation

```yaml
lines:
  - lineToken: "red-tapes-open-the-envelope:main:0"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "Everybody who came up here for a picture, go downstairs. Everybody who came back from the dead, remain available."
  - lineToken: "red-tapes-open-the-envelope:main:1"
    speaker: "Snitch"
    portraitAssetId: "assets/characters/snitch.webp"
    text: "I can leave one phone as a courtesy—"
  - lineToken: "red-tapes-open-the-envelope:main:2"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "You can leave a shoe if you don't move."
  - lineToken: "red-tapes-open-the-envelope:main:3"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "Original recorder. Original message. I kept it."
  - lineToken: "red-tapes-open-the-envelope:main:4"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "You also kept your mouth shut. Press play before I start grading the collection."
  - lineToken: "red-tapes-open-the-envelope:main:5"
    speaker: "Cracked Head"
    portraitAssetId: "assets/characters/cracked-head.webp"
    delivery: "archival recording; same voice, narrow speaker sound"
    text: "Red. You said the baby's here. Tell her I heard you. Tell her I'm alive. Tell her I'll call when I can."
  - lineToken: "red-tapes-open-the-envelope:main:6"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "That is your voice. Three weeks after the memorial. Our baby was nine days old."
  - lineToken: "red-tapes-open-the-envelope:main:7"
    speaker: "Cracked Head"
    portraitAssetId: "assets/characters/cracked-head.webp"
    text: "I know what it sounds like."
  - lineToken: "red-tapes-open-the-envelope:main:8"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "It sounds like a man who knew he was a father. Which part needs remixing?"
  - lineToken: "red-tapes-open-the-envelope:main:9"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Red. You had this while we were checking on her?"
  - lineToken: "red-tapes-open-the-envelope:main:10"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "Yes."
  - lineToken: "red-tapes-open-the-envelope:main:11"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "You watched me say thank you. Over and over. Like you was a damn guardian angel with a rewards program."
  - lineToken: "red-tapes-open-the-envelope:main:12"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "The groceries came from him. Some of the money did too."
  - lineToken: "red-tapes-open-the-envelope:main:13"
    speaker: "Cracked Head"
    portraitAssetId: "assets/characters/cracked-head.webp"
    text: "I told him to tell you."
  - lineToken: "red-tapes-open-the-envelope:main:14"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "And when my number didn't call you back, did you assume I was busy for FOUR YEARS?"
  - lineToken: "red-tapes-open-the-envelope:main:15"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "She asked you a question."
  - lineToken: "red-tapes-open-the-envelope:main:16"
    speaker: "Cracked Head"
    portraitAssetId: "assets/characters/cracked-head.webp"
    text: "No. I should have found another way."
  - lineToken: "red-tapes-open-the-envelope:main:17"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "Good. A full sentence with a responsible adult in it."
  - lineToken: "red-tapes-open-the-envelope:main:18"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "There's more to why I kept it."
  - lineToken: "red-tapes-open-the-envelope:main:19"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "Then tomorrow you can explain the rest. I'm going home to the person who actually waited up for me."
```

**Exit:** Baby Momma takes the recorder and sleeve. She leaves both men with their sealed water bottles. Cracked Head starts after her, stops when she holds up one finger without turning around, and lets her go. The player and Blue have heard the same message. Cut to next morning; no public copy of this private playback exists.

## 3. Proposed game contract

Node `red-tapes-open-the-envelope` in [chapter-two.proposed.json](../chapter-two.proposed.json) contains the full proposed definition: prerequisites, map position, dialogue, rewards, and non-battle presentation metadata. All Chapter Two node IDs and media paths are new and unregistered.

Dialogue node, no reward. Reading completion advances to the next proposed node; no fight is required to make the recorded facts true.

## 4. Continuity and handoff

The four-year-old child's paternity is revealed here, never as a match reward. Child stays off-screen and unnamed. The message is dated three weeks after the memorial; the baby was nine days old then. Red and Cracked Head confirm authorship/context. No protective relocation explanation, illness diagnosis, or Blue-address confession occurs. Speakers downstairs cannot hear the private playback.

Preserve before-fight versus victory gating. Keep retry lines outside the canonical dialogue arrays. New speakers need roster integration even if their portrait file already exists. See [production and integration handoff](../HANDOFF.md) for missing art, exports, and validation status.

