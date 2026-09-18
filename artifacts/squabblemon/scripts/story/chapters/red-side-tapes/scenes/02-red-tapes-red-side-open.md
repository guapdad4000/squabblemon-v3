# Red Side Is Still Open

Chapter Two · Scene 02 · `red-tapes-red-side-open` · Authored 2026-09-08, not integrated.

Canon: [story bible](../../../STORY_BIBLE.md). [Full chapter](../CHAPTER_TWO_READTHROUGH.md). [Proposed encounter data](../chapter-two.proposed.json).

## 1. Stage

**Time and place:** Next morning; red-fence-night-court.

**Dramatic purpose:** Launch the public six-match Red Side Gauntlet as a real scheduled event, not an errand to unlock private evidence. Red tries to control the room while avoiding the conversation he owes.

A cookout canopy has swallowed the Red Side court. A professionally printed RED SIDE GAUNTLET banner has a handwritten NO FAMILY QUESTIONS taped beneath it. The winner hosts the next neighborhood showcase; the player's Chapter One Crown and open-play schedule remain intact. Red, Cornball, Snitch, Roaster, Wifey and Baby Momma are the posted six-table lineup, not surprise gatekeepers invented after each win. Blue reads the handwritten addition with extraordinary disrespect.

```yaml
parallaxSceneId: "red-side-tapes:red-tapes-red-side-open"
venueId: "red-fence-night-court"
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
  - lineToken: "red-tapes-red-side-open:pre:0"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "NO FAMILY QUESTIONS? What is this, a tournament or a witness stand with chicken?"
  - lineToken: "red-tapes-red-side-open:pre:1"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "The event was booked before last night."
  - lineToken: "red-tapes-red-side-open:pre:2"
    speaker: "Cornball"
    portraitAssetId: "assets/characters/cornball.webp"
    text: "And I already bought six gallons of cheese. Whatever happens, we need attendance."
  - lineToken: "red-tapes-red-side-open:pre:3"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "Six tables. Clear the Gauntlet, you host the next neighborhood showcase. Open entry stays open."
  - lineToken: "red-tapes-red-side-open:pre:4"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Look at you announcing rules like you ain't been hiding a whole season in your notebook."
  - lineToken: "red-tapes-red-side-open:pre:5"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "Blue. Go find a task. You circling this table like accountability only got one address."
  - lineToken: "red-tapes-red-side-open:pre:6"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "I'm first. Middle district closes in round three, both sides. The canopy crew needs the space."
  - lineToken: "red-tapes-red-side-open:pre:7"
    speaker: "Cornball"
    portraitAssetId: "assets/characters/cornball.webp"
    text: "They said they needed the space from eight this morning. Red said wait till he looks difficult."
  - lineToken: "red-tapes-red-side-open:pre:8"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "Put your deck down. Somebody here is still going to finish what they started."
```

### After victory

```yaml
lines:
  - lineToken: "red-tapes-red-side-open:post:0"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "First table cleared. Your Crown was not a fluke."
  - lineToken: "red-tapes-red-side-open:post:1"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Write that on the banner. Use the expensive marker."
  - lineToken: "red-tapes-red-side-open:post:2"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "After the next two tables, you're coming to the back room. No phones."
  - lineToken: "red-tapes-red-side-open:post:3"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "I'll be there."
  - lineToken: "red-tapes-red-side-open:post:4"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "You been a lot of places you should've been talking. Try doing both."
  - lineToken: "red-tapes-red-side-open:post:5"
    speaker: "Cornball"
    portraitAssetId: "assets/characters/cornball.webp"
    text: "Next table's mine. Keep your wristband. The cheese has terms."
```

### Defeat / retry — optional integration hook

```yaml
lines:
  - lineToken: "red-tapes-red-side-open:defeat:0"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "Round three. Middle district. I put it on a sign and everything."
```

**Exit:** Red stamps the player's gauntlet card. Blue starts to photograph NO FAMILY QUESTIONS; Wifey takes the marker from him and replaces the sign with CHECK-IN. Baby Momma leaves with the recorder still in her bag. The tape never becomes a tournament prize.

## 3. Proposed game contract

Node `red-tapes-red-side-open` in [chapter-two.proposed.json](../chapter-two.proposed.json) contains the full proposed definition: prerequisites, map position, dialogue, rewards, and seven-card deck, modifiers, phases, teaching, and objectives. All Chapter Two node IDs and media paths are new and unregistered.

Opponent: **Ganger Red**. Type: **rule-twist**. Behavior profile: `aggressive`.

Deck keys: `cornball`, `roaster`, `nerd`, `snow`, `plug`, `baby`, `hooper`.

```json
{
  "modifiers": {
    "laneLocks": [
      {
        "round": 3,
        "owner": "both",
        "lanes": [
          1
        ]
      }
    ]
  },
  "phases": []
}
```

Teaching: The middle district locks in round three for both players. Plan your early placement around the posted closure.

Proposed first-clear reward: **100 street-xp**. First three-star clear: **one Street Pack Ticket** under the existing rule. Stars: win; finish holding all three districts; win without SQUABBLE. A normal win advances. Proposed balance is not playtested.

## 4. Continuity and handoff

These six matches were posted in advance. Hosting the showcase is a new event-specific position; losing here does not revoke the Chapter One Crown. The morning staging requires a daytime variant of the supplied night court.

Preserve before-fight versus victory gating. Keep retry lines outside the canonical dialogue arrays. New speakers need roster integration even if their portrait file already exists. See [production and integration handoff](../HANDOFF.md) for missing art, exports, and validation status.

