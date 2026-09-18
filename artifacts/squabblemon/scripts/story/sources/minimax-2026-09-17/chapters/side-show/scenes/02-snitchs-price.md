# SCENE — `side-show:snitchs-price`

> Standard battle. Snitch sets the price for the real receipts.
> He doesn't sell at face value — his price is information. The
> player has to pay something to get the real receipts. The
> `receiptVerify: watermark` mechanic carries over.

---

## 1. Stage

```yaml
parallaxSceneId: side-show:snitchs-price:setting
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
    anchor: { x: 0.5, y: 0.55 }
  - id: snitch
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.5, y: 0.6 }                        # Snitch centered, holding a single receipt
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
  - { x: 0.5, y: 0.55, zoom: 1.35, holdMs: 2800, ease: easeInOut }   # tight on Snitch and the receipt
  - { x: 0.5, y: 0.6, zoom: 1.15, holdMs: 800, ease: easeInOut }      # settle, fight begins
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: side-show:snitchs-price:pre:0
    speaker: Snitch
    portraitAssetId: assets/characters/snitch.webp
    soundHook: story.tape.rewind
    text: |
      You want the real receipts? They cost. They always cost.
      My price ain't money, baby — my price is information.
  - lineToken: side-show:snitchs-price:pre:1
    speaker: Snitch
    portraitAssetId: assets/characters/snitch.webp
    soundHook: story.tape.play
    focusLayer: snitch
    text: |
      Tell me who's been asking for the funeral footage. Tell
      me who's been buying the fakes. You do that, the real
      receipts are yours.
  - lineToken: side-show:snitchs-price:pre:2
    speaker: Snitch
    portraitAssetId: assets/characters/snitch.webp
    soundHook: story.crowd.ambience
    text: |
      Beat me first. Then we talk.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: side-show:snitchs-price:pre:0, atMs: 0,    soundHook: story.tape.rewind }
  - { lineToken: side-show:snitchs-price:pre:1, atMs: 2000, soundHook: story.tape.play, focusLayerId: snitch }
  - { lineToken: side-show:snitchs-price:pre:2, atMs: 4000, soundHook: story.crowd.ambience }
```

---

## 3. Battle

```yaml
battle:
  id: snitchs-price
  title: "Snitch's Price"
  battleType: standard
  mapPosition: { x: 23, y: 62 }
  prerequisites: [the-receipts-market]
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
    videoAssetId: assets/story/chapter-four/media/snitchs-price.mp4
    posterAssetId: assets/story/chapter-four/media/snitchs-price.webp
    environmentAssetId: assets/venues/corner-store-court.webp
  modifiers:
    receiptVerify: watermark         # carries over from scene 01
    priceReveal: true                # FLAG: the player paid Snitch's price — real receipts unlock
  phases: []
  starObjectives:
    - { id: win,       description: Win the encounter. }
    - { id: districts, description: Hold all three districts while Snitch sets his price. }
    - { id: squabble,  description: Win without using SQUABBLE. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 75 }
    - { kind: card, id: snitch, amount: 1 }   # Snitch card drops here; not a character unlock (he's a chapter boss)
  teaching:
    tips:
      - "Snitch's price is information — give it freely in dialog and the receipts unlock."
      - "Watermark verification carries — keep checking the receipts."
      - "The Scammer shows up in scene 03. He'll undercut Snitch's price."
    focusMechanics: [receipt verification, district denial, tempo]
    focusCards: [cornball, snow, snitch]
```

---

## 4. Drama notes

- **Snitch's price:** Per the season arc's resolved-decision log,
  Snitch sells to everyone. His price isn't loyalty — it's
  information. Whoever pays with the best intel gets the
  footage. The player wins by paying with the right question.
- **The flag:** `priceReveal: true` is the chapter's path flag.
  If the player pays Snitch's price (wins this scene clean), the
  real receipts unlock. If the player loses, the Scammer's
  scene (03) becomes harder — the Scammer now has Snitch's
  recent intel.
- **The setup:** "Beat me first. Then we talk" is the chapter's
  transactional core. Snitch doesn't give anything for free.
  Every receipt has a price.
- **The card drop:** The Snitch card drops here. He's a chapter
  boss, but the player can use him as a card (not as a rival —
  that unlock already happened in Ch2).