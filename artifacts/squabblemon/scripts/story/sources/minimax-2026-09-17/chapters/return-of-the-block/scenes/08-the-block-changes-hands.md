# SCENE — `return-of-the-block:the-block-changes-hands`

> The reward ceremony. The block changes hands. Delivery
> Demon drops the package — it includes the chapter key, the
> cosmetic, and the season's fifth clue card. Cracked Head
> and Blue stand together. Wifey stands by Blue. OG Uncle
> watches from his wheelchair. Chapter 8 unlocks here.

---

## 1. Stage

```yaml
parallaxSceneId: return-of-the-block:block-changes:ceremony
venueId: corner-store-court
mood: dusk
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
  - id: storefront
    depth: 0.4
    parallaxX: 0.4
    parallaxY: 0.2
    widthFactor: 1.1
    anchor: { x: 0.5, y: 0.65 }
  - id: vending-machine
    depth: 0.6
    parallaxX: 0.55
    parallaxY: 0.35
    widthFactor: 0.35
    anchor: { x: 0.18, y: 0.7 }
  - id: og-uncle-wheelchair
    depth: 0.55
    parallaxX: 0.5
    parallaxY: 0.25
    widthFactor: 0.6
    anchor: { x: 0.18, y: 0.7 }                       # OG Uncle in his wheelchair, watching
  - id: baby-momma
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.32, y: 0.7 }                       # Baby Momma, pregnant, beside OG Uncle
  - id: ganger-blue
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.42, y: 0.7 }                       # Blue, mid-frame
  - id: wifey
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.5, y: 0.7 }                        # Wifey beside Blue
  - id: cracked-head
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.7, y: 0.6 }                        # Cracked Head, standing tall
  - id: ganger-red
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.82, y: 0.7 }                       # Red, watching
  - id: delivery-demon
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.5
    anchor: { x: 0.5, y: 0.55 }                       # Delivery Demon, dropping the package at the altar (counter)
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
  - { x: 0.5, y: 0.5, zoom: 1.0, holdMs: 1800, ease: easeInOut }     # wide on the corner, all seven
  - { x: 0.5, y: 0.55, zoom: 1.3, holdMs: 2400, ease: easeInOut }    # close on Delivery Demon dropping the package
  - { x: 0.42, y: 0.6, zoom: 1.2, holdMs: 1800, ease: easeInOut }    # cut to Blue + Wifey
  - { x: 0.5, y: 0.6, zoom: 1.15, holdMs: 1200, ease: easeInOut }    # settle center
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: return-of-the-block:block-changes-hands:pre:0
    speaker: Delivery Demon
    portraitAssetId: assets/characters/delivery-demon.webp
    soundHook: story.package.drop
    text: |
      Package for the corner. From the witness box. Signed
      by the witness box. Open it at the altar.
  - lineToken: return-of-the-block:block-changes-hands:pre:1
    speaker: Cracked Head
    portraitAssetId: assets/characters/cracked-head.webp
    soundHook: story.card.flip
    focusLayer: cracked-head
    text: |
      The block changes hands tonight. Blue's got the
      corner. I've got the rooftop. The kid's got the
      family. We hold it.
  - lineToken: return-of-the-block:block-changes-hands:pre:2
    speaker: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    soundHook: story.crowd.cheer
    text: |
      Two districts. He only needed one. I only needed one.
      Chapter eight. We take it back.
  - lineToken: return-of-the-block:block-changes-hands:pre:3
    speaker: OG Uncle
    portraitAssetId: assets/characters/og-uncle.webp
    soundHook: story.wheelchair.brake
    text: |
      (From the wheelchair.) Take the key. Take the
      package. Techbro Rich is watching from the rooftop.
      He buys the block tomorrow. Chapter eight. The crown.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: return-of-the-block:block-changes-hands:pre:0, atMs: 0,    soundHook: story.package.drop }
  - { lineToken: return-of-the-block:block-changes-hands:pre:1, atMs: 1800, soundHook: story.card.flip, focusLayerId: cracked-head }
  - { lineToken: return-of-the-block:block-changes-hands:pre:2, atMs: 3800, soundHook: story.crowd.cheer }
  - { lineToken: return-of-the-block:block-changes-hands:pre:3, atMs: 5400, soundHook: story.wheelchair.brake }
```

---

## 3. Reward ceremony (no battle — this is a `kind: reward` node)

```yaml
ceremony:
  id: the-block-changes-hands
  kind: reward
  title: "The Block Changes Hands"
  mapPosition: { x: 94, y: 5 }
  prerequisites: [the-lie-exposed]
  optional: false

  # # The full finalePayout from chapter-7-return-of-the-block.md.
  rewards:
    - { kind: pack-ticket,       id: street-pack-ticket,           amount: 1 }
    - { kind: character-unlock,  id: delivery-demon,               amount: 1 }   # Delivery Demon unlocks as a playable rival
    - { kind: cosmetic,          id: return-of-the-block-crowned,  amount: 1 }
    - { kind: chapter-key,       id: story-key:chapter-eight,      amount: 1 }
    - { kind: card,              id: the-block-changes,            amount: 1 }   # the season's fifth clue card

  # Drama flavor branches — engine reads the boss 3-phase clean-win state.
  flavor:
    on-clean-path:
      cracked-head-line: "You earn it back tomorrow. Chapter eight."
      blue-line: "Two districts. He only needed one. I only needed one too."
      og-uncle-line: "Take the key. Take the package. Techbro Rich is watching."
    on-loss-path:
      cracked-head-line: "You earned nothing. Chapter eight."
      blue-line: "Two districts. He only needed one. I needed both."
      og-uncle-line: "Take the key. The crown's still yours to fight for."
```

---

## 4. Drama notes

- **The block changes hands:** Per the season arc, "the
  block changes hands" in Ch7. The package Delivery Demon
  drops contains the chapter key — the witness box's signed
  package, which confirms Cracked Head's witness protection
  arrangement officially.
- **The character unlock:** Delivery Demon — "drops the
  package" per season arc — unlocks at finale. He's the
  chapter's natural unlock target.
- **The card drop:** `the-block-changes` is the season's
  fifth clue card. Joins `the-block` (Ch2), `the-real-receipts`
  (Ch4), `the-kid` (Ch5), `the-function` (Ch6). Five cards;
  the player has collected the season's full set.
- **OG Uncle's handoff:** "Techbro Rich is watching from the
  rooftop. He buys the block tomorrow. Chapter eight. The
  crown." is the season's final setup. Per the resolved-
  decision log: "Techbro Rich does not duel the player in
  season 1. He buys the rooftop at the end of chapter 8 and
  is the season 2 setup."
- **The recurring line:** "Zero districts. That's what you
  get for snitching" is the chapter's take on the recurring
  line. It echoes Ch1, Ch5, and Ch6 — and sets up Ch8's
  closing echo.
- **The handoff:** Chapter 8 (The Crown) unlocks. The
  season finale. 3-phase boss fight. Techbro Rich buys the
  rooftop. Season 1 ends.