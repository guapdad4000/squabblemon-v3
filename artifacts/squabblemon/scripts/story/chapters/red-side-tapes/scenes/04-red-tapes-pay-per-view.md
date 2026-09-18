# Pay-Per-View Family Business

Chapter Two · Scene 04 · `red-tapes-pay-per-view` · Authored 2026-09-08, not integrated.

Canon: [story bible](../../../STORY_BIBLE.md). [Full chapter](../CHAPTER_TWO_READTHROUGH.md). [Proposed encounter data](../chapter-two.proposed.json).

## 1. Stage

**Time and place:** Midday; civic-hill-climb.

**Dramatic purpose:** Show Snitch monetizing the public return without granting him impossible access to the private recording. Let the third gauntlet match build toward the back-room reckoning.

Snitch has upgraded the air-fryer desk with two clip-on microphones and a sign reading THE RETURN: THE DIRECTOR'S CUT. Wifey turns the sign face down before any recording starts. A second sign sells VIP reaction seats facing the back-room door. No one is inside that room yet. Snitch does not possess Baby Momma's recorder or its contents.

```yaml
parallaxSceneId: "red-side-tapes:red-tapes-pay-per-view"
venueId: "civic-hill-climb"
mood: "block"
status: proposed
playback: player-advanced dialogue
```

Director: establish the location in a short moving wide shot, then alternate medium dialogue coverage with specific prop inserts and held reactions. Stage the actors with depth and preserve their current illustrated identities. The venue ID refers to existing battle art; a matching eye-level/time-of-day scene plate, new poses, props, and layer registration remain production work. Never force the full dialogue into an establishing-shot timer.

## 2. Dialogue

Use node/section/index tokens. Stage instructions and delivery metadata are not spoken. The recorded line in Scene 1 must sound like the same Cracked Head heard on the roof, played through the small recorder. All other lines are present-day speech.

### Before the fight

```yaml
lines:
  - lineToken: "red-tapes-pay-per-view:pre:0"
    speaker: "Snitch"
    portraitAssetId: "assets/characters/snitch.webp"
    text: "Welcome back. Last night a dead man made the finals. Today we're asking the difficult questions."
  - lineToken: "red-tapes-pay-per-view:pre:1"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "First question. Why are you selling seats facing a closed door?"
  - lineToken: "red-tapes-pay-per-view:pre:2"
    speaker: "Snitch"
    portraitAssetId: "assets/characters/snitch.webp"
    text: "Anticipation package. Premium gets to hear a chair scrape."
  - lineToken: "red-tapes-pay-per-view:pre:3"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "You heard what I said about my business being an entrance."
  - lineToken: "red-tapes-pay-per-view:pre:4"
    speaker: "Snitch"
    portraitAssetId: "assets/characters/snitch.webp"
    text: "I ain't even got the recording. I'm covering the cultural impact."
  - lineToken: "red-tapes-pay-per-view:pre:5"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "Cover that sign before I turn your cultural impact into a folding-table situation."
  - lineToken: "red-tapes-pay-per-view:pre:6"
    speaker: "Snitch"
    portraitAssetId: "assets/characters/snitch.webp"
    text: "Fine. Sports. We are doing sports."
  - lineToken: "red-tapes-pay-per-view:pre:7"
    speaker: "Snitch"
    portraitAssetId: "assets/characters/snitch.webp"
    text: "Table three. Little boost in round three, another in five. Growth strategy."
  - lineToken: "red-tapes-pay-per-view:pre:8"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "One extra Motion each time. Two boosts. Zero mystique."
```

### After victory

```yaml
lines:
  - lineToken: "red-tapes-pay-per-view:post:0"
    speaker: "Snitch"
    portraitAssetId: "assets/characters/snitch.webp"
    text: "Third table cleared. This footage may require some color correction."
  - lineToken: "red-tapes-pay-per-view:post:1"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "The color is you losing."
  - lineToken: "red-tapes-pay-per-view:post:2"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "Stop pointing a camera at that door. I knew he was alive. She didn't. That's all you're getting from me out here."
  - lineToken: "red-tapes-pay-per-view:post:3"
    speaker: "Snitch"
    portraitAssetId: "assets/characters/snitch.webp"
    text: "Red. Say that first bit again, facing the light."
  - lineToken: "red-tapes-pay-per-view:post:4"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "No. Keep the sentence together."
  - lineToken: "red-tapes-pay-per-view:post:5"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "Come on, Red. You got a room full of consequences waiting."
```

### Defeat / retry — optional integration hook

```yaml
lines:
  - lineToken: "red-tapes-pay-per-view:defeat:0"
    speaker: "Snitch"
    portraitAssetId: "assets/characters/snitch.webp"
    text: "People are asking if you meant to do that. Come back and give me a different ending."
```

**Exit:** Red follows Baby Momma toward the private room. Snitch looks at the public event footage waveform but does not edit it on-screen yet. The line he just captured can later be misused; it is not the old message and not the warehouse footage. A tournament volunteer turns the VIP chairs back toward the actual match table.

## 3. Proposed game contract

Node `red-tapes-pay-per-view` in [chapter-two.proposed.json](../chapter-two.proposed.json) contains the full proposed definition: prerequisites, map position, dialogue, rewards, and seven-card deck, modifiers, phases, teaching, and objectives. All Chapter Two node IDs and media paths are new and unregistered.

Opponent: **Snitch**. Type: **standard**. Behavior profile: `reactive`.

Deck keys: `cornball`, `streamer`, `plug`, `gamer`, `nerd`, `snow`, `roaster`.

```json
{
  "modifiers": {
    "roundMotionDeltas": [
      {
        "round": 3,
        "owner": "cpu",
        "amount": 1
      },
      {
        "round": 5,
        "owner": "cpu",
        "amount": 1
      }
    ]
  },
  "phases": []
}
```

Teaching: Snitch gets one extra Motion in round three and one in round five. Save an answer for each boost rather than spending everything early.

Proposed first-clear reward: **150 street-xp**. First three-star clear: **one Street Pack Ticket** under the existing rule. Stars: win; finish holding all three districts; win without SQUABBLE. A normal win advances. Proposed balance is not playtested.

## 4. Continuity and handoff

Snitch learned only that the family has a recording from public discussion; he expressly lacks its contents. Baby Momma has not consented to broadcast the private note. The chapter plants selective editing without completing Chapter Four's false-footage plot.

Preserve before-fight versus victory gating. Keep retry lines outside the canonical dialogue arrays. New speakers need roster integration even if their portrait file already exists. See [production and integration handoff](../HANDOFF.md) for missing art, exports, and validation status.

