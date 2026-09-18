# SCENE — `block-party:blue-side-pressure`

> Standard battle. Ganger Blue's home turf. This is the season's
> first "test" battle — Blue isn't the villain, he's the gauge.
> The "Two districts. Don't make me say it twice" line is the
> season's first recurring line; it echoes across chapters 5 and 8.

---

## 1. Stage

```yaml
parallaxSceneId: block-party:blue-side:pressure
venueId: blue-side-court
mood: block
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
  - id: brick-wall
    depth: 0.3
    parallaxX: 0.25
    parallaxY: 0.15
    widthFactor: 1.2
    anchor: { x: 0.5, y: 0.55 }
  - id: chain-link
    depth: 0.55
    parallaxX: 0.55
    parallaxY: 0.25
    widthFactor: 1.0
    anchor: { x: 0.5, y: 0.65 }
  - id: blue-court-poster
    depth: 0.7
    parallaxX: 0.7
    parallaxY: 0.3
    widthFactor: 0.5
    anchor: { x: 0.15, y: 0.45 }
  - id: ganger-blue
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
  - { x: 0.7, y: 0.55, zoom: 1.25, holdMs: 2400, ease: easeInOut }   # close on Ganger Blue
  - { x: 0.3, y: 0.6, zoom: 1.1, holdMs: 2200, ease: easeInOut }     # pull back to show the Blue Side court
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: block-party:blue-side-pressure:pre:0
    speaker: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    soundHook: story.crowd.ambience
    text: |
      Two districts. Don't make me say it twice.
  - lineToken: block-party:blue-side-pressure:pre:1
    speaker: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    soundHook: story.crowd.cheer
    focusLayer: ganger-blue
    text: |
      You held the corner. Now hold the block. Red's coming and
      he don't play fair.
  - lineToken: block-party:blue-side-pressure:pre:2
    speaker: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    soundHook: story.footstep
    text: |
      I'm not your enemy. I'm the test. If you can't beat me
      here, Red's gonna bury you on camera.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: block-party:blue-side-pressure:pre:0, atMs: 0,    soundHook: story.crowd.ambience }
  - { lineToken: block-party:blue-side-pressure:pre:1, atMs: 1800, soundHook: story.crowd.cheer, focusLayerId: ganger-blue }
  - { lineToken: block-party:blue-side-pressure:pre:2, atMs: 3600, soundHook: story.footstep }
```

---

## 3. Battle

```yaml
battle:
  id: blue-side-pressure
  title: "Blue Side Pressure"
  battleType: standard
  mapPosition: { x: 23, y: 62 }
  prerequisites: [welcome-to-the-block]
  optional: false
  enemy:
    name: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    behaviorProfile: balanced
    deck:
      - ganger-blue
      - snow
      - roaster
      - wifey
      - baby
      - oink
      - plug
  cinematic:
    videoAssetId: assets/story/chapter-one/media/blue-side-pressure.mp4
    posterAssetId: assets/story/chapter-one/media/blue-side-pressure.webp
    environmentAssetId: assets/venues/blue-side-court.webp
  modifiers:
    districtDenial: blue             # holding all three districts denies Blue's anchor play
  phases: []
  starObjectives:
    - { id: win,       description: Win the encounter. }
    - { id: districts, description: Hold all three districts. }
    - { id: squabble,  description: Win without using SQUABBLE. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 75 }
    # NOTE: Ganger Blue was already unlocked in scene 01. No unlock here.
  teaching:
    tips:
      - "Blue Side decks play tempo — match it, don't fight it."
      - "Holding all three districts denies Blue's anchor play."
      - "This is the chapter's test. Pass it and Red shows up clean."
    focusMechanics: [district denial, tempo matching]
    focusCards: [cornball, snow, ganger-blue]
```

---

## 4. Drama notes

- **The test:** Ganger Blue is the chapter's test, not its villain.
  He unlocks the player's understanding of district denial. Win
  clean here and Red shows up clean in scene 03.
- **The recurring line:** "Two districts. Don't make me say it
  twice" is the season's first recurring line. It echoes across
  the season: chapter 5 ("Two districts. I only needed one."),
  chapter 8 ("Zero districts. That's what you get for snitching.").
  This scene establishes the cadence.
- **The setup:** "Red's coming and he don't play fair" is the
  setup for scene 03 — Red brings receipts (the camera is rolling)
  and the middle district locks.