# SCENE — `return-of-the-block:blue-takes-the-deal`

> Opening battle of Chapter 7. Blue meets Officer Oink at the
> corner. Takes the deal — the betrayal. Per the resolved-
> decision log: "Blue betrays Cracked Head in chapter 7 and
> redeems in chapter 8." This is the betrayal.

---

## 1. Stage

```yaml
parallaxSceneId: return-of-the-block:corner:deal
venueId: corner-store-court
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
    anchor: { x: 0.18, y: 0.7 }                       # the same vending machine (callback)
  - id: officer-oink
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.78, y: 0.62 }                      # Officer Oink in his cruiser, door open
  - id: ganger-blue
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.5
    anchor: { x: 0.35, y: 0.66 }                      # Blue across from Oink, hands shaking
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
  - { x: 0.78, y: 0.55, zoom: 1.3, holdMs: 2400, ease: easeInOut }   # tight on Officer Oink
  - { x: 0.35, y: 0.6, zoom: 1.25, holdMs: 2200, ease: easeInOut }    # tight on Blue's hands
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: return-of-the-block:blue-takes-the-deal:pre:0
    speaker: Officer Oink
    portraitAssetId: assets/characters/officer-oink.webp
    soundHook: story.sirens.distant
    text: |
      Blue. We know your brother's in witness protection. We
      know where. We know when. All you gotta do is sign.
  - lineToken: return-of-the-block:blue-takes-the-deal:pre:1
    speaker: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    soundHook: story.crowd.ambience
    focusLayer: ganger-blue
    text: |
      (Hands shaking.) He's my brother. He's been alive this
      whole time. I held the block for a lie. You want me
      to sell the lie?
  - lineToken: return-of-the-block:blue-takes-the-deal:pre:2
    speaker: Officer Oink
    portraitAssetId: assets/characters/officer-oink.webp
    soundHook: story.paperwork.write
    text: |
      I want you to sell the truth. He's alive. He's in
      witness protection. Sign here. We handle the rest.
      Beat me first — then we sign.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: return-of-the-block:blue-takes-the-deal:pre:0, atMs: 0,    soundHook: story.sirens.distant }
  - { lineToken: return-of-the-block:blue-takes-the-deal:pre:1, atMs: 2000, soundHook: story.crowd.ambience, focusLayerId: ganger-blue }
  - { lineToken: return-of-the-block:blue-takes-the-deal:pre:2, atMs: 4000, soundHook: story.paperwork.write }
```

---

## 3. Battle

```yaml
battle:
  id: blue-takes-the-deal
  title: "Blue Takes the Deal"
  battleType: guided
  mapPosition: { x: 8, y: 76 }
  prerequisites: []
  optional: false
  enemy:
    name: Officer Oink
    portraitAssetId: assets/characters/officer-oink.webp
    behaviorProfile: balanced
    deck:
      - officer-oink
      - plug
      - baby
      - oink
      - cornball
      - snow
      - wifey
  cinematic:
    videoAssetId: assets/story/chapter-seven/media/blue-takes-the-deal.mp4
    posterAssetId: assets/story/chapter-seven/media/blue-takes-the-deal.webp
    environmentAssetId: assets/venues/corner-store-court.webp
  modifiers:
    dealTaken: true                  # FLAG: Blue has taken the deal — the betrayal is in motion
    openHands: true                  # the deal is on the table — both players see each other's hands
  phases: []
  starObjectives:
    - { id: win,       description: Win the encounter. }
    - { id: districts, description: Hold all three districts while the deal is signed. }
    - { id: deal,      description: Win without playing any non-district cards. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 50 }
    # NOTE: Officer Oink is a cameo; — not a rival portrait unlock here.
    #       Delivery Demon unlocks at finale.
  teaching:
    tips:
      - "The deal is on the table — open hands, both players see."
      - "Win without playing non-district cards — the deal is about the block, not the cards."
      - "Beat Oink, and Blue signs. The betrayal is in motion."
    focusMechanics: [deal in motion, open hands, district focus]
    focusCards: [cornball, snow, officer-oink]
```

---

## 4. Drama notes

- **The betrayal:** Blue signs the deal. Per the resolved-
  decision log: "Blue betrays Cracked Head in chapter 7 and
  redeems in chapter 8." This scene is the signing.
- **The setup:** "We know your brother's in witness protection.
  We know where. We know when." Officer Oink has the intel.
  Blue's guilt catches up — he sold the truth to the police.
- **Blue's hesitation:** "He's been alive this whole time. I
  held the block for a lie." Blue's grief becomes rage. He
  signs anyway. The betrayal is in motion.
- **The flag:** `dealTaken: true` carries forward. Snitch
  records it (scene 02). Blue's guilt catches up (scene 03).
  The lie is exposed (scene 07).
- **The vending machine:** Same vending machine from Ch1,
  Ch2, Ch4. The season's longest callback chain. Cracked
  Head kicked it first (per Ch2's `tape-returned`).