# SCENE — `side-show:nail-techs-counter`

> Optional mastery match. Nail Tech — runs the corner store,
> recurring cameo — is in the alley. She has the real receipts
> and offers a verification lesson. The mastery carries into
> the boss fight (scene 07): a verified-watermark buff lets the
> player auto-spot fakes during Snitch's verdict.

---

## 1. Stage

```yaml
parallaxSceneId: side-show:alley:nail-tech
venueId: alley
mood: alley
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
  - id: alley-brick
    depth: 0.3
    parallaxX: 0.25
    parallaxY: 0.15
    widthFactor: 1.2
    anchor: { x: 0.5, y: 0.55 }
  - id: dumpster
    depth: 0.5
    parallaxX: 0.5
    parallaxY: 0.25
    widthFactor: 0.6
    anchor: { x: 0.18, y: 0.7 }
  - id: nail-tech
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.7, y: 0.62 }
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
  - { x: 0.7, y: 0.55, zoom: 1.3, holdMs: 2400, ease: easeInOut }    # tight on Nail Tech
  - { x: 0.4, y: 0.6, zoom: 1.1, holdMs: 2200, ease: easeInOut }     # pull back to the alley
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: side-show:nail-techs-counter:pre:0
    speaker: Nail Tech
    portraitAssetId: assets/characters/nail-tech.webp
    soundHook: story.alley.footsteps
    text: |
      Yo — you came to the alley for the receipts. Good. I
      keep the real ones back here. Snitch handles the front;
      I handle the verification.
  - lineToken: side-show:nail-techs-counter:pre:1
    speaker: Nail Tech
    portraitAssetId: assets/characters/nail-tech.webp
    soundHook: story.tape.scrub
    focusLayer: nail-tech
    text: |
      Look at the watermark. Seven o'clock, real. Three
      o'clock, fake. Snitch will tell you the same thing.
      The Scammer won't.
  - lineToken: side-show:nail-techs-counter:pre:2
    speaker: Nail Tech
    portraitAssetId: assets/characters/nail-tech.webp
    soundHook: story.crowd.cheer
    text: |
      Beat me clean and I'll mark your deck. You walk into
      that funeral knowing which cards are real.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: side-show:nail-techs-counter:pre:0, atMs: 0,    soundHook: story.alley.footsteps }
  - { lineToken: side-show:nail-techs-counter:pre:1, atMs: 1800, soundHook: story.tape.scrub, focusLayerId: nail-tech }
  - { lineToken: side-show:nail-techs-counter:pre:2, atMs: 3600, soundHook: story.crowd.cheer }
```

---

## 3. Battle

```yaml
battle:
  id: nail-techs-counter
  title: "Nail Tech's Counter"
  battleType: standard
  mapPosition: { x: 52, y: 76 }
  prerequisites: [snitchs-price]
  optional: true                            # optional mastery match
  enemy:
    name: Nail Tech
    portraitAssetId: assets/characters/nail-tech.webp
    behaviorProfile: balanced
    deck:
      - nail-tech
      - cornball
      - snow
      - rastamon
      - plug
      - snitch
      - oink
  cinematic:
    videoAssetId: assets/story/chapter-four/media/nail-techs-counter.mp4
    posterAssetId: assets/story/chapter-four/media/nail-techs-counter.webp
    environmentAssetId: assets/venues/alley.webp
  modifiers:
    receiptVerify: watermark                # carries over
    alleyMastery: true                      # FLAG: winning clean grants verified-watermark buff in boss fight
  phases: []
  starObjectives:
    - { id: win,       description: Win the encounter. }
    - { id: districts, description: Hold the alley and the corner at the same time. }
    - { id: squabble,  description: Win without using SQUABBLE. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 75 }
    - { kind: card, id: nail-tech, amount: 1 }   # Nail Tech card drops here; not a character unlock (cameo only)
  teaching:
    tips:
      - "Win this clean and your deck gets marked — verified watermarks for the boss fight."
      - "Real watermark at seven o'clock. Fake at three. Nail Tech confirms it."
      - "This mastery carries into Snitch's verdict (scene 07)."
    focusMechanics: [watermark verification, alley tempo, district denial]
    focusCards: [cornball, snow, nail-tech]
```

---

## 4. Drama notes

- **The mastery scene:** This is the chapter's optional side
  route. Winning clean (3 stars) carries the `alleyMastery:
  true` modifier into the boss fight as a player-side buff —
  verified watermarks. Skipping the mastery means the player
  has to verify manually during Snitch's verdict (harder).
- **The Nail Tech anchor:** Per the season arc, Nail Tech runs
  the corner store and cameos in every chapter. She's the
  verification authority — she can tell real from fake at a
  glance. Her cameo here is functional, not just decorative.
- **The setup:** "Beat me clean and I'll mark your deck" is the
  mastery trade. Nail Tech offers verification in exchange for
  the player proving they can spot fakes under pressure.
- **The cameo:** Nail Tech returns in chapter 5 (Old Heads
  Know), chapter 6 (The Function), and chapter 8 (The Crown).
  She is NOT unlocked as a rival portrait (cameo only); the
  player only gets her card.