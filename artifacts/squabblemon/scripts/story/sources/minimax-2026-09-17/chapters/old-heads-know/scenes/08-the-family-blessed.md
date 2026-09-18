# SCENE — `old-heads-know:the-family-blessed`

> The reward ceremony. Church Auntie blesses the verdict. Baby
> Momma unlocks as a playable rival portrait. The `the-kid`
> card drops — the season's third clue card. The wider block
> finds out what's coming next: Cracked Head is coming home.
> Chapter 6 unlocks here.

---

## 1. Stage

```yaml
parallaxSceneId: old-heads-know:family-blessed:ceremony
venueId: church
mood: night
durationMs: 7200
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
  - id: church-wall
    depth: 0.3
    parallaxX: 0.25
    parallaxY: 0.15
    widthFactor: 1.2
    anchor: { x: 0.5, y: 0.55 }
  - id: altar
    depth: 0.55
    parallaxX: 0.5
    parallaxY: 0.25
    widthFactor: 0.9
    anchor: { x: 0.5, y: 0.6 }
  - id: pews
    depth: 0.6
    parallaxX: 0.55
    parallaxY: 0.3
    widthFactor: 1.0
    anchor: { x: 0.5, y: 0.75 }
  - id: og-uncle
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.5
    anchor: { x: 0.15, y: 0.7 }                       # OG Uncle in the front pew, watching
  - id: ganger-blue
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.32, y: 0.7 }                       # Blue beside OG Uncle
  - id: wifey
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.42, y: 0.7 }                       # Wifey beside Blue
  - id: baby-momma
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.5
    anchor: { x: 0.78, y: 0.6 }                       # Baby Momma centered, holding the toddler
  - id: church-auntie
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.5, y: 0.5 }                        # Church Auntie at the altar
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
  - { x: 0.5, y: 0.5, zoom: 1.0, holdMs: 1800, ease: easeInOut }     # wide on the church, all six
  - { x: 0.5, y: 0.5, zoom: 1.3, holdMs: 2400, ease: easeInOut }     # close on Church Auntie
  - { x: 0.78, y: 0.55, zoom: 1.25, holdMs: 2200, ease: easeInOut }   # close on Baby Momma + the toddler
  - { x: 0.5, y: 0.6, zoom: 1.15, holdMs: 800, ease: easeInOut }     # settle center
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: old-heads-know:family-blessed:pre:0
    speaker: Church Auntie
    portraitAssetId: assets/characters/church-auntie.webp
    soundHook: story.church.hymn
    text: |
      Bless this house. Bless the verdict. The body's in
      the witness box. The kid is in the family. The
      receipts are read. The block holds.
  - lineToken: old-heads-know:family-blessed:pre:1
    speaker: Baby Momma
    portraitAssetId: assets/characters/baby-momma.webp
    soundHook: story.card.shuffle
    focusLayer: baby-momma
    text: |
      You held it. You heard me. You stood by Blue. You
      heard the verdict. Take the card — that's the kid.
      He's coming home.
  - lineToken: old-heads-know:family-blessed:pre:2
    speaker: Wifey
    portraitAssetId: assets/characters/wifey.webp
    soundHook: story.crowd.cheer
    text: |
      Chapter six. Take the key. The function's tonight.
      Bottle Girl's running the bar. Promoter's booking the
      fight. Live Streamer's narrating. Everybody's in the
      room.
```

---

## 3. Reward ceremony (no battle — this is a `kind: reward` node)

```yaml
ceremony:
  id: the-family-blessed
  kind: reward
  title: "The Family Blessed"
  mapPosition: { x: 94, y: 5 }
  prerequisites: [og-uncles-verdict]
  optional: false

  # The full finalePayout from chapter-5-old-heads-know.md.
  rewards:
    - { kind: pack-ticket,       id: street-pack-ticket,         amount: 1 }
    - { kind: character-unlock,  id: baby-momma,                 amount: 1 }   # Baby Momma unlocks as a playable rival
    - { kind: cosmetic,          id: old-heads-know-crowned,     amount: 1 }
    - { kind: chapter-key,       id: story-key:chapter-six,      amount: 1 }
    - { kind: card,              id: the-kid,                    amount: 1 }   # Baby Momma's second kid (canonical, per resolved-decision log)

  # Drama flavor branches — engine reads the boss 2-phase clean-win state and wifeyStands flag.
  flavor:
    on-clean-path:
      og-uncle-line: "You hold it now. The block is yours."
      wifey-line: "We hold it together. Whatever comes next."
      baby-momma-line: "He's coming home. Take the card."
    on-loss-path:
      og-uncle-line: "You weren't ready. The block holds anyway."
      wifey-line: "We hold it anyway. Whatever comes next."
      baby-momma-line: "He's coming home. Take the card anyway."
```

---

## 4. Drama notes

- **The reward ceremony:** All five finale payouts land here.
  The `pack-ticket` is the explicit +1 finale grant; the
  other four are the chapter key, character unlock, cosmetic,
  and the third clue card (`the-kid`).
- **The character unlock:** Baby Momma becomes a playable
  rival portrait. She's the heart of the season and the
  chapter's emotional center. Her unlock is dramatic — she
  drops the kid bombshell in scene 02 and the player earns
  her by hearing it.
- **The card drop:** `the-kid` represents Baby Momma's second
  child — canonical per the resolved-decision log. The kid
  is on the way by chapter 7. This card is the season's
  third clue (after Ch2's `the-block` and Ch4's
  `the-real-receipts`).
- **The handoff:** "The function's tonight. Bottle Girl's
  running the bar. Promoter's booking the fight. Live
  Streamer's narrating. Everybody's in the room" is the
  chapter 6 setup. The function is the party before the war —
  every character who's still alive is in the room. Cracked
  Head walks in at the end.
- **The wider block:** OG Uncle, Blue, Wifey, Baby Momma, and
  Church Auntie are all in the church. The family council
  has convened. The truth is blessed.