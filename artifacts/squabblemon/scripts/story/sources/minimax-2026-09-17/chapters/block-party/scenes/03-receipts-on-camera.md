# SCENE — `block-party:receipts-on-camera`

> Rule-twist battle. Ganger Red brings receipts from four years
> ago. The camera is rolling. The middle district locks. The
> twist: both players can see each other's hands (the receipts are
> on the table). The "Watching the Feed" mention seeds Snitch's
> return in scene 06.

---

## 1. Stage

```yaml
parallaxSceneId: block-party:receipts:on-camera
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
  - id: tripod-camera
    depth: 0.6
    parallaxX: 0.55
    parallaxY: 0.35
    widthFactor: 0.4
    anchor: { x: 0.18, y: 0.6 }                       # the camera on a tripod, red light on
  - id: vending-machine
    depth: 0.65
    parallaxX: 0.55
    parallaxY: 0.35
    widthFactor: 0.35
    anchor: { x: 0.85, y: 0.72 }                     # the vending machine Cornball kicked
  - id: ganger-red
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.7, y: 0.62 }                      # Red holding a stack of receipts
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
  - { x: 0.7, y: 0.55, zoom: 1.25, holdMs: 2400, ease: easeInOut }   # close on Ganger Red + the receipts
  - { x: 0.18, y: 0.55, zoom: 1.2, holdMs: 2200, ease: easeInOut }   # cut to the tripod camera (red light)
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: block-party:receipts-on-camera:pre:0
    speaker: Ganger Red
    portraitAssetId: assets/characters/ganger-red.webp
    soundHook: story.camera.click
    text: |
      Ayo. I got receipts. From the camera. From four years ago.
      The red light's been on since before Cracked Head "died."
  - lineToken: block-party:receipts-on-camera:pre:1
    speaker: Ganger Red
    portraitAssetId: assets/characters/ganger-red.webp
    soundHook: story.tape.scrub
    focusLayer: ganger-red
    text: |
      Watch the corner. One-fourteen. Watch who comes through —
      and watch who walks away.
  - lineToken: block-party:receipts-on-camera:pre:2
    speaker: Ganger Red
    portraitAssetId: assets/characters/ganger-red.webp
    soundHook: story.crowd.ambience
    text: |
      Blue's gonna lie to you. The tape don't.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: block-party:receipts-on-camera:pre:0, atMs: 0,    soundHook: story.camera.click }
  - { lineToken: block-party:receipts-on-camera:pre:1, atMs: 1800, soundHook: story.tape.scrub, focusLayerId: ganger-red }
  - { lineToken: block-party:receipts-on-camera:pre:2, atMs: 3600, soundHook: story.crowd.ambience }
```

---

## 3. Battle

```yaml
battle:
  id: receipts-on-camera
  title: "Receipts on Camera"
  battleType: rule-twist
  mapPosition: { x: 40, y: 54 }
  prerequisites: [blue-side-pressure]
  optional: false
  enemy:
    name: Ganger Red
    portraitAssetId: assets/characters/ganger-red.webp
    behaviorProfile: balanced
    deck:
      - ganger-red
      - roaster
      - snow
      - plug
      - snitch
      - baby
      - oink
  cinematic:
    videoAssetId: assets/story/chapter-one/media/receipts-on-camera.mp4
    posterAssetId: assets/story/chapter-one/media/receipts-on-camera.webp
    environmentAssetId: assets/venues/corner-store-court.webp
  modifiers:
    openHands: true                # THE TWIST: both players see each other's hands
    middleDistrictLocked: true      # the middle district is contested — both sides play into it
  phases: []
  starObjectives:
    - { id: win,       description: Win the encounter. }
    - { id: districts, description: Hold the middle district while it's contested. }
    - { id: squabble,  description: Win without using SQUABBLE. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 100 }
  teaching:
    tips:
      - "Open hands means you read their tempo before they play. Use it."
      - "The middle district is contested — your best On-Reveal lives there."
      - "Red's receipts hint at Cracked Head. He's been watching the feed."
    focusMechanics: [open hands reading, contested district, On-Reveal timing]
    focusCards: [cornball, snow, ganger-red]
```

---

## 4. Drama notes

- **The first mention:** Red's "From four years ago. The red
  light's been on since before Cracked Head 'died'" is the
  chapter's first mention of Cracked Head. It's a setup for the
  scene 07 boss fight and the chapter 2 reveal.
- **The rule twist:** `openHands: true` is the chapter's
  signature mechanic — both players see each other's hands. The
  player reads Red's tempo. Red reads theirs. The middle district
  is contested; whoever plays best there wins.
- **The setup:** Red's "Blue's gonna lie to you. The tape don't"
  is the setup for the side-alley-challenge (scene 05) where
  Snitch's "Watching the Feed" passive is mentioned, and the
  payoff is in scene 06 where Snitch cashes the chatter.
- **The camera:** The tripod-camera layer is the same camera
  Snitch will be running in scene 06. The red light is on. The
  tape is recording.