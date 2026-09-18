# SCENE — `the-function:opening`

> Opening battle of Chapter 6. Bottle Girl opens the bar.
> Live Streamer starts narrating. The whole block is here.
> This is the chapter's "function mode" — every cameo
> character is in the room. The fight is for the bartender's
> attention.

---

## 1. Stage

```yaml
parallaxSceneId: the-function:opening:bar
venueId: function-venue
mood: night
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
  - id: venue-wall
    depth: 0.3
    parallaxX: 0.25
    parallaxY: 0.15
    widthFactor: 1.2
    anchor: { x: 0.5, y: 0.55 }
  - id: bar
    depth: 0.55
    parallaxX: 0.5
    parallaxY: 0.25
    widthFactor: 1.0
    anchor: { x: 0.5, y: 0.6 }                          # the bar, center stage
  - id: bottle-girl
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.5, y: 0.55 }                        # Bottle Girl behind the bar
  - id: live-streamer
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.18, y: 0.66 }                       # Live Streamer on the wall, camera rolling
  - id: cornball
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.4
    anchor: { x: 0.85, y: 0.78 }                       # Cornball at the end of the bar, snacks
  - id: og-uncle
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.78, y: 0.66 }                       # OG Uncle in the back, still standing (wheelchair from Ch7)
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
  - { x: 0.5, y: 0.5, zoom: 1.0, holdMs: 1800, ease: easeInOut }     # wide on the venue
  - { x: 0.5, y: 0.55, zoom: 1.3, holdMs: 2400, ease: easeInOut }    # close on Bottle Girl behind the bar
  - { x: 0.18, y: 0.55, zoom: 1.15, holdMs: 2200, ease: easeInOut }   # cut to Live Streamer
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: the-function:opening:pre:0
    speaker: Bottle Girl
    portraitAssetId: assets/characters/bottle-girl.webp
    soundHook: story.bar.bottles
    text: |
      Welcome to the function. Everybody's in the room —
      Blue, Red, Baby Momma, OG, the kid, the corner. I'm
      running the bar. You want a drink, you earn it.
  - lineToken: the-function:opening:pre:1
    speaker: Live Streamer
    portraitAssetId: assets/characters/live-streamer.webp
    soundHook: story.stream.start
    focusLayer: live-streamer
    text: |
      (From the wall.) Camera's rolling. Welcome to season
      one, chapter six. The party before the war.
  - lineToken: the-function:opening:pre:2
    speaker: Cornball
    portraitAssetId: assets/characters/cornball.webp
    soundHook: story.crowd.ambience
    text: |
      (Cornball shakes a bag of chips.) Yo — they got the
      chips out, the music up, OG Uncle at the bar. This
      function is the function.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: the-function:opening:pre:0, atMs: 0,    soundHook: story.bar.bottles }
  - { lineToken: the-function:opening:pre:1, atMs: 2000, soundHook: story.stream.start, focusLayerId: live-streamer }
  - { lineToken: the-function:opening:pre:2, atMs: 4000, soundHook: story.crowd.ambience }
```

---

## 3. Battle

```yaml
battle:
  id: the-function
  title: "The Function"
  battleType: guided
  mapPosition: { x: 20, y: 65 }
  prerequisites: []
  optional: false
  enemy:
    name: Bottle Girl
    portraitAssetId: assets/characters/bottle-girl.webp
    behaviorProfile: balanced
    deck:
      - bottle-girl
      - live-streamer
      - cornball
      - snow
      - rastamon
      - plug
      - og-uncle
  cinematic:
    videoAssetId: assets/story/chapter-six/media/the-function.mp4
    posterAssetId: assets/story/chapter-six/media/the-function.webp
    environmentAssetId: assets/venues/function-venue.webp
  modifiers:
    functionMode: true                # FLAG: every cameo character is in the room — both players see them
    handSizeBonus: 1                 # the function gives the player one extra card in opening hand
  phases: []
  starObjectives:
    - { id: win,       description: Win the encounter. }
    - { id: districts, description: Hold all three districts at the function. }
    - { id: room,      description: Win while every cameo character's card is in play. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 75 }
    # NOTE: Bottle Girl unlocks at finale (cracked-head-walks-in), not here.
  teaching:
    tips:
      - "Function mode means every cameo character is in the room — don't exile any."
      - "Hold all three districts while the party ramps up."
      - "The booking happens in scene 03. The finale is Cracked Head's entrance."
    focusMechanics: [function mode, hand size bonus, district scoring]
    focusCards: [cornball, snow, bottle-girl]
```

---

## 4. Drama notes

- **The chapter mechanic:** `functionMode: true` is the
  chapter's signature. Every cameo character is in the room —
  the player's deck includes their cards. The third-star
  objective enforces this — don't exile any cameo character.
- **The cast:** Live Streamer, Cornball, OG Uncle are visible
  in this scene. Baby Momma, Red, Blue, Wifey are off-frame
  but in the room (their cards are in play). The whole block
  is here.
- **Live Streamer's meta-role:** His "Camera's rolling" line
  is the runtime's narrator voice for the chapter. Per the
  season arc character list: "Live Streamer — narrates the
  season." He's the chapter's meta-presence.
- **OG Uncle's presence:** He's still standing — the
  wheelchair starts in Ch7. He sees Cracked Head walk in
  later. The moment is between them.
- **The setup:** Scene 02 (the-bar-fight) is a fight that
  breaks out at the function. Scene 03 (the-booking) is
  Promoter setting up the return fight. Scene 04
  (cracked-head-walks-in) is the finale.