# SCENE — `side-show:the-real-receipts`

> The reward ceremony. The funeral concludes. Church Auntie
> blesses the truth. Snitch hands over the real receipts.
> Church Auntie unlocks as a playable rival portrait. The
> `the-real-receipts` card drops as the season's second clue.
> Chapter 5 unlocks here.

---

## 1. Stage

```yaml
parallaxSceneId: side-show:real-receipts:ceremony
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
    widthFactor: 0.45
    anchor: { x: 0.18, y: 0.7 }                       # OG Uncle, standing now, hand on the pew
  - id: baby-momma
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.32, y: 0.7 }                       # Baby Momma beside OG Uncle
  - id: snitch
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.45, y: 0.7 }                       # Snitch, having read the receipts, sits
  - id: church-auntie
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.65, y: 0.5 }                       # Church Auntie at the altar, hands raised
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
  - { x: 0.5, y: 0.5, zoom: 1.0, holdMs: 1800, ease: easeInOut }     # wide on the church, all five characters
  - { x: 0.65, y: 0.5, zoom: 1.3, holdMs: 2400, ease: easeInOut }    # close on Church Auntie at the altar
  - { x: 0.32, y: 0.6, zoom: 1.15, holdMs: 1800, ease: easeInOut }   # cut to OG Uncle + Baby Momma
  - { x: 0.5, y: 0.6, zoom: 1.15, holdMs: 1200, ease: easeInOut }    # settle center, the truth lands
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: side-show:real-receipts:pre:0
    speaker: Church Auntie
    portraitAssetId: assets/characters/church-auntie.webp
    soundHook: story.church.hymn
    text: |
      The receipts are read. The body's not in the ground —
      it's in the witness box. Bless this house. Bless this
      block. Bless the truth that we held for four years.
  - lineToken: side-show:real-receipts:pre:1
    speaker: Snitch
    portraitAssetId: assets/characters/snitch.webp
    soundHook: story.card.flip
    focusLayer: snitch
    text: |
      Four years I been holding this tape. Four years I been
      selling to whoever'd buy. Tonight the block bought it
      for free. Take the card.
  - lineToken: side-show:real-receipts:pre:2
    speaker: OG Uncle
    portraitAssetId: assets/characters/og-uncle.webp
    soundHook: story.pew.creak
    text: |
      (Standing.) I tipped the feds. I told 'em where to
      hide him. I did it to save his life. Y'all gonna have
      to live with that.
  - lineToken: side-show:real-receipts:pre:3
    speaker: Baby Momma
    portraitAssetId: assets/characters/baby-momma.webp
    soundHook: story.crowd.ambience
    text: |
      Chapter five. Take the key. Old Heads got more to tell.
      And the kid ain't mine alone.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: side-show:real-receipts:pre:0, atMs: 0,    soundHook: story.church.hymn }
  - { lineToken: side-show:real-receipts:pre:1, atMs: 2200, soundHook: story.card.flip, focusLayerId: snitch }
  - { lineToken: side-show:real-receipts:pre:2, atMs: 4000, soundHook: story.pew.creak }
  - { lineToken: side-show:real-receipts:pre:3, atMs: 5600, soundHook: story.crowd.ambience }
```

---

## 3. Reward ceremony (no battle — this is a `kind: reward` node)

```yaml
ceremony:
  id: the-real-receipts
  kind: reward
  title: "The Real Receipts"
  mapPosition: { x: 94, y: 5 }
  prerequisites: [snitchs-verdict]
  optional: false

  # The full finalePayout from chapter-4-side-show.md.
  rewards:
    - { kind: pack-ticket,       id: street-pack-ticket,       amount: 1 }
    - { kind: character-unlock,  id: church-auntie,            amount: 1 }   # Church Auntie unlocks as a playable rival
    - { kind: cosmetic,          id: side-show-crowned,        amount: 1 }
    - { kind: chapter-key,       id: story-key:chapter-five,   amount: 1 }
    - { kind: card,              id: the-real-receipts,        amount: 1 }   # the season's second clue card

  # Drama flavor branches — engine reads the boss 3-phase clean-win state.
  flavor:
    on-clean-path:
      snitch-line: "Take the card. The dot's at seven — the real dot."
      og-uncle-line: "I tipped the feds. I told 'em where to hide him."
      baby-momma-line: "Old Heads got more to tell."
    on-loss-path:
      snitch-line: "Take the card. It ain't pretty, but it's real."
      og-uncle-line: "I tipped the feds. Y'all gotta live with that."
      baby-momma-line: "Old Heads got more to tell. And so do I."
```

---

## 4. Drama notes

- **The reward ceremony:** All five finale payouts land here.
  The `pack-ticket` is the explicit +1 finale grant; the other
  four are the chapter key, character unlock, cosmetic, and the
  second clue card.
- **The character unlock:** Church Auntie becomes a playable
  rival portrait. She returns in chapter 8 (The Crown) to
  officiate the season finale's wedding. Her unlock here is
  quiet, not dramatic — the revelation carries the drama.
- **The OG Uncle confession:** "I tipped the feds. I told 'em
  where to hide him" is OG Uncle's public confession. Per the
  resolved-decision log: OG Uncle tipped the feds to save
  Cracked Head's life. This is the moment the family
  acknowledges it openly.
- **The Baby Momma setup:** "Old Heads got more to tell. And
  the kid ain't mine alone" is the chapter 5 setup. Baby Momma
  drops the kid bombshell in Ch5 (Old Heads Know).
- **The handoff:** Chapter 5 (Old Heads Know) unlocks. OG Uncle
  is the chapter boss (2-phase). The family secret comes out.
  Wifey stands by Blue. Church Auntie blesses the truth.