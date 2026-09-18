# SCENE — `side-show:the-scammers-pitch`

> Rule-twist battle. A Scammer — chapter antagonist — offers
> "better" (fake) receipts at half price. The middle district
> locks (similar to Ch1's `receipts-on-camera`). The twist: the
> Scammer's deck contains watermarked fakes — cards that LOOK
> verified but aren't. The player has to spot the fake
> watermarks.

---

## 1. Stage

```yaml
parallaxSceneId: side-show:scammer-pitch:trap
venueId: red-side-court                          # the scammer runs out of the red side
mood: dusk
durationMs: 6400
grain: 0.08                                      # the fake receipts have a sheen
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
  - id: fake-receipts-table
    depth: 0.55
    parallaxX: 0.5
    parallaxY: 0.25
    widthFactor: 0.8
    anchor: { x: 0.5, y: 0.55 }                       # the scammer's folding table
  - id: scammer
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.7, y: 0.62 }                      # Scammer behind the table
  - id: snitch
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.5
    anchor: { x: 0.18, y: 0.66 }                     # Snitch watching from the wall
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
  - { x: 0.7, y: 0.55, zoom: 1.3, holdMs: 2400, ease: easeInOut }    # tight on Scammer
  - { x: 0.5, y: 0.55, zoom: 1.15, holdMs: 2200, ease: easeInOut }   # pull back to the fake table
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: side-show:scammers-pitch:pre:0
    speaker: Scammer
    portraitAssetId: assets/characters/scammer.webp
    soundHook: story.crowd.ambience
    text: |
      Yo — Snitch charging you full price for the same tapes?
      I got the same footage. Half price. Better watermarks.
      Same paper, same pen.
  - lineToken: side-show:scammers-pitch:pre:1
    speaker: Snitch
    portraitAssetId: assets/characters/snitch.webp
    soundHook: story.tape.rewind
    focusLayer: snitch
    text: |
      (From the wall.) Don't. The watermark's wrong. Look at
      the corner — see the dot? Mine's at seven o'clock. His
      is at three.
  - lineToken: side-show:scammers-pitch:pre:2
    speaker: Scammer
    portraitAssetId: assets/characters/scammer.webp
    soundHook: story.crowd.cheer
    text: |
      You listening to him or you listening to me? He's selling
      you the past. I'm selling you tomorrow.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: side-show:scammers-pitch:pre:0, atMs: 0,    soundHook: story.crowd.ambience }
  - { lineToken: side-show:scammers-pitch:pre:1, atMs: 2000, soundHook: story.tape.rewind, focusLayerId: snitch }
  - { lineToken: side-show:scammers-pitch:pre:2, atMs: 4000, soundHook: story.crowd.cheer }
```

---

## 3. Battle

```yaml
battle:
  id: the-scammers-pitch
  title: "The Scammer's Pitch"
  battleType: rule-twist
  mapPosition: { x: 40, y: 54 }
  prerequisites: [snitchs-price]
  optional: false
  enemy:
    name: Scammer
    portraitAssetId: assets/characters/scammer.webp
    behaviorProfile: balanced
    deck:
      - scammer
      - plug
      - baby
      - oink
      - cornball
      - snow
      - wifey
  cinematic:
    videoAssetId: assets/story/chapter-four/media/scammers-pitch.mp4
    posterAssetId: assets/story/chapter-four/media/scammers-pitch.webp
    environmentAssetId: assets/venues/red-side-court.webp
  modifiers:
    openHands: true                  # THE TWIST: both players see each other's hands — see through the fakes
    middleDistrictLocked: true       # the middle district is contested
    fakeWatermark: true              # the Scammer's deck has watermarked fakes — look closely at the dot
  phases: []
  starObjectives:
    - { id: win,       description: Win the encounter. }
    - { id: districts, description: Hold the middle district while the fakes are circulating. }
    - { id: spot-fake, description: Win without playing any watermarked-fake cards. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 100 }
    - { kind: card, id: scammer, amount: 1 }   # Scammer card drops here; not a character unlock (he's the antagonist)
  teaching:
    tips:
      - "The Scammer's watermark dot is at three o'clock. Snitch's is at seven. Don't get fooled."
      - "Open hands means you see the fakes before they hit the board."
      - "If you played a fake, you failed the third star. The funeral depends on this."
    focusMechanics: [open hands reading, fake detection, contested district]
    focusCards: [cornball, snow, scammer]
```

---

## 4. Drama notes

- **The scammer's pitch:** Half price, better watermarks, same
  paper. The Scammer is the chapter's antagonist — per the
  season arc, "Sells fake receipts." The mechanic is literal:
  his deck has watermarked fakes.
- **The Snitch anchor:** Snitch watches from the wall. His
  "look at the corner — see the dot?" line is the player's
  tutorial for spotting fakes. Real watermark dot at seven
  o'clock; fake at three.
- **The setup:** "He's selling you the past. I'm selling you
  tomorrow" is the Scammer's hustle pitch. The player has to
  not buy it.
- **The path flag:** `fakeWatermark: true` is the chapter's
  mini-boss mechanic (scene 06). If the player failed to spot
  fakes here, the mini-boss (the fake funeral) is harder —
  the Scammer has more fakes in his deck.
- **The third star:** "Win without playing any watermarked-fake
  cards" forces the player to actually verify their hand. If
  they play a fake, they fail the star. The funeral depends on
  this — only the player who can spot fakes can win the
  boss clean.