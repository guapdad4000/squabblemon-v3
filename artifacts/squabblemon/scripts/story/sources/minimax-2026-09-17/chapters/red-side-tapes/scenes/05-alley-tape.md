# SCENE — `red-side-tapes:alley-tape`

> Optional mastery match. Alley Runner — recurring cameo from
> chapter 1's `side-alley-challenge` — teaches the player the
> "tape trade" mechanic the boss fight in scene 07 will lean on.
> This scene is at the same alley venue as chapter 1, but the
> camera framing is tighter: Alley Runner doesn't take sides, he
> takes footage.

---

## 1. Stage

```yaml
parallaxSceneId: red-side-tapes:alley:tape
venueId: alley
mood: alley
durationMs: 6400
grain: 0.05
```

### Layer stack (back → front)

```yaml
layers:
  - id: sky
    depth: 0
    parallaxX: 0.05
    parallaxY: 0
    widthFactor: 1.4
    anchor: { x: 0.5, y: 0.5 }
    cacheable: true
  - id: alley-brick
    depth: 0.3
    parallaxX: 0.25
    parallaxY: 0.15
    widthFactor: 1.2
    anchor: { x: 0.5, y: 0.55 }
  - id: dumpster
    depth: 0.5
    parallaxX: 0.5
    parallaxY: 0.25
    widthFactor: 0.6
    anchor: { x: 0.18, y: 0.7 }                      # alley dumpster
  - id: alley-runner
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.7, y: 0.62 }                     # close on Alley Runner
  - id: dialog-box
    depth: 1
    parallaxX: 1
    parallaxY: 1
    widthFactor: 0.9
    anchor: { x: 0.5, y: 0.9 }
```

### Camera waypoints

```yaml
cameraPath:
  - { x: 0.5, y: 0.5, zoom: 1.0, holdMs: 1800, ease: easeInOut }
  - { x: 0.7, y: 0.55, zoom: 1.3, holdMs: 2400, ease: easeInOut }    # tight close on Alley Runner
  - { x: 0.4, y: 0.6, zoom: 1.1, holdMs: 2200, ease: easeInOut }     # pull back to show the alley
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: red-side-tapes:alley-tape:pre:0
    speaker: Alley Runner
    portraitAssetId: assets/characters/alley-runner.webp
    soundHook: story.alley.footsteps
    text: |
      Yo — you're making the tape rounds too? Good. Let me show
      you how the alley reads the corner. Same game, different
      camera angle.
  - lineToken: red-side-tapes:alley-tape:pre:1
    speaker: Alley Runner
    portraitAssetId: assets/characters/alley-runner.webp
    soundHook: story.tape.rewind
    focusLayer: alley-runner
    text: |
      I don't take sides. I take footage. Both tapes, both sides,
      both alleys — I run 'em all. Mastery means you can too.
  - lineToken: red-side-tapes:alley-tape:pre:2
    speaker: Alley Runner
    portraitAssetId: assets/characters/alley-runner.webp
    soundHook: story.crowd.cheer
    text: |
      You want the mastery? Hold the alley and the corner at the
      same time. That's the whole game. Tape trade once. Just once.
      Make it count.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: red-side-tapes:alley-tape:pre:0, atMs: 0,    soundHook: story.alley.footsteps }
  - { lineToken: red-side-tapes:alley-tape:pre:1, atMs: 1800, soundHook: story.tape.rewind, focusLayerId: alley-runner }
  - { lineToken: red-side-tapes:alley-tape:pre:2, atMs: 3600, soundHook: story.crowd.cheer }
```

---

## 3. Battle

```yaml
battle:
  id: alley-tape
  title: "Alley Tape"
  battleType: standard
  mapPosition: { x: 52, y: 76 }
  prerequisites: [red-side-testimony]
  optional: true                            # optional mastery match
  enemy:
    name: Alley Runner
    portraitAssetId: assets/characters/alley-runner.webp
    behaviorProfile: balanced
    deck:
      - alley-runner
      - cornball
      - snow
      - rastamon
      - plug
      - snitch
      - oink
  cinematic:
    videoAssetId: assets/story/chapter-two/media/alley-tape.mp4
    posterAssetId: assets/story/chapter-two/media/alley-tape.webp
    environmentAssetId: assets/venues/alley.webp
  modifiers:
    tapeTrade: 1                            # once per game, peek + swap the top card of your deck
  phases: []
  starObjectives:
    - { id: win,       description: Win the encounter. }
    - { id: districts, description: Hold the alley and the corner at the same time. }
    - { id: squabble,  description: Win without using SQUABBLE. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 75 }
    - { kind: card, id: alley-runner, amount: 1 }   # Alley Runner card drops here; not a character unlock (cameo only)
  teaching:
    tips:
      - "Tape trade once — peek the top of your deck, swap a card from your hand. Use it turn 1 or turn 4."
      - "Holding alley + corner locks both sides' anchor plays."
      - "This mastery carries into the boss fight in scene 07."
    focusMechanics: [tape trade, district denial, Motion]
    focusCards: [cornball, snow, alley-runner]
```

---

## 4. Drama notes

- **The mastery scene:** This is the player's optional side route.
  Winning clean (3 stars) carries the `tapeTrade: 1` mechanic into
  the boss fight as a player-side modifier. Skipping the mastery
  means no tape trade in the boss — the player has to win on pure
  tempo.
- **The cameo:** Alley Runner was a chapter-1 cameo (side-alley-
  challenge). He returns here for the same role. He's a recurring
  cameo across the season — chapter 5 (Old Heads) and chapter 6
  (The Function) both list him. He is NOT unlocked as a rival
  portrait (cameo only); the player only gets his card.
- **The setup:** Alley Runner's "I don't take sides. I take footage."
  is a setup for `baby-momma-plays-the-card`, where the player's
  footage-of-record is the tape they choose to play. The alley
  reads the corner — meaning the alley has seen everything.