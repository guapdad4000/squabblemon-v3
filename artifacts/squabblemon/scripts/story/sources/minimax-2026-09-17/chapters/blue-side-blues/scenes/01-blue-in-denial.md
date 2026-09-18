# SCENE — `blue-side-blues:blue-in-denial`

> Standard battle. Ganger Blue is in denial at his flat. He won't
> go to the hospital to see OG Uncle. The player confronts him.
> Wifey is watching from the kitchen. Cornball is at the door.

---

## 1. Stage

```yaml
parallaxSceneId: blue-side-blues:blue-flat:denial
venueId: blue-side-flat
mood: dusk
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
  - id: kitchen-counter
    depth: 0.55
    parallaxX: 0.5
    parallaxY: 0.25
    widthFactor: 0.9
    anchor: { x: 0.2, y: 0.7 }                       # the kitchen where Wifey stands
  - id: couch
    depth: 0.6
    parallaxX: 0.55
    parallaxY: 0.3
    widthFactor: 0.6
    anchor: { x: 0.65, y: 0.7 }                      # Blue's couch, where he won't move from
  - id: ganger-blue
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.7, y: 0.62 }                      # Blue on the couch, refusing to move
  - id: wifey
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.5
    anchor: { x: 0.18, y: 0.66 }                     # Wifey at the kitchen counter, watching
  - id: cornball
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.4
    anchor: { x: 0.5, y: 0.85 }                      # Cornball at the door, peeking in
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
  - { x: 0.7, y: 0.6, zoom: 1.3, holdMs: 2400, ease: easeInOut }     # tight on Blue on the couch
  - { x: 0.18, y: 0.55, zoom: 1.15, holdMs: 2200, ease: easeInOut }   # cut to Wifey in the kitchen
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: blue-side-blues:blue-in-denial:pre:0
    speaker: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    soundHook: story.crowd.ambience
    text: |
      I'm not going. He knows why Cracked Head died. He's known
      since the night. And he didn't tell me.
  - lineToken: blue-side-blues:blue-in-denial:pre:1
    speaker: Wifey
    portraitAssetId: assets/characters/wifey.webp
    soundHook: story.door.close
    focusLayer: wifey
    text: |
      Blue. He's your uncle. He's sick. He needs to see you.
      Whatever he's known — he needs to say it out loud.
  - lineToken: blue-side-blues:blue-in-denial:pre:2
    speaker: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    soundHook: story.crowd.cheer
    text: |
      Two districts. Don't make me say it twice. I held this
      block for him. I held it for Cracked Head. I held it
      for nobody. I'm not holding it for him now.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: blue-side-blues:blue-in-denial:pre:0, atMs: 0,    soundHook: story.crowd.ambience }
  - { lineToken: blue-side-blues:blue-in-denial:pre:1, atMs: 1800, soundHook: story.door.close, focusLayerId: wifey }
  - { lineToken: blue-side-blues:blue-in-denial:pre:2, atMs: 3600, soundHook: story.crowd.cheer }
```

---

## 3. Battle

```yaml
battle:
  id: blue-in-denial
  title: "Blue in Denial"
  battleType: standard
  mapPosition: { x: 20, y: 65 }
  prerequisites: []
  optional: false
  enemy:
    name: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    behaviorProfile: balanced
    deck:
      - ganger-blue
      - snow
      - rastamon
      - plug
      - wifey
      - baby
      - oink
  cinematic:
    videoAssetId: assets/story/chapter-three/media/blue-in-denial.mp4
    posterAssetId: assets/story/chapter-three/media/blue-in-denial.webp
    environmentAssetId: assets/venues/blue-side-flat.webp
  modifiers:
    homeCourt: blue                  # Blue's flat — he gets a tempo bonus
    denialFlag: true                 # affects scene 02 modifier if Blue loses
  phases: []
  starObjectives:
    - { id: win,       description: Win the encounter. }
    - { id: districts, description: Hold all three districts while Blue stays on the couch. }
    - { id: squabble,  description: Win without using SQUABBLE. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 75 }
    # NOTE: Ganger Blue was already unlocked in chapter 1. No unlock here.
    #       Wifey unlocks in chapter 2 (finale). OG Uncle unlocks at this chapter's finale.
  teaching:
    tips:
      - "Blue's home-court bonus makes him cost-efficient. Don't let him set tempo."
      - "Win clean here and Wifey joins your side in scene 02."
      - "This is the chapter's first 'talk him into it' beat. You're not fighting Blue — you're fighting his grief."
    focusMechanics: [tempo disruption, district denial]
    focusCards: [cornball, snow, ganger-blue]
```

---

## 4. Drama notes

- **The denial:** Blue's "He knows why Cracked Head died. He's
  known since the night. And he didn't tell me" is the setup for
  the chapter's reveal. OG Uncle tipped the feds to save Cracked
  Head (per the resolved-decision log). Blue discovered the
  arrangement. Now Blue thinks OG Uncle betrayed him by not telling
  him his brother was alive.
- **The home court:** Blue's flat is his territory. The
  `homeCourt: blue` modifier makes his tempo cheaper. The player
  has to disrupt it.
- **The setup:** "I'm not holding it for him now" is the
  setup for scene 02 — Wifey has to make Blue go, against his
  will. The player helps her.
- **The Cornball cameo:** Cornball is at the door, peeking in.
  Comic relief — he doesn't speak here. He'll have more to say in
  scene 03 (OG Uncle's bedside).