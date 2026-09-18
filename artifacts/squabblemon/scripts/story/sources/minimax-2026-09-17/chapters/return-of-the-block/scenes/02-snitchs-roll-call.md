# SCENE — `return-of-the-block:snitchs-roll-call`

> Standard battle. Snitch records Blue's deal. The footage is
> sold to whoever's buying. Per the resolved-decision log,
> Snitch sells to everyone — he's already broadcasting the
> betrayal. The block finds out.

---

## 1. Stage

```yaml
parallaxSceneId: return-of-the-block:snitch:roll-call
venueId: corner-store-court
mood: dusk
durationMs: 6400
grain: 0.08                              # the projector footage bleeds into the corner
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
  - id: projector-screen
    depth: 0.55
    parallaxX: 0.5
    parallaxY: 0.2
    widthFactor: 0.85
    anchor: { x: 0.5, y: 0.45 }                  # the projector, the deal is on screen
  - id: vending-machine
    depth: 0.6
    parallaxX: 0.55
    parallaxY: 0.35
    widthFactor: 0.35
    anchor: { x: 0.18, y: 0.7 }
  - id: snitch
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.78, y: 0.62 }                # Snitch running the projector
  - id: ganger-blue
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.5
    anchor: { x: 0.35, y: 0.7 }                 # Blue, watching himself on the projector
  - id: ganger-red
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.18, y: 0.78 }                # Red in the corner, witnessing
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
  - { x: 0.78, y: 0.55, zoom: 1.3, holdMs: 2400, ease: easeInOut }   # tight on Snitch
  - { x: 0.35, y: 0.6, zoom: 1.15, holdMs: 2200, ease: easeInOut }   # cut to Blue's reaction
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: return-of-the-block:snitchs-roll-call:pre:0
    speaker: Snitch
    portraitAssetId: assets/characters/snitch.webp
    soundHook: story.tape.play
    text: |
      Camera's rolling. The deal's on tape. Blue signed. The
      block's gonna know by sunrise.
  - lineToken: return-of-the-block:snitchs-roll-call:pre:1
    speaker: Ganger Red
    portraitAssetId: assets/characters/ganger-red.webp
    soundHook: story.crowd.ambience
    focusLayer: ganger-red
    text: |
      (From the corner.) You sold your brother, Blue. You
      sold the block. You sold the lie. For what?
  - lineToken: return-of-the-block:snitchs-roll-call:pre:2
    speaker: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    soundHook: story.card.flip
    text: |
      (Quietly.) For the truth. He was alive. He was alive
      the whole time. I held this block for a lie. Now I'ma
      hold it for the real.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: return-of-the-block:snitchs-roll-call:pre:0, atMs: 0,    soundHook: story.tape.play }
  - { lineToken: return-of-the-block:snitchs-roll-call:pre:1, atMs: 2000, soundHook: story.crowd.ambience, focusLayerId: ganger-red }
  - { lineToken: return-of-the-block:snitchs-roll-call:pre:2, atMs: 4000, soundHook: story.card.flip }
```

---

## 3. Battle

```yaml
battle:
  id: snitchs-roll-call
  title: "Snitch's Roll Call"
  battleType: standard
  mapPosition: { x: 23, y: 62 }
  prerequisites: [blue-takes-the-deal]
  optional: false
  enemy:
    name: Snitch
    portraitAssetId: assets/characters/snitch.webp
    behaviorProfile: balanced
    deck:
      - snitch
      - plug
      - baby
      - oink
      - cornball
      - snow
      - wifey
  cinematic:
    videoAssetId: assets/story/chapter-seven/media/snitchs-roll-call.mp4
    posterAssetId: assets/story/chapter-seven/media/snitchs-roll-call.webp
    environmentAssetId: assets/venues/corner-store-court.webp
  modifiers:
    dealTaken: true                  # carries over from scene 01
    openHands: true                  # the deal is being broadcast — everything is on the table
    footageSold: true                # FLAG: Snitch has sold the footage already
  phases: []
  starObjectives:
    - { id: win,       description: Win the encounter. }
    - { id: districts, description: Hold all three districts while the deal broadcasts. }
    - { id: squabble,  description: Win without using SQUABBLE. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 75 }
  teaching:
    tips:
      - "Snitch's footage is sold — the deal is public now."
      - "Open hands means everything is on the table — the deal can't be hidden."
      - "Hold all three districts while the broadcast plays."
    focusMechanics: [deal in motion, open hands, district denial]
    focusCards: [cornball, snow, snitch]
```

---

## 4. Drama notes

- **The broadcast:** Snitch has been recording since Ch2.
  Per the resolved-decision log, he sells to everyone. The
  deal footage is sold to Officer Oink (already paid), the
  side show (Hooper's crew), the block (Red's testimony),
  and the audience (Live Streamer).
- **Blue's confession:** "He was alive. He was alive the
  whole time. I held this block for a lie." Blue's grief is
  out in the open. He's not hiding anymore.
- **Red's reaction:** "You sold your brother, Blue. You
  sold the block. You sold the lie." Red is the witness.
  He's been holding the receipts since Ch2. He's seen this
  coming.
- **The flag:** `footageSold: true` carries to scene 03.
  Blue's guilt (scene 03) is now public knowledge. The
  block has has to deal with it.
- **The setup:** Scene 03 (Blue's guilt) is the emotional
  fallout. Scene 04 (Cracked Head at the corner) is his
  return.