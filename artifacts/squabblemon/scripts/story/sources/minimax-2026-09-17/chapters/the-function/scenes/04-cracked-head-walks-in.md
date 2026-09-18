# SCENE — `the-function:cracked-head-walks-in`

> The chapter finale. NO battle — just the entrance. Cracked
> Head walks into the function. The whole block is here. The
> party goes quiet. He's alive — in person. Bottle Girl
> unlocks. Chapter 7 unlocks. The `the-function` card drops.

---

## 1. Stage

```yaml
parallaxSceneId: the-function:cracked-head:entrance
venueId: function-venue
mood: night
durationMs: 8400                                # longer than usual — the entrance is a moment
grain: 0.08                                     # the projector footage bleeds into the function
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
  - id: venue-door
    depth: 0.55
    parallaxX: 0.5
    parallaxY: 0.25
    widthFactor: 0.4
    anchor: { x: 0.5, y: 0.5 }                       # the door, centered, where Cracked Head enters
  - id: bottle-girl
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.5
    anchor: { x: 0.18, y: 0.65 }                      # Bottle Girl behind the bar, frozen
  - id: og-uncle
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.3, y: 0.7 }                        # OG Uncle, watching the door
  - id: ganger-blue
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.42, y: 0.7 }                       # Blue, mid-frame, facing the door
  - id: wifey
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.5, y: 0.7 }                        # Wifey beside Blue
  - id: baby-momma
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.58, y: 0.7 }                       # Baby Momma, pregnant, beside Wifey
  - id: ganger-red
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.7, y: 0.7 }                        # Red, watching
  - id: snitch
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.4
    anchor: { x: 0.78, y: 0.7 }                       # Snitch, already recording
  - id: live-streamer
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.85, y: 0.7 }                       # Live Streamer, camera rolling
  - id: cornball
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.4
    anchor: { x: 0.92, y: 0.85 }                      # Cornball, mid-snack, frozen
  - id: cracked-head
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.65
    anchor: { x: 0.5, y: 0.55 }                       # Cracked Head, centered, in the doorway
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
  - { x: 0.5, y: 0.5, zoom: 1.0, holdMs: 1800, ease: easeInOut }     # wide on the function, everyone frozen
  - { x: 0.5, y: 0.55, zoom: 1.4, holdMs: 3000, ease: easeInOut }     # tight on Cracked Head in the doorway
  - { x: 0.3, y: 0.6, zoom: 1.15, holdMs: 1600, ease: easeInOut }     # cut to OG Uncle's reaction
  - { x: 0.5, y: 0.6, zoom: 1.2, holdMs: 2000, ease: easeInOut }     # settle center, the moment lands
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: the-function:cracked-head-walks-in:pre:0
    speaker: Live Streamer
    portraitAssetId: assets/characters/live-streamer.webp
    soundHook: story.stream.start
    text: |
      (Whispered.) Camera's rolling. Cracked Head — he's at
      the door. He's at the door.
  - lineToken: the-function:cracked-head-walks-in:pre:1
    speaker: Cracked Head
    portraitAssetId: assets/characters/cracked-head.webp
    soundHook: story.card.flip
    focusLayer: cracked-head
    text: |
      (From the doorway.) Took you long enough. I been in
      witness protection for four years. OG tipped the feds.
      Blue held the block. Baby Momma raised the kid. The
      block held. Now I'm back.
  - lineToken: the-function:cracked-head-walks-in:pre:2
    speaker: OG Uncle
    portraitAssetId: assets/characters/og-uncle.webp
    soundHook: story.crowd.ambience
    text: |
      (Quietly.) Welcome home, son. The booking's in. Chapter
      seven. Blue answers. The block holds.
  - lineToken: the-function:cracked-head-walks-in:pre:3
    speaker: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    soundHook: story.crowd.cheer
    text: |
      Two districts. Don't make me say it twice. I'll be at
      the corner tomorrow. We settle it.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: the-function:cracked-head-walks-in:pre:0, atMs: 0,    soundHook: story.stream.start }
  - { lineToken: the-function:cracked-head-walks-in:pre:1, atMs: 1800, soundHook: story.card.flip, focusLayerId: cracked-head }
  - { lineToken: the-function:cracked-head-walks-in:pre:2, atMs: 4600, soundHook: story.crowd.ambience }
  - { lineToken: the-function:cracked-head-walks-in:pre:3, atMs: 6400, soundHook: story.crowd.cheer }
```

---

## 3. Reward ceremony (no battle — this is a `kind: reward` node)

```yaml
ceremony:
  id: cracked-head-walks-in
  kind: reward
  title: "Cracked Head Walks In"
  mapPosition: { x: 95, y: 8 }
  prerequisites: [the-booking]
  optional: false

  # The full finalePayout from chapter-6-the-function.md.
  # NOTE: NO pack-ticket at finale — the 3 battle tickets ARE the chapter total.
  rewards:
    - { kind: character-unlock,  id: bottle-girl,             amount: 1 }   # Bottle Girl unlocks as a playable rival
    - { kind: chapter-key,       id: story-key:chapter-seven, amount: 1 }
    - { kind: card,              id: the-function,            amount: 1 }   # the season's fourth clue card

  # Drama flavor — engine reads whether the player won all 3 prior battles clean.
  flavor:
    on-clean-path:
      cracked-head-line: "Took you long enough. The block held. Now I'm back."
      og-uncle-line: "Welcome home, son. The booking's in."
      blue-line: "Two districts. Don't make me say it twice."
    on-loss-path:
      cracked-head-line: "Took you long enough. The block held — barely."
      og-uncle-line: "Welcome home, son. We didn't make it easy."
      blue-line: "Two districts. He only needed one. I only needed one too."
```

---

## 4. Drama notes

- **The chapter finale:** NO battle. Just the entrance.
  Cracked Head walks in. The function goes quiet. He's alive —
  in person. This is the season's BIGGEST dramatic moment.
- **The cast:** Every character who's still alive is in the
  room: Bottle Girl, OG Uncle, Blue, Wifey, Baby Momma, Red,
  Snitch, Live Streamer, Cornball, Cracked Head. Eleven
  characters in one scene. The whole block.
- **OG Uncle's reaction:** "Welcome home, son" — the moment
  between them. Per the resolved-decision log, OG Uncle tipped
  the feds. He's been waiting four years for this moment.
  His wheelchair starts in Ch7; he's still standing here.
- **Blue's response:** "Two districts. Don't make me say it
  twice. I'll be at the corner tomorrow." Blue accepts the
  challenge. He didn't betray Cracked Head yet — that comes
  in Ch7.
- **The card drop:** `the-function` is the season's fourth
  clue card. Joins `the-block` (Ch2), `the-real-receipts`
  (Ch4), `the-kid` (Ch5). The card's flavor text references
  the night of the function.
- **The character unlock:** Bottle Girl becomes a playable
  rival portrait. She returns in Ch7 and Ch8.
- **The handoff:** Chapter 7 (Return of the Block) unlocks.
  Cracked Head vs Blue. The block changes. Techbro Rich buys
  the rooftop in Ch8.