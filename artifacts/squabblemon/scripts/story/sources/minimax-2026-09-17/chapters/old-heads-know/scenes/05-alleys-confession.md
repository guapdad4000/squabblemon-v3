# SCENE — `old-heads-know:alleys-confession`

> Optional mastery match. Alley Runner — recurring cameo — is
> in the alley. He offers a side match where the player can
> confess what they've learned. The mastery carries into the
> boss fight (scene 07): a confession buff that gives the
> player +1 power when the verdict lands.

---

## 1. Stage

```yaml
parallaxSceneId: old-heads-know:alley:confession
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
  - id: alley-runner
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.7, y: 0.62 }
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
  - { x: 0.7, y: 0.55, zoom: 1.3, holdMs: 2400, ease: easeInOut }    # tight on Alley Runner
  - { x: 0.4, y: 0.6, zoom: 1.1, holdMs: 2200, ease: easeInOut }     # pull back to show the alley
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: old-heads-know:alleys-confession:pre:0
    speaker: Alley Runner
    portraitAssetId: assets/characters/alley-runner.webp
    soundHook: story.alley.footsteps
    text: |
      Yo — you made it to the alley again. The family council
      got you this far. Now the alley wants a confession.
  - lineToken: old-heads-know:alleys-confession:pre:1
    speaker: Alley Runner
    portraitAssetId: assets/characters/alley-runner.webp
    soundHook: story.tape.scrub
    focusLayer: alley-runner
    text: |
      Tell me what you learned. The kid. The receipts. The
      truth. Confess it out loud, and the alley blesses you.
      Hold it in, and the alley takes it.
  - lineToken: old-heads-know:alleys-confession:pre:2
    speaker: Alley Runner
    portraitAssetId: assets/characters/alley-runner.webp
    soundHook: story.crowd.cheer
    text: |
      Beat me clean and your deck carries +1 power into the
      verdict. OG Uncle's gonna ask what you know. Show 'em
      you know.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: old-heads-know:alleys-confession:pre:0, atMs: 0,    soundHook: story.alley.footsteps }
  - { lineToken: old-heads-know:alleys-confession:pre:1, atMs: 1800, soundHook: story.tape.scrub, focusLayerId: alley-runner }
  - { lineToken: old-heads-know:alleys-confession:pre:2, atMs: 3600, soundHook: story.crowd.cheer }
```

---

## 3. Battle

```yaml
battle:
  id: alleys-confession
  title: "Alley's Confession"
  battleType: standard
  mapPosition: { x: 52, y: 76 }
  prerequisites: [baby-mommas-truth]
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
    videoAssetId: assets/story/chapter-five/media/alleys-confession.mp4
    posterAssetId: assets/story/chapter-five/media/alleys-confession.webp
    environmentAssetId: assets/venues/alley.webp
  modifiers:
    familyCouncil: true                  # carries over
    alleyMastery: true                    # FLAG: winning clean grants +1 power buff in boss fight
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
      - "Confess what you've learned — the alley is listening."
      - "Win this clean and your deck gets +1 power in OG Uncle's verdict."
      - "Family-council mode carries — keep all family cards in play."
    focusMechanics: [family council mode, alley tempo, confession buff]
    focusCards: [cornball, snow, alley-runner]
```

---

## 4. Drama notes

- **The mastery scene:** This is the chapter's optional side
  route. Winning clean (3 stars) carries the `alleyMastery:
  true` modifier into the boss fight as a player-side buff —
  +1 power during OG Uncle's verdict. Skipping the mastery
  means no power buff in the boss — the player has to win on
  pure tempo.
- **The confession mechanic:** Alley Runner's "Confess it out
  loud, and the alley blesses you. Hold it in, and the alley
  takes it." is the chapter's secondary mechanic. The alley
  requires verbal acknowledgment — the player has to say the
  truth out loud.
- **The cameo:** Alley Runner returns in chapter 6 (The
  Function) and chapter 7 (Return of the Block). He is NOT
  unlocked as a rival portrait (cameo only); the player only
  gets his card.
- **The setup:** Scene 07 (OG Uncle's verdict) requires the
  player to demonstrate they know the truth. The mastery
  buff carries this demonstration into the boss fight.