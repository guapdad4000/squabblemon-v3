# SCENE — `return-of-the-block:cracked-head-at-the-corner`

> Rule-twist battle. Cracked Head walks into the corner store.
> The middle district locks. He's alive. He's here. Blue is
> inside — the lie is about to be exposed. The rule twist: all
> three districts lock; both players see each other's hands.

---

## 1. Stage

```yaml
parallaxSceneId: return-of-the-block:corner:entrance
venueId: corner-store-court
mood: dusk
durationMs: 6400
grain: 0.08                              # the projector footage bleeds in
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
  - id: corner-door
    depth: 0.55
    parallaxX: 0.5
    parallaxY: 0.2
    widthFactor: 0.5
    anchor: { x: 0.5, y: 0.45 }                       # the corner-store door
  - id: cracked-head
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.6
    anchor: { x: 0.5, y: 0.55 }                       # Cracked Head, in the doorway
  - id: ganger-blue
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.5
    anchor: { x: 0.2, y: 0.7 }                        # Blue inside, mid-frame
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
  - { x: 0.5, y: 0.55, zoom: 1.4, holdMs: 2800, ease: easeInOut }   # tight on Cracked Head in the doorway
  - { x: 0.2, y: 0.6, zoom: 1.2, holdMs: 1800, ease: easeInOut }    # cut to Blue's reaction
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: return-of-the-block:cracked-head-at-the-corner:pre:0
    speaker: Cracked Head
    portraitAssetId: assets/characters/cracked-head.webp
    soundHook: story.crowd.ambience
    text: |
      (From the doorway.) You sold me, Blue. OG tipped the
      feds to save my life. You took the deal. The block
      heard. I'm here anyway.
  - lineToken: return-of-the-block:cracked-head-at-the-corner:pre:1
    speaker: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    soundHook: story.crowd.cheer
    focusLayer: ganger-blue
    text: |
      You're — you're alive. You're at the corner. I'm at
      the corner. The deal's the deal. What do we do?
  - lineToken: return-of-the-block:cracked-head-at-the-corner:pre:2
    speaker: Cracked Head
    portraitAssetId: assets/characters/cracked-head.webp
    soundHook: story.card.flip
    text: |
      We fight. Three phases. The lie lands. The corner
      decides. Beat me first — earn the corner back.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: return-of-the-block:cracked-head-at-the-corner:pre:0, atMs: 0,    soundHook: story.crowd.ambience }
  - { lineToken: return-of-the-block:cracked-head-at-the-corner:pre:1, atMs: 2000, soundHook: story.crowd.cheer, focusLayerId: ganger-blue }
  - { lineToken: return-of-the-block:cracked-head-at-the-corner:pre:2, atMs: 4200, soundHook: story.card.flip }
```

---

## 3. Battle

```yaml
battle:
  id: cracked-head-at-the-corner
  title: "Cracked Head at the Corner"
  battleType: rule-twist
  mapPosition: { x: 57, y: 42 }
  prerequisites: [blues-guilt]
  optional: false
  enemy:
    name: Cracked Head
    portraitAssetId: assets/characters/cracked-head.webp
    behaviorProfile: balanced
    deck:
      - cracked-head
      - the-block                            # Cracked Head's signature card, in play
      - snow
      - rastamon
      - plug
      - snitch
      - wifey
  cinematic:
    videoAssetId: assets/story/chapter-seven/media/cracked-head-at-the-corner.mp4
    posterAssetId: assets/story/chapter-seven/media/cracked-head-at-the-corner.webp
    environmentAssetId: assets/venues/corner-store-court.webp
  modifiers:
    dealTaken: true                  # carries over
    middleDistrictLocked: true       # the corner store locks
    openHands: true                  # THE TWIST: both players see each other's hands
    crackedHeadSignature: true       # the signature is live
  phases: []
  starObjectives:
    - { id: win,       description: Win the encounter. }
    - { id: districts, description: Hold the middle district while Cracked Head walks in. }
    - { id: signature, description: Win without Cracked Head's signature resolving. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 100 }
  teaching:
    tips:
      - "Cracked Head's signature is live — deny it (third star)."
      - "Open hands — the lie is on the table, both players see."
      - "Middle district locks — the corner store is contested."
    focusMechanics: [middle district locked, open hands, signature denial]
    focusCards: [cornball, snow, cracked-head]
```

---

## 4. Drama notes

- **The return:** Cracked Head walks into the corner store.
  He's alive — in person — at the place where his "death"
  supposedly happened. Per the resolved-decision log: "OG
  Uncle tipped off the feds to save Cracked Head's life;
  Ganger Blue found out and snitched back, which is why he
  had to 'die.'" Now Cracked Head is back at the corner.
- **The lie is exposed:** "You sold me, Blue. OG tipped the
  feds to save my life. You took the deal." Cracked Head
  knows. Blue's deal is on the table.
- **Blue's question:** "What do we do?" — Blue is asking
  for forgiveness, or at least for guidance. The player
  has to hold the corner while the truth lands.
- **The setup:** Scene 06 (wheelchair-og) is OG Uncle in
  the wheelchair — the moment between OG Uncle and Cracked
  Head. Scene 07 (the-lie-exposed) is the boss fight — 3
  phases, the lie is out.
- **The signature:** Cracked Head's `the-block` card is in
  play. The player has to deny it for the third star. The
  signature mechanic echoes Ch1's boss fight — same
  mechanic, higher stakes.