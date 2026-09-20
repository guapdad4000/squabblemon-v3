# Block Crowned

Scene 08 · Node `block-crowned` · Revised screenplay, 2026-09-08.

Canon: [story bible](../../../STORY_BIBLE.md). Integration status: authored, not yet loaded into the game.

## 1. Stage

**Dramatic purpose:** Pay off the player's open-access goal, give the supporting cast agency, and launch Chapter 2 through Red's concealed message.

Snitch produces a plastic Crown from a velvet cushion suspiciously shaped like a neck pillow. Wifey arrives with the actual scheduling board. Cornball distributes paper cups and explains to nobody that the cup is complimentary but his time is not. Baby Momma reaches the stairs carrying a handbag large enough to contain either paperwork or a small home appliance. She disconnects the ring light before speaking. Keep the child off-screen. No optional-alley completion is assumed.

```yaml
parallaxSceneId: "block-party:block-crowned:ceremony"
venueId: "crown-rooftop-court"
mood: "rooftop"
durationMs: 6400
grain: 0.05
layers:
  - { id: "night-sky", depth: 0, parallaxX: 0.05, parallaxY: 0, widthFactor: 1.3, anchor: { x: 0.6, y: 0.6 } }
  - { id: "rooftop", depth: 0.35, parallaxX: 0.3, parallaxY: 0.2, widthFactor: 1.3, anchor: { x: 0.6, y: 0.6 } }
  - { id: "schedule-board", depth: 0.6, parallaxX: 0.6, parallaxY: 0.2, widthFactor: 0.6, anchor: { x: 0.6, y: 0.6 } }
  - { id: "baby-momma", depth: 0.85, parallaxX: 0.9, parallaxY: 0.2, widthFactor: 0.6, anchor: { x: 0.6, y: 0.6 } }
  - { id: "cracked-head", depth: 0.9, parallaxX: 0.95, parallaxY: 0.2, widthFactor: 0.6, anchor: { x: 0.3, y: 0.6 } }
cameraPath:
  - { x: 0.5, y: 0.5, zoom: 1.0, holdMs: 1800, ease: easeInOut }
  - { x: 0.6, y: 0.55, zoom: 1.2, holdMs: 2400, ease: easeInOut }
  - { x: 0.5, y: 0.6, zoom: 1.05, holdMs: 2200, ease: easeInOut }
```

These layers are a proposed art brief. This scene ID is proposed and requires registration. Venue labels identify existing battle settings; the story venue registry still needs population. The 6.4-second camera move is an establishing shot only. Hold the last frame and advance dialogue on player input. Draw the dialogue box as UI, not text baked into art. Focus on `baby-momma` for the principal exchange; keep readable reaction shots for the other speaker.

## 2. Dialogue

Dialogue is player-advanced. Tokens match the current node/section/index convention; stage business is never spoken. This is the heightened comedy-drama revision.

### Ceremony

```yaml
lines:
  - lineToken: "block-crowned:main:0"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "We got a winner. Crown, schedule, seat for your crew. Please don't start appointing cousins to positions."
  - lineToken: "block-crowned:main:1"
    speaker: "Wifey"
    portraitAssetId: "assets/characters/wifey.webp"
    text: "Open play means everybody. I'm laminating this. Y'all respect plastic more than a promise."
  - lineToken: "block-crowned:main:2"
    speaker: "Ganger Blue"
    portraitAssetId: "assets/characters/ganger-blue.webp"
    text: "I'll bring the lights. Don't make a whole announcement about it."
  - lineToken: "block-crowned:main:3"
    speaker: "Cornball"
    portraitAssetId: "assets/characters/cornball.webp"
    text: "I'll bring drinks. Bought from a human. With witnesses."
  - lineToken: "block-crowned:main:4"
    speaker: "Snitch"
    portraitAssetId: "assets/characters/snitch.webp"
    text: "Everybody squeeze in. Winner in the middle, resurrected gentleman slightly to the—"
  - lineToken: "block-crowned:main:5"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "Unplug whatever is making you comfortable."
  - lineToken: "block-crowned:main:6"
    speaker: "Snitch"
    portraitAssetId: "assets/characters/snitch.webp"
    text: "We're just doing a little celebration—"
  - lineToken: "block-crowned:main:7"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "I see. Four years dead and his ass somehow found VIP."
  - lineToken: "block-crowned:main:8"
    speaker: "Cracked Head"
    portraitAssetId: "assets/characters/cracked-head.webp"
    text: "I was coming to see you."
  - lineToken: "block-crowned:main:9"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "When? After the press tour? My address ain't changed. Even the pizza man knows when I'm upset."
  - lineToken: "block-crowned:main:10"
    speaker: "Cracked Head"
    portraitAssetId: "assets/characters/cracked-head.webp"
    text: "Can we do this somewhere private?"
  - lineToken: "block-crowned:main:11"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "NOW you believe in privacy. Came through that door with smoke and a church organ like you got a season finale."
  - lineToken: "block-crowned:main:12"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "Before y'all go. I got something she needs to hear."
  - lineToken: "block-crowned:main:13"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "Red. That envelope better be an apology with direct deposit."
  - lineToken: "block-crowned:main:14"
    speaker: "Ganger Red"
    portraitAssetId: "assets/characters/ganger-red.webp"
    text: "It's a recording. From him. Four years ago."
  - lineToken: "block-crowned:main:15"
    speaker: "Baby Momma"
    portraitAssetId: "assets/characters/baby-momma.webp"
    text: "Four years? Oh, put the chairs back. Apparently BOTH of y'all got a presentation."
```

**Exit:** Baby Momma takes the recording sleeve from Red and pulls out the nearest chair. Cracked Head starts to sit beside her. She slides it toward Red instead. Wifey silently sets down two unopened bottles of water like this meeting has been scheduled for months. Cornball retreats with the cups. Snitch lifts one phone an inch; Baby Momma looks at him and it goes face down. Cut before the recording plays. Leave the Crown crooked on its cushion beside the player's deck.

## 3. Reward contract

```yaml
nodeId: "block-crowned"
kind: "reward"
mechanicsSource: "lib/squabblemon-engine/src/story.ts#blockPartyChapter/block-crowned"
mechanicalChanges: none
```

Reward node only, unlocked by the existing Cracked Head boss victory. No new match, choice, bonus condition, or character unlock.

**Rewards:** Existing ceremony grants: card nerd ×1; street-pack-ticket ×10; block-party-crowned cosmetic ×1; story-key:chapter-two ×1. The card is a tournament prize, not a character extracted from the boss's deck. Completing the ceremony opens the playable Chapter Two route.



## 4. Drama and director handoff

This ending works without the optional alley scene: Cornball arrives with paper cups regardless. Baby Momma commandeers the ceremony and seats Red for an immediate reckoning. Her child's paternity remains Chapter 2 information; no second pregnancy is introduced. Red runs the ceremony, and the unused Crowned Host roster entry stays unused.

- Dialogue is complete for this scene's main route.
- Proposed layers and speaker staging require art review; this file does not certify assets as delivered.
- Dialogue/camera cue integration should use input-driven beats, with no fixed cue advancing unread text.
- Sound direction: venue ambience beneath conversation; lower crowd sound during personal exchanges. Optional hooks require an audio-bus mapping before use.
- Validate rewards and node identity against the existing engine at integration time. Do not copy obsolete unlock promises from the earlier templates.
