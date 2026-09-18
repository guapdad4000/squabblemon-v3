# SCENE — `block-party:side-alley-challenge`

> Optional mastery match. Alley Runner — the recurring cameo who
> appears in every chapter's alley scene — offers a side match
> against the player. The vending machine Cornball kicked in
> scene 01 is here too; kicking it again is the mastery check.
> Snitch's "Watching the Feed" line is dropped here as a setup for
> scene 06's mini-boss payoff.

---

## 1. Stage

```yaml
parallaxSceneId: block-party:side-alley:challenge
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
    anchor: { x: 0.18, y: 0.7 }
  - id: vending-machine
    depth: 0.65
    parallaxX: 0.55
    parallaxY: 0.35
    widthFactor: 0.35
    anchor: { x: 0.85, y: 0.72 }                    # the same vending machine Cornball kicked in scene 01
  - id: alley-runner
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.35, y: 0.62 }                    # Alley Runner mid-shot, leaning
  - id: snitch
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.78, y: 0.66 }                    # Snitch at the alley entrance, watching
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
  - { x: 0.35, y: 0.55, zoom: 1.3, holdMs: 2400, ease: easeInOut }   # tight on Alley Runner
  - { x: 0.85, y: 0.65, zoom: 1.15, holdMs: 2200, ease: easeInOut }  # pull back to the vending machine
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: block-party:side-alley-challenge:pre:0
    speaker: Alley Runner
    portraitAssetId: assets/characters/alley-runner.webp
    soundHook: story.alley.footsteps
    text: |
      Yo — you made it to the alley. Good. Most don't. You want
      the mastery? Kick the vending machine. It's tradition.
  - lineToken: block-party:side-alley-challenge:pre:1
    speaker: Snitch
    portraitAssetId: assets/characters/snitch.webp
    soundHook: story.tape.rewind
    focusLayer: snitch
    text: |
      (From the alley mouth.) I'm watching the feed. Every alley,
      every corner, every tape. Don't make me cash this in.
  - lineToken: block-party:side-alley-challenge:pre:2
    speaker: Alley Runner
    portraitAssetId: assets/characters/alley-runner.webp
    soundHook: story.vending.kick
    text: |
      You heard the man. Kick it, beat me, and the alley's yours.
      Lose clean and Snitch remembers. Choose wisely.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: block-party:side-alley-challenge:pre:0, atMs: 0,    soundHook: story.alley.footsteps }
  - { lineToken: block-party:side-alley-challenge:pre:1, atMs: 1800, soundHook: story.tape.rewind, focusLayerId: snitch }
  - { lineToken: block-party:side-alley-challenge:pre:2, atMs: 3600, soundHook: story.vending.kick }
```

---

## 3. Battle

```yaml
battle:
  id: side-alley-challenge
  title: "Side Alley Challenge"
  battleType: standard
  mapPosition: { x: 52, y: 76 }
  prerequisites: [blue-side-pressure]
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
    videoAssetId: assets/story/chapter-one/media/side-alley-challenge.mp4
    posterAssetId: assets/story/chapter-one/media/side-alley-challenge.webp
    environmentAssetId: assets/venues/alley.webp
  modifiers:
    vendingMachineKick: true                # once per game: kick the vending machine for +1 power to next card
    snitchWatching: true                    # FLAG: Snitch is recording this for scene 06's +2 motion
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
      - "Vending-machine kick gives +1 power to your next card. Use it on a finisher."
      - "Snitch is recording this — win clean or he'll have fresh intel on you in scene 06."
      - "Alley mastery carries into chapter 2's alley-tape (optional) and chapter 7's return fight."
    focusMechanics: [vending machine kick, district denial, alley tempo]
    focusCards: [cornball, snow, alley-runner]
```

---

## 4. Drama notes

- **The mastery scene:** This is the chapter's optional side
  route. Winning clean (3 stars) carries the
  `vendingMachineKick` modifier into the boss fight as a
  player-side buff. Skipping the mastery means no vending machine
  buff in the boss — the player has to win on pure tempo.
- **The setup:** Snitch's "I'm watching the feed" line is the
  setup for the scene 06 mini-boss. Snitch is recording this
  match. The player can win and have the chatter forgotten
  (Snitch's intel is dated, his +2 motion comes a turn late in
  scene 06) or lose and have the chatter cashed in fresh (+2
  motion at round 4, as scripted).
- **The callback:** The vending machine here is the same one
  Cornball kicked in scene 01. The director should reuse the
  same sprite asset. The season's first cross-scene callback.
- **The cameo:** Alley Runner is a recurring cameo across the
  season — chapter 2 (alley-tape), chapter 5 (Old Heads Know),
  chapter 6 (The Function). He is NOT unlocked as a rival
  portrait (cameo only); the player only gets his card.