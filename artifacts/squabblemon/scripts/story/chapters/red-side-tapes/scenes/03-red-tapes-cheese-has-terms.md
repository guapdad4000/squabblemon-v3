# The Cheese Has Terms

Chapter Two · Scene 03 · `red-tapes-cheese-has-terms` · Authored 2026-09-08, not integrated.

Canon: [story bible](../../../STORY_BIBLE.md). [Full chapter](../CHAPTER_TWO_READTHROUGH.md). [Proposed encounter data](../chapter-two.proposed.json).

## 1. Stage

**Time and place:** Late morning; corner-store-court.

**Dramatic purpose:** Let Cornball be a genuine opponent with a ridiculous side hustle. Provide a comic release after the tape and give the player's gauntlet run physical, public momentum.

Cornball has established a snack counter behind the corner store. A laminated chart lists CHEESE TIERS. There is a red rope around one folding chair labeled FOUNDER. A huge dispenser makes alarming aquarium noises. The tournament table is clearly separate from food sales; no purchase is required to enter. Wifey studies the laminated chart as if it has personally disappointed her.

```yaml
parallaxSceneId: "red-side-tapes:red-tapes-cheese-has-terms"
venueId: "corner-store-court"
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
  - lineToken: "red-tapes-cheese-has-terms:pre:0"
    speaker: "Cornball"
    portraitAssetId: "assets/characters/cornball.webp"
    text: "Welcome to Cornball's Liquid Gold. Basic gets chips. Premium gets eye contact."
  - lineToken: "red-tapes-cheese-has-terms:pre:1"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "Why does your cheese have a cancellation policy?"
  - lineToken: "red-tapes-cheese-has-terms:pre:2"
    speaker: "Cornball"
    portraitAssetId: "assets/characters/cornball.webp"
    text: "Recurring revenue. Snitch said think bigger."
  - lineToken: "red-tapes-cheese-has-terms:pre:3"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "You put a subscription on a dairy product."
  - lineToken: "red-tapes-cheese-has-terms:pre:4"
    speaker: "Cornball"
    portraitAssetId: "assets/characters/cornball.webp"
    text: "Don't reduce my company to its ingredients."
  - lineToken: "red-tapes-cheese-has-terms:pre:5"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "I'm not paying nine dollars to unlock a ladle."
  - lineToken: "red-tapes-cheese-has-terms:pre:6"
    speaker: "Cornball"
    portraitAssetId: "assets/characters/cornball.webp"
    text: "The ladle is infrastructure. The vision is free."
  - lineToken: "red-tapes-cheese-has-terms:pre:7"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "The card match is free too. Before you try to bundle it."
  - lineToken: "red-tapes-cheese-has-terms:pre:8"
    speaker: "Cornball"
    portraitAssetId: "assets/characters/cornball.webp"
    text: "Table two. I move cards around. Pay attention. Unlike the people who ignored my sauce survey."
```

### After victory

```yaml
lines:
  - lineToken: "red-tapes-cheese-has-terms:post:0"
    speaker: "Cornball"
    portraitAssetId: "assets/characters/cornball.webp"
    text: "Okay. I lost the match. The company remains confident."
  - lineToken: "red-tapes-cheese-has-terms:post:1"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "Your company has formed a skin."
  - lineToken: "red-tapes-cheese-has-terms:post:2"
    speaker: "Cornball"
    portraitAssetId: "assets/characters/cornball.webp"
    text: "That's the protective layer. Premium customers get underneath it."
  - lineToken: "red-tapes-cheese-has-terms:post:3"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "Why the hell is the dispenser breathing?"
  - lineToken: "red-tapes-cheese-has-terms:post:4"
    speaker: "Cornball"
    portraitAssetId: "assets/characters/cornball.webp"
    text: "Because the cheese is alive with opportunity."
  - lineToken: "red-tapes-cheese-has-terms:post:5"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "Unplug it. Stamp their card. In that order."
  - lineToken: "red-tapes-cheese-has-terms:post:6"
    speaker: "Cornball"
    portraitAssetId: "assets/characters/cornball.webp"
    text: "Second table cleared. Don't put my loss on the business page."
```

### Defeat / retry — optional integration hook

```yaml
lines:
  - lineToken: "red-tapes-cheese-has-terms:defeat:0"
    speaker: "Cornball"
    portraitAssetId: "assets/characters/cornball.webp"
    text: "That's a loss. Rematch is free. Emotional recovery is on the deluxe menu."
```

**Exit:** Cornball unplugs the dispenser. It exhales one enormous air bubble. Everybody steps back except Blue, who is already backing away with the founder chair. Wifey makes Cornball cover the food and stop serving; the joke does not become someone eating spoiled food.

## 3. Proposed game contract

Node `red-tapes-cheese-has-terms` in [chapter-two.proposed.json](../chapter-two.proposed.json) contains the full proposed definition: prerequisites, map position, dialogue, rewards, and seven-card deck, modifiers, phases, teaching, and objectives. All Chapter Two node IDs and media paths are new and unregistered.

Opponent: **Cornball**. Type: **standard**. Behavior profile: `movement`.

Deck keys: `cornball`, `bikelife`, `vibe`, `plug`, `snow`, `rastamon`, `hooper`.

```json
{
  "modifiers": {},
  "phases": []
}
```

Teaching: Movement effects can change which districts you hold after reveal. Leave room to respond instead of committing every card to one lane.

Proposed first-clear reward: **125 street-xp**. First three-star clear: **one Street Pack Ticket** under the existing rule. Stars: win; finish holding all three districts; win without SQUABBLE. A normal win advances. Proposed balance is not playtested.

## 4. Continuity and handoff

Cornball's literal corn/clown appearance remains the identity reference. His seven-card movement deck must still be a credible but approachable fight. No paywall, subscription mechanic, consumable, or food reward is introduced.

Preserve before-fight versus victory gating. Keep retry lines outside the canonical dialogue arrays. New speakers need roster integration even if their portrait file already exists. See [production and integration handoff](../HANDOFF.md) for missing art, exports, and validation status.

