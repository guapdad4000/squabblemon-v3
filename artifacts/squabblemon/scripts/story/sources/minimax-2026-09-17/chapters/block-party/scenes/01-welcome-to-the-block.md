# SCENE — `block-party:welcome-to-the-block`

> Worked example for a single scene. This is the opening battle of
> Chapter 1. Copy this file to author the other 7 scenes.

---

## 1. Stage

```yaml
parallaxSceneId: block-party:opening:alley
venueId: corner-store-court
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
  - id: storefront
    depth: 0.4
    parallaxX: 0.4
    parallaxY: 0.2
    widthFactor: 1.1
    anchor: { x: 0.5, y: 0.65 }
  - id: lamp-post
    depth: 0.7
    parallaxX: 0.8
    parallaxY: 0.5
    widthFactor: 0.4
    anchor: { x: 0.15, y: 0.6 }
  - id: ganger-blue
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.7, y: 0.62 }
  - id: cornball
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.3, y: 0.7 }
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
  - { x: 0.4, y: 0.6, zoom: 1.1, holdMs: 2200, ease: easeInOut }     # pull back to show the corner store
```

---

## 2. Dialog

> Pre-battle dialogue. The runtime renders these via the `DialogueScene`
> component (or the in-engine `DialogueView` in `Story.tsx`).

```yaml
lines:
  - lineToken: block-party:welcome:pre:0
    speaker: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    soundHook: story.crowd.ambience
    text: |
      Welcome to the Block. Two districts. Don't make me say it twice.
  - lineToken: block-party:welcome:pre:1
    speaker: Cornball
    portraitAssetId: assets/characters/cornball.webp
    soundHook: story.footstep
    text: |
      (Cornball kicks a vending machine.) You heard the man. Get in.
  - lineToken: block-party:welcome:pre:2
    speaker: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    soundHook: story.crowd.cheer
    focusLayer: ganger-blue
    text: |
      You can hold ground. Now hold it under pressure.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: block-party:welcome:pre:0, atMs: 0,    soundHook: story.crowd.ambience }
  - { lineToken: block-party:welcome:pre:1, atMs: 1800, soundHook: story.footstep }
  - { lineToken: block-party:welcome:pre:2, atMs: 3200, soundHook: story.crowd.cheer, focusLayerId: ganger-blue }
```

---

## 3. Battle

```yaml
battle:
  id: welcome-to-the-block
  title: "Welcome to the Block"
  battleType: guided
  mapPosition: { x: 8, y: 76 }
  prerequisites: []
  optional: false
  enemy:
    name: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    behaviorProfile: balanced
    deck:
      - cornball
      - snow
      - roaster
      - rastamon
      - wifey
      - oink
      - baby
  cinematic:
    videoAssetId: assets/story/chapter-one/media/chapter-opening.mp4
    posterAssetId: assets/story/chapter-one/media/chapter-opening.webp
    environmentAssetId: assets/venues/corner-store-court.webp
  modifiers: {}
  phases: []
  starObjectives:
    - { id: win,       description: Win the encounter. }
    - { id: districts, description: Finish holding all three districts. }
    - { id: squabble,  description: Win without using SQUABBLE. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 50 }
    - { kind: character-unlock, id: ganger-blue, amount: 1 }   # first meeting, the player unlocks Ganger Blue
  teaching:
    tips:
      - "Play where district rules help your card."
      - "You only need two districts to win."
    focusMechanics: [district scoring, Motion]
    focusCards: [cornball, snow]
```

---

## 4. Drama notes

- **The setup:** Ganger Blue's "Two districts. Don't make me say it
  twice" is the season's first recurring line. Echo it in chapter 5
  ("Two districts. I only needed one.") and chapter 8 ("Zero districts.
  That's what you get for snitching.").
- **The character unlock:** Ganger Blue unlocks as a playable rival
  portrait. The next time the player sees him, he should feel like a
  familiar face, not a stranger.
- **The pacing:** This is a guided battle. Use it to teach the player
  the 3-stars-to-ticket loop. Show the 3 stars, show the ticket, show
  the chapter map.
