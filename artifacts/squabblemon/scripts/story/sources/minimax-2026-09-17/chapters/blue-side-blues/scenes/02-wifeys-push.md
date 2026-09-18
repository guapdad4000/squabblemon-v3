# SCENE — `blue-side-blues:wifeys-push`

> Standard battle with an allied-mode twist. The player fights
> alongside Wifey against Ganger Blue (who's still refusing to go).
> This is the chapter's "make him go" beat. Wifey joins the
> player's side as a partner in the fight.

---

## 1. Stage

```yaml
parallaxSceneId: blue-side-blues:hospital-corridor:push
venueId: hospital-corridor
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
  - id: hospital-wall
    depth: 0.3
    parallaxX: 0.25
    parallaxY: 0.15
    widthFactor: 1.2
    anchor: { x: 0.5, y: 0.55 }
  - id: vending-machine
    depth: 0.6
    parallaxX: 0.55
    parallaxY: 0.35
    widthFactor: 0.35
    anchor: { x: 0.18, y: 0.7 }                       # a hospital vending machine (not the corner one)
  - id: door
    depth: 0.65
    parallaxX: 0.55
    parallaxY: 0.3
    widthFactor: 0.6
    anchor: { x: 0.7, y: 0.55 }                       # the hospital door Blue is blocking
  - id: ganger-blue
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.7, y: 0.62 }                      # Blue at the door, arms folded
  - id: wifey
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.5
    anchor: { x: 0.35, y: 0.66 }                     # Wifey between Blue and the player
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
  - { x: 0.35, y: 0.55, zoom: 1.3, holdMs: 2400, ease: easeInOut }   # tight on Wifey
  - { x: 0.7, y: 0.55, zoom: 1.3, holdMs: 2200, ease: easeInOut }    # tight on Blue at the door
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: blue-side-blues:wifeys-push:pre:0
    speaker: Wifey
    portraitAssetId: assets/characters/wifey.webp
    soundHook: story.door.close
    text: |
      Blue. Two districts — I only needed one. You owe him this.
      He's your uncle. He's sick. You owe him twenty minutes.
  - lineToken: blue-side-blues:wifeys-push:pre:1
    speaker: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    soundHook: story.crowd.ambience
    focusLayer: ganger-blue
    text: |
      He lied to me for four years, Wifey. He watched me hold
      this block for a dead man. He watched me grieve.
  - lineToken: blue-side-blues:wifeys-push:pre:2
    speaker: Wifey
    portraitAssetId: assets/characters/wifey.webp
    soundHook: story.crowd.cheer
    text: |
      Then go in there and grieve right. With him. He's waiting.
      I'm standing next to you until you walk through that door.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: blue-side-blues:wifeys-push:pre:0, atMs: 0,    soundHook: story.door.close }
  - { lineToken: blue-side-blues:wifeys-push:pre:1, atMs: 2000, soundHook: story.crowd.ambience, focusLayerId: ganger-blue }
  - { lineToken: blue-side-blues:wifeys-push:pre:2, atMs: 4000, soundHook: story.crowd.cheer }
```

---

## 3. Battle

```yaml
battle:
  id: wifeys-push
  title: "Wifey's Push"
  battleType: standard
  mapPosition: { x: 50, y: 45 }
  prerequisites: [blue-in-denial]
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
    videoAssetId: assets/story/chapter-three/media/wifeys-push.mp4
    posterAssetId: assets/story/chapter-three/media/wifeys-push.webp
    environmentAssetId: assets/venues/hospital-corridor.webp
  modifiers:
    allyWifey: true                  # TWIST: Wifey fights alongside the player
    hospitalDoor: blue-held          # Blue holds the door; player + Wifey push him through
  phases: []
  starObjectives:
    - { id: win,       description: Win the encounter. }
    - { id: districts, description: Push Blue through all three districts to the door. }
    - { id: ally,      description: Win while Wifey's ally buff is active. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 100 }
  teaching:
    tips:
      - "Wifey joins your side — she costs 0 and gives you a tempo discount on every district."
      - "Your job is to push Blue through all three districts, not just beat him."
      - "This is the chapter's 'make him go' beat. The fight is for Blue, not against him."
    focusMechanics: [ally mode, district push, tempo stacking]
    focusCards: [cornball, snow, wifey]
```

---

## 4. Drama notes

- **The allied mode:** `allyWifey: true` is the chapter's signature
  mechanic. The player doesn't fight alone — Wifey joins the
  player's side as a 0-cost ally. The fight is for Blue, not
  against him. The player has to push him through all three
  districts to the hospital door.
- **The setup:** "He lied to me for four years, Wifey. He
  watched me hold this block for a dead man" is Blue's grief
  surfacing. Per the resolved-decision log: OG Uncle tipped the
  feds. Blue discovered the arrangement and Snitch spread the
  rumor that Cracked Head died. Blue's grief is real — OG Uncle
  didn't tell him.
- **The push:** "I'm standing next to you until you walk
  through that door" is Wifey's commitment. She's not letting
  Blue off the hook. The mechanics reinforce her commitment —
  she's in the fight.
- **The setup for the finale:** Scene 03 happens at OG Uncle's
  bedside. The player has now pushed Blue to the door. Scene 03
  opens on them entering the room.