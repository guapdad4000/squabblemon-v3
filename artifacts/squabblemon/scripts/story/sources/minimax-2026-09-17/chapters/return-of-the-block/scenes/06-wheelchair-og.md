# SCENE — `return-of-the-block:wheelchair-og`

> Mini-boss battle. OG Uncle is in a wheelchair — per the
> resolved-decision log, the wheelchair starts in chapter 7.
> He's at the corner. Cracked Head is at the corner. This is
> the moment between them — the witness-protection keeper
> facing the man he saved. The player has to hold the corner.

---

## 1. Stage

```yaml
parallaxSceneId: return-of-the-block:og-uncle:wheelchair
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
  - id: wheelchair
    depth: 0.55
    parallaxX: 0.5
    parallaxY: 0.25
    widthFactor: 0.6
    anchor: { x: 0.32, y: 0.65 }                       # the wheelchair, with OG Uncle in it
  - id: og-uncle
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.32, y: 0.55 }                       # OG Uncle in the wheelchair, watching Cracked Head
  - id: cracked-head
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.6
    anchor: { x: 0.78, y: 0.62 }                       # Cracked Head across from OG Uncle
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
  - { x: 0.32, y: 0.55, zoom: 1.4, holdMs: 2800, ease: easeInOut }   # tight on OG Uncle in the wheelchair
  - { x: 0.78, y: 0.55, zoom: 1.4, holdMs: 2400, ease: easeInOut }    # tight on Cracked Head
  - { x: 0.5, y: 0.6, zoom: 1.15, holdMs: 1200, ease: easeInOut }    # settle center
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: return-of-the-block:wheelchair-og:pre:0
    speaker: OG Uncle
    portraitAssetId: assets/characters/og-uncle.webp
    soundHook: story.hospital.monitor
    text: |
      (From the wheelchair.) You came back. I tipped the
      feds. I did it to save your life. Blue found out.
      Blue took the deal. The block held.
  - lineToken: return-of-the-block:wheelchair-og:pre:1
    speaker: Cracked Head
    portraitAssetId: assets/characters/cracked-head.webp
    soundHook: story.crowd.ambience
    focusLayer: cracked-head
    text: |
      Old man. You're in a chair now. The feds kept their
      word. Blue kept the block. I kept my life. We
      square up next.
  - lineToken: return-of-the-block:wheelchair-og:pre:2
    speaker: OG Uncle
    portraitAssetId: assets/characters/og-uncle.webp
    soundHook: story.card.flip
    text: |
      Beat me first. Then we go. Three phases. The lie.
      The forgiveness. The verdict. Whichever way it lands
      — the block holds.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: return-of-the-block:wheelchair-og:pre:0, atMs: 0,    soundHook: story.hospital.monitor }
  - { lineToken: return-of-the-block:wheelchair-og:pre:1, atMs: 2000, soundHook: story.crowd.ambience, focusLayerId: cracked-head }
  - { lineToken: return-of-the-block:wheelchair-og:pre:2, atMs: 4400, soundHook: story.card.flip }
```

---

## 3. Battle

```yaml
battle:
  id: wheelchair-og
  title: "Wheelchair OG"
  battleType: mini-boss
  mapPosition: { x: 72, y: 31 }
  prerequisites: [cracked-head-at-the-corner]
  optional: false
  enemy:
    name: OG Uncle (in wheelchair)
    portraitAssetId: assets/characters/og-uncle.webp
    behaviorProfile: balanced
    deck:
      - og-uncle
      - the-real-receipts                       # the verified receipts
      - baby-momma
      - wifey
      - snow
      - rastamon
      - plug
  cinematic:
    videoAssetId: assets/story/chapter-seven/media/wheelchair-og.mp4
    posterAssetId: assets/story/chapter-seven/media/wheelchair-og.webp
    environmentAssetId: assets/venues/corner-store-court.webp
  modifiers:
    dealTaken: true                  # carries over
    guiltFlag: true                  # carries over
    wheelchairOG: true               # FLAG: OG Uncle is in a wheelchair — his deck is slower but his witness cards are heavy
  phases: []
  starObjectives:
    - { id: win,       description: Win the encounter. }
    - { id: districts, description: Hold all three districts while OG Uncle watches from his wheelchair. }
    - { id: respect,   description: Win without playing any non-family cards — show OG Uncle the family is intact. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 125 }
    # NOTE: Mini-bosses don't unlock characters. OG Uncle was already unlocked in Ch3.
  teaching:
    tips:
      - "OG Uncle's deck is heavy on witness cards — counter with tempo."
      - "Win without playing non-family cards — show OG Uncle the family is intact."
      - "The wheelchair flag carries — his deck is slower but heavier."
    focusMechanics: [wheelchair slower,, family focus, witness denial]
    focusCards: [cornball, snow, og-uncle]
```

---

## 4. Drama notes

- **The wheelchair:** Per the resolved-decision log, OG Uncle
  is in a wheelchair from chapter 7 onward. He's been sick
  since Ch3's bedside; now he's in the chair at the corner.
- **The moment:** "Old man. You're in a chair now. The feds
  kept their word. Blue kept the block. I kept my life."
  Cracked Head acknowledges the cost. OG Uncle tipped the
  feds; Blue held the block; Cracked Head lived. The family
  paid the price.
- **The setup:** OG Uncle's "Three phases. The lie. The
  forgiveness. The verdict" is the boss-fight (scene 07)
  preview. Three phases named explicitly.
- **The third star:** "Win without playing any non-family
  cards" is the player's test. Show OG Uncle the family is
  intact. The boss-fight prep.
- **The flag:** `wheelchairOG: true` is the mini-boss's
  signature modifier. OG Uncle's deck is slower but heavier
  — the witness cards are the chapter's heaviest.