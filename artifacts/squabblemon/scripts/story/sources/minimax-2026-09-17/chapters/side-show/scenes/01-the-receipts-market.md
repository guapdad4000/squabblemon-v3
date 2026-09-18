# SCENE — `side-show:the-receipts-market`

> Opening battle of Chapter 4. Snitch surfaces a tape AND a
> stack of receipts from the night Cracked Head "died." The
> player meets the network. This is a guided battle that teaches
> the chapter's "which is real" mechanic — Snitch's receipts
> have a `verified: true` marker; the Scammer's don't.

---

## 1. Stage

```yaml
parallaxSceneId: side-show:receipts-market:opening
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
  - id: receipts-table
    depth: 0.55
    parallaxX: 0.5
    parallaxY: 0.25
    widthFactor: 0.85
    anchor: { x: 0.5, y: 0.55 }                       # a folding table stacked with receipts
  - id: vending-machine
    depth: 0.6
    parallaxX: 0.55
    parallaxY: 0.35
    widthFactor: 0.35
    anchor: { x: 0.18, y: 0.7 }                       # the same vending machine (callback)
  - id: cornball
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.4
    anchor: { x: 0.3, y: 0.78 }                       # Cornball inspecting a stack
  - id: snitch
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.7, y: 0.62 }                       # Snitch behind the table
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
  - { x: 0.7, y: 0.55, zoom: 1.3, holdMs: 2400, ease: easeInOut }     # tight on Snitch
  - { x: 0.5, y: 0.55, zoom: 1.15, holdMs: 2200, ease: easeInOut }    # pull back to the receipts table
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: side-show:receipts-market:pre:0
    speaker: Snitch
    portraitAssetId: assets/characters/snitch.webp
    soundHook: story.tape.play
    text: |
      Welcome to the receipts market. Four years of footage,
      four years of receipts. Some of them are real. Most of
      them aren't. Your job: figure out which.
  - lineToken: side-show:receipts-market:pre:1
    speaker: Cornball
    portraitAssetId: assets/characters/cornball.webp
    soundHook: story.footstep
    text: |
      (Cornball flips through a stack.) Yo — half of these got
      the same handwriting. That's not a coincidence.
  - lineToken: side-show:receipts-market:pre:2
    speaker: Snitch
    portraitAssetId: assets/characters/snitch.webp
    soundHook: story.tape.rewind
    focusLayer: snitch
    text: |
      The real ones got my watermark. The fakes don't. You buy
      a fake, you bought yourself. You buy a real, you bought
      the truth.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: side-show:receipts-market:pre:0, atMs: 0,    soundHook: story.tape.play }
  - { lineToken: side-show:receipts-market:pre:1, atMs: 2000, soundHook: story.footstep }
  - { lineToken: side-show:receipts-market:pre:2, atMs: 3600, soundHook: story.tape.rewind, focusLayerId: snitch }
```

---

## 3. Battle

```yaml
battle:
  id: the-receipts-market
  title: "The Receipts Market"
  battleType: guided
  mapPosition: { x: 8, y: 76 }
  prerequisites: []
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
    videoAssetId: assets/story/chapter-four/media/receipts-market.mp4
    posterAssetId: assets/story/chapter-four/media/receipts-market.webp
    environmentAssetId: assets/venues/corner-store-court.webp
  modifiers:
    handSizeBonus: 1                 # the receipts give the player one extra card in opening hand
    receiptVerify: watermark         # FLAG: real receipts are watermarked; fakes are not
  phases: []
  starObjectives:
    - { id: win,       description: Win the encounter. }
    - { id: districts, description: Hold all three districts. }
    - { id: verify,    description: Win using only watermarked (real) receipts in your hand. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 50 }
    # NOTE: Snitch was already unlocked in chapter 2 (scene 01). No character unlock here.
  teaching:
    tips:
      - "Real receipts have Snitch's watermark. Fakes don't."
      - "Buy watermarked only — that's the third-star objective."
      - "The Scammer's pitch comes next. He'll sell you fakes at half price."
    focusMechanics: [receipt verification, hand size bonus, district scoring]
    focusCards: [cornball, snow, snitch]
```

---

## 4. Drama notes

- **The chapter mechanic:** `receiptVerify: watermark` is the
  chapter's signature. Real receipts have Snitch's watermark.
  Fakes don't. The third-star objective in scenes 01 and 03
  enforces this — the player has to win using only watermarked
  cards to prove they can tell real from fake.
- **The Cornball setup:** "Half of these got the same handwriting"
  is the player's first hint that the Scammer is the source of
  the fakes. Cornball sees it before the player does.
- **The callback:** Vending machine on the left (callback chain
  continues). Same machine from Ch1, Ch2.
- **The setup:** "You buy a fake, you bought yourself" is the
  setup for the scammer's-pitch scene — the Scammer will offer
  cheaper "better" receipts.