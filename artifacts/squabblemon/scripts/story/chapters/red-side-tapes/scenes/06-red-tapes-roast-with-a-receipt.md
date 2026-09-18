# Roast with a Receipt

Chapter Two · Scene 06 · `red-tapes-roast-with-a-receipt` · Authored 2026-09-08, not integrated.

Canon: [story bible](../../../STORY_BIBLE.md). [Full chapter](../CHAPTER_TWO_READTHROUGH.md). [Proposed encounter data](../chapter-two.proposed.json).

## 1. Stage

**Time and place:** Early afternoon; red-fence-night-court.

**Dramatic purpose:** Give Baby Momma family support with its own flaws. Roaster turns a public gauntlet match into a roast; his sister refuses to be used as his excuse.

The main court again. Roaster has mounted a fake CERTIFIED APOLOGY INSPECTOR badge on his jacket and is testing a microphone at conversation distance from Blue's face. Baby Momma takes the microphone, switches it off, and gives it back. Table four's sign was printed before the tournament; he is a scheduled opponent, not a brother who demands payment to permit the story.

```yaml
parallaxSceneId: "red-side-tapes:red-tapes-roast-with-a-receipt"
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
  - lineToken: "red-tapes-roast-with-a-receipt:pre:0"
    speaker: "All Jokes Roaster"
    portraitAssetId: "assets/characters/all-jokes-roaster.webp"
    text: "Table four. I was supposed to roast the champion. Then my sister's past walked in wearing a haunted junk drawer."
  - lineToken: "red-tapes-roast-with-a-receipt:pre:1"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Keep my brother out of—"
  - lineToken: "red-tapes-roast-with-a-receipt:pre:2"
    speaker: "All Jokes Roaster"
    portraitAssetId: "assets/characters/all-jokes-roaster.webp"
    text: "Keep him? Y'all couldn't FIND him."
  - lineToken: "red-tapes-roast-with-a-receipt:pre:3"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "You are not using my life as your comedy special."
  - lineToken: "red-tapes-roast-with-a-receipt:pre:4"
    speaker: "All Jokes Roaster"
    portraitAssetId: "assets/characters/all-jokes-roaster.webp"
    text: "I'm defending you."
  - lineToken: "red-tapes-roast-with-a-receipt:pre:5"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "You printed tickets."
  - lineToken: "red-tapes-roast-with-a-receipt:pre:6"
    speaker: "All Jokes Roaster"
    portraitAssetId: "assets/characters/all-jokes-roaster.webp"
    text: "For the community to witness the defense."
  - lineToken: "red-tapes-roast-with-a-receipt:pre:7"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "Play the match."
  - lineToken: "red-tapes-roast-with-a-receipt:pre:8"
    speaker: "All Jokes Roaster"
    portraitAssetId: "assets/characters/all-jokes-roaster.webp"
    text: "Fine. No mic. My deck still got something to say. Don't stack your whole ego in one district."
```

### After victory

```yaml
lines:
  - lineToken: "red-tapes-roast-with-a-receipt:post:0"
    speaker: "All Jokes Roaster"
    portraitAssetId: "assets/characters/all-jokes-roaster.webp"
    text: "Fourth table cleared. You won a card game. Do not let Snitch caption it like you raised me."
  - lineToken: "red-tapes-roast-with-a-receipt:post:1"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "You need a quiet place to process that? There's an empty VIP section by the door."
  - lineToken: "red-tapes-roast-with-a-receipt:post:2"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "You two done making a timeshare out of the last word?"
  - lineToken: "red-tapes-roast-with-a-receipt:post:3"
    speaker: "All Jokes Roaster"
    portraitAssetId: "assets/characters/all-jokes-roaster.webp"
    text: "I'm done. You need anything carried?"
  - lineToken: "red-tapes-roast-with-a-receipt:post:4"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "The covered plates. To the volunteers. That's help."
  - lineToken: "red-tapes-roast-with-a-receipt:post:5"
    speaker: "All Jokes Roaster"
    portraitAssetId: "assets/characters/all-jokes-roaster.webp"
    text: "Say less."
  - lineToken: "red-tapes-roast-with-a-receipt:post:6"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "That's what I've been trying to get you to do."
```

### Defeat / retry — optional integration hook

```yaml
lines:
  - lineToken: "red-tapes-roast-with-a-receipt:defeat:0"
    speaker: "All Jokes Roaster"
    portraitAssetId: "assets/characters/all-jokes-roaster.webp"
    text: "You had a plan. I could tell by how upset you got when it left. Run it back."
```

**Exit:** Roaster removes the fake badge and picks up the covered plates. He leaves the microphone behind. Blue starts to put it to his mouth; Wifey silently removes the batteries as she passes toward table five. The player's win changes the gauntlet standing, not Baby Momma's permission to act for herself.

## 3. Proposed game contract

Node `red-tapes-roast-with-a-receipt` in [chapter-two.proposed.json](../chapter-two.proposed.json) contains the full proposed definition: prerequisites, map position, dialogue, rewards, and seven-card deck, modifiers, phases, teaching, and objectives. All Chapter Two node IDs and media paths are new and unregistered.

Opponent: **All Jokes Roaster**. Type: **standard**. Behavior profile: `aggressive`.

Deck keys: `roaster`, `cornball`, `nerd`, `snow`, `hooper`, `plug`, `bikelife`.

```json
{
  "modifiers": {
    "startingMotion": {
      "cpu": 1
    }
  },
  "phases": []
}
```

Teaching: Roaster starts with one extra Motion and favors disruption. Protect a key district and avoid putting your entire plan on one target.

Proposed first-clear reward: **175 street-xp**. First three-star clear: **one Street Pack Ticket** under the existing rule. Stars: win; finish holding all three districts; win without SQUABBLE. A normal win advances. Proposed balance is not playtested.

## 4. Continuity and handoff

Roaster's costume follows the existing all-jokes-roaster portrait. His family relationship is now explicit canon: Baby Momma's younger maternal brother, not a rival parent. Avoid implying the child is a card wager. Support becomes a task instead of another speech.

Preserve before-fight versus victory gating. Keep retry lines outside the canonical dialogue arrays. New speakers need roster integration even if their portrait file already exists. See [production and integration handoff](../HANDOFF.md) for missing art, exports, and validation status.

