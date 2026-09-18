# Side-Eye Security

Chapter Two · Scene 07 · `red-tapes-side-eye-security` · Authored 2026-09-08, not integrated.

Canon: [story bible](../../../STORY_BIBLE.md). [Full chapter](../CHAPTER_TWO_READTHROUGH.md). [Proposed encounter data](../chapter-two.proposed.json).

## 1. Stage

**Time and place:** Late afternoon; harbor-skyline-court.

**Dramatic purpose:** Make Wifey a formidable contestant with a life beyond correcting Blue. Show the cost of promising protection while concealing a truth of her own.

Table five under a canopy by the harbor. Wifey lays down a neat deck beside a labeled roll of tape. Her VIP area consists of a chair with no one asking her to do anything. Blue wanders into it and gets pointed straight back out. An unopened lunch sits next to her score sheet. Baby Momma takes over check-in so Wifey can actually play.

```yaml
parallaxSceneId: "red-side-tapes:red-tapes-side-eye-security"
venueId: "harbor-skyline-court"
mood: "dusk"
status: proposed
playback: player-advanced dialogue
```

Director: establish the location in a short moving wide shot, then alternate medium dialogue coverage with specific prop inserts and held reactions. Stage the actors with depth and preserve their current illustrated identities. The venue ID refers to existing battle art; a matching eye-level/time-of-day scene plate, new poses, props, and layer registration remain production work. Never force the full dialogue into an establishing-shot timer.

## 2. Dialogue

Use node/section/index tokens. Stage instructions and delivery metadata are not spoken. The recorded line in Scene 1 must sound like the same Cracked Head heard on the roof, played through the small recorder. All other lines are present-day speech.

### Before the fight

```yaml
lines:
  - lineToken: "red-tapes-side-eye-security:pre:0"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "My wife don't play around."
  - lineToken: "red-tapes-side-eye-security:pre:1"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "Your wife would like to play at all. Move the cooler."
  - lineToken: "red-tapes-side-eye-security:pre:2"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "I got check-in. Sit down before somebody asks you to alphabetize the weather."
  - lineToken: "red-tapes-side-eye-security:pre:3"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "Thank you. Table five. My name was on this list before Blue discovered electricity."
  - lineToken: "red-tapes-side-eye-security:pre:4"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "I was trying to compliment you."
  - lineToken: "red-tapes-side-eye-security:pre:5"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "Then tell them my name without putting MY in front of it."
  - lineToken: "red-tapes-side-eye-security:pre:6"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "Get her a chair with a back. That one requires an explanation."
  - lineToken: "red-tapes-side-eye-security:pre:7"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "I've got one extra card in my opening hand. You'll see it in the briefing."
  - lineToken: "red-tapes-side-eye-security:pre:8"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "And protection in this deck. Don't throw your biggest effect at the first thing that annoys you."
  - lineToken: "red-tapes-side-eye-security:pre:9"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "That's good life advice too."
  - lineToken: "red-tapes-side-eye-security:pre:10"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "So is 'move the cooler.' We're all learning."
```

### After victory

```yaml
lines:
  - lineToken: "red-tapes-side-eye-security:post:0"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "Fifth table cleared. You kept your head. That's rarer than everybody's card collection."
  - lineToken: "red-tapes-side-eye-security:post:1"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "You played good. You should get to do that more."
  - lineToken: "red-tapes-side-eye-security:post:2"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "I should."
  - lineToken: "red-tapes-side-eye-security:post:3"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "You ever get tired of being the one everybody trusts to hold things together?"
  - lineToken: "red-tapes-side-eye-security:post:4"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "Yeah."
  - lineToken: "red-tapes-side-eye-security:post:5"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "Then don't let them make you carry what's theirs."
  - lineToken: "red-tapes-side-eye-security:post:6"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "I'll try."
  - lineToken: "red-tapes-side-eye-security:post:7"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "I moved the cooler."
  - lineToken: "red-tapes-side-eye-security:post:8"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "Good. Now take the applause you were expecting and use it to move the other one."
```

### Defeat / retry — optional integration hook

```yaml
lines:
  - lineToken: "red-tapes-side-eye-security:defeat:0"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "You hit the protection and looked surprised it protected something. Take a breath."
```

**Exit:** Baby Momma squeezes Wifey's shoulder and leaves for the final table. Wifey watches her go, then folds the unused event list into a smaller and smaller square. Blue notices and asks nothing. Let the guilt remain legible without flashing a confession, address, or future recording.

## 3. Proposed game contract

Node `red-tapes-side-eye-security` in [chapter-two.proposed.json](../chapter-two.proposed.json) contains the full proposed definition: prerequisites, map position, dialogue, rewards, and seven-card deck, modifiers, phases, teaching, and objectives. All Chapter Two node IDs and media paths are new and unregistered.

Opponent: **Wifey**. Type: **mini-boss**. Behavior profile: `balanced`.

Deck keys: `wifey`, `rastamon`, `snow`, `cornball`, `plug`, `baby`, `hooper`.

```json
{
  "modifiers": {
    "handSize": {
      "cpu": 4
    }
  },
  "phases": []
}
```

Teaching: Wifey's opponent hand starts at four cards. Existing protection can block targeted effects; choose your timing carefully.

Proposed first-clear reward: **200 street-xp**. First three-star clear: **one Street Pack Ticket** under the existing rule. Stars: win; finish holding all three districts; win without SQUABBLE. A normal win advances. Proposed balance is not playtested.

## 4. Continuity and handoff

Wifey's current display nickname is retained. Her line about her name asks Blue to stop treating her as an accessory, not to reveal an unauthored legal name. CPU hand size is four; no new protection rule is added beyond the existing Wifey card ability. Her concealed knowledge still belongs to Chapter Five.

Preserve before-fight versus victory gating. Keep retry lines outside the canonical dialogue arrays. New speakers need roster integration even if their portrait file already exists. See [production and integration handoff](../HANDOFF.md) for missing art, exports, and validation status.

