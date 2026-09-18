# SCENE — `side-show:the-fake-funeral`

> Mini-boss battle. The Scammer interrupts Church Auntie's
> funeral with a stack of fake receipts. He's selling "the real
> story" — but his receipts are watermarked at three o'clock,
> not seven. The player has to defend the real receipts and
> push him out of the church.

---

## 1. Stage

```yaml
parallaxSceneId: side-show:funeral:scammer-interrupt
venueId: church
mood: night
durationMs: 7200
grain: 0.08                              # the projector footage bleeds into the funeral
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
    anchor: { x: 0.18, y: 0.7 }                       # OG Uncle in the back pew, watching
  - id: church-auntie
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.5
    anchor: { x: 0.5, y: 0.5 }                        # Church Auntie at the altar, shaken
  - id: scammer
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.78, y: 0.62 }                      # Scammer at the church door, fakes in hand
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
  - { x: 0.78, y: 0.55, zoom: 1.3, holdMs: 2400, ease: easeInOut }    # tight on Scammer at the door
  - { x: 0.5, y: 0.55, zoom: 1.15, holdMs: 2200, ease: easeInOut }    # settle on the altar
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: side-show:fake-funeral:pre:0
    speaker: Scammer
    portraitAssetId: assets/characters/scammer.webp
    soundHook: story.church.door-slam
    text: |
      (From the church door.) Hold up — hold the funeral.
      I got the real story. The name. The receipts. The tape.
      All watermarked. All real.
  - lineToken: side-show:fake-funeral:pre:1
    speaker: Church Auntie
    portraitAssetId: assets/characters/church-auntie.webp
    soundHook: story.church.hymn
    focusLayer: church-auntie
    text: |
      You don't come into this house with that. Whatever
      you're selling — it ain't the Lord.
  - lineToken: side-show:fake-funeral:pre:2
    speaker: Scammer
    portraitAssetId: assets/characters/scammer.webp
    soundHook: story.crowd.ambience
    text: |
      I'm not selling the Lord. I'm selling the truth.
      (Flashes a receipt.) See? Watermarked. Real. Just like
      Snitch's.
  - lineToken: side-show:fake-funeral:pre:3
    speaker: OG Uncle
    portraitAssetId: assets/characters/og-uncle.webp
    soundHook: story.pew.creak
    focusLayer: og-uncle
    text: |
      (From the back pew.) The dot's at three o'clock. Get
      him out.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: side-show:fake-funeral:pre:0, atMs: 0,    soundHook: story.church.door-slam }
  - { lineToken: side-show:fake-funeral:pre:1, atMs: 2000, soundHook: story.church.hymn, focusLayerId: church-auntie }
  - { lineToken: side-show:fake-funeral:pre:2, atMs: 4000, soundHook: story.crowd.ambience }
  - { lineToken: side-show:fake-funeral:pre:3, atMs: 5800, soundHook: story.pew.creak, focusLayerId: og-uncle }
```

---

## 3. Battle

```yaml
battle:
  id: the-fake-funeral
  title: "The Fake Funeral"
  battleType: mini-boss
  mapPosition: { x: 72, y: 31 }
  prerequisites: [church-aunties-setup]
  optional: false
  enemy:
    name: Scammer
    portraitAssetId: assets/characters/scammer.webp
    behaviorProfile: balanced
    deck:
      - scammer
      - plug
      - baby
      - oink
      - cornball
      - snow
      - wifey
  cinematic:
    videoAssetId: assets/story/chapter-four/media/fake-funeral.mp4
    posterAssetId: assets/story/chapter-four/media/fake-funeral.webp
    environmentAssetId: assets/venues/church.webp
  modifiers:
    fakeWatermark: true              # carries over from scene 03 — Scammer has more fakes
    sanctuaryInterrupt: true         # the Scammer is in the church; the player has to push him out
    # Engine reads the player's path state and applies one of:
    #   - if scene 03 was clean:        scammerFakeCount: 2   (the player spotted the fakes; Scammer is weakened)
    #   - if scene 03 was a loss:       scammerFakeCount: 5   (Scammer has more fakes; harder to verify)
    scammerFakeCount: 2
  phases: []
  starObjectives:
    - { id: win,        description: Win the encounter. }
    - { id: districts,  description: Hold all three districts while the Scammer is in the church. }
    - { id: evict,      description: Push the Scammer out of the church without playing any of his fakes. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 125 }
    # NOTE: Mini-bosses don't unlock characters. Church Auntie unlocks at finale.
    #       Scammer is the antagonist; he doesn't unlock as a rival.
  teaching:
    tips:
      - "Scammer's fakes have watermark dots at three o'clock. Don't play them."
      - "If you won scene 03 clean, the Scammer has fewer fakes. Otherwise he has more."
      - "Push him out of the church — your job is the funeral, not the fight."
    focusMechanics: [fake detection, eviction tempo, district denial]
    focusCards: [cornball, snow, scammer]
```

---

## 4. Drama notes

- **The mini-boss:** The Scammer is the chapter's antagonist.
  Per the season arc: "Sells fake receipts." The funeral scene
  is where his hustle crashes into Church Auntie's sanctuary.
- **The path resolution:** The engine reads the player's path
  flags from scene 03 (whether they spotted fakes) and applies
  the appropriate `scammerFakeCount`. The screenplay shows the
  clean-prior branch as the default static value.
- **The OG Uncle anchor:** OG Uncle's "The dot's at three
  o'clock. Get him out" is the player's confirmation cue. He's
  been watching from the back pew the whole chapter — he
  doesn't speak until this moment.
- **The setup:** The Scammer is pushed out. Snitch enters next
  (scene 07) with the actual real receipts. The boss fight is
  Snitch's verdict — the reveal that the funeral is for
  Cracked Head.
- **The third star:** "Push the Scammer out of the church
  without playing any of his fakes" is the player's test. If
  they played a fake, they failed. Snitch's verdict (scene 07)
  depends on this — the player who can spot fakes can win the
  boss clean.