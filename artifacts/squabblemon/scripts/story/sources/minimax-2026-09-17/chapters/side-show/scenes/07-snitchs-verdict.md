# SCENE — `side-show:snitchs-verdict`

> The chapter boss. Snitch — with the real receipts in hand —
> reveals who's really being eulogized at Church Auntie's
> funeral: Cracked Head. Three phases: SHOW (the tape plays),
> READ (the receipts are read aloud), VERDICT (the truth).
> This is the season's second formal reveal that Cracked Head
> is alive — and the moment the wider block finds out.

---

## 1. Stage

```yaml
parallaxSceneId: side-show:snitch-verdict:rooftop
venueId: church
mood: night
durationMs: 8400                                # longer than usual — three phases
grain: 0.08                                     # the projector footage bleeds into the funeral
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
  - id: projector-screen
    depth: 0.55
    parallaxX: 0.5
    parallaxY: 0.2
    widthFactor: 0.85
    anchor: { x: 0.5, y: 0.4 }                       # the projector screen behind the altar
  - id: altar
    depth: 0.6
    parallaxX: 0.55
    parallaxY: 0.3
    widthFactor: 0.9
    anchor: { x: 0.5, y: 0.65 }
  - id: og-uncle
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.18, y: 0.7 }                      # OG Uncle in the back pew, watching
  - id: baby-momma
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.32, y: 0.7 }                      # Baby Momma beside OG Uncle
  - id: church-auntie
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.5
    anchor: { x: 0.5, y: 0.5 }                       # Church Auntie at the altar
  - id: snitch
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.6
    anchor: { x: 0.78, y: 0.6 }                      # Snitch with the projector, the receipts, the truth
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
  - { x: 0.5, y: 0.5, zoom: 1.0, holdMs: 1800, ease: easeInOut }     # wide on the church
  - { x: 0.5, y: 0.4, zoom: 1.25, holdMs: 2400, ease: easeInOut }    # close on the projector screen
  - { x: 0.78, y: 0.55, zoom: 1.4, holdMs: 2600, ease: easeInOut }    # tight on Snitch and the receipts
  - { x: 0.5, y: 0.6, zoom: 1.15, holdMs: 1600, ease: easeInOut }     # settle center, the truth lands
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: side-show:snitchs-verdict:pre:0
    speaker: Snitch
    portraitAssetId: assets/characters/snitch.webp
    soundHook: story.tape.play
    text: |
      Y'all want the truth? I'll give it to you. Watermarked.
      Verified. The dot's at seven — the real dot. Watch the
      projector.
  - lineToken: side-show:snitchs-verdict:pre:1
    speaker: Snitch
    portraitAssetId: assets/characters/snitch.webp
    soundHook: story.receipts.read
    focusLayer: snitch
    text: |
      Four years ago tonight. The corner store. The
      funeral. The receipts. The receipts say the body
      wasn't there. The body was never there.
  - lineToken: side-show:snitchs-verdict:pre:2
    speaker: Snitch
    portraitAssetId: assets/characters/snitch.webp
    soundHook: story.tape.rewind
    text: |
      The funeral is for Cracked Head. He's alive. He's been
      alive the whole time. And tonight — the block finds out.
      Three phases. SHOW. READ. VERDICT.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: side-show:snitchs-verdict:pre:0, atMs: 0,    soundHook: story.tape.play }
  - { lineToken: side-show:snitchs-verdict:pre:1, atMs: 2000, soundHook: story.receipts.read, focusLayerId: snitch }
  - { lineToken: side-show:snitchs-verdict:pre:2, atMs: 4400, soundHook: story.tape.rewind }
```

---

## 3. Battle

```yaml
battle:
  id: snitchs-verdict
  title: "Snitch's Verdict"
  battleType: boss
  mapPosition: { x: 88, y: 16 }
  prerequisites: [the-fake-funeral]
  optional: false
  enemy:
    name: Snitch
    portraitAssetId: assets/characters/snitch.webp
    behaviorProfile: balanced
    deck:
      - snitch
      - the-real-receipts                       # the verified receipts, in play
      - cracked-head                             # Cracked Head's signature card, played by Snitch
      - plug
      - baby
      - cornball
      - snow
  cinematic:
    videoAssetId: assets/story/chapter-four/media/snitchs-verdict.mp4
    posterAssetId: assets/story/chapter-four/media/snitchs-verdict.webp
    environmentAssetId: assets/venues/church.webp
  modifiers: {}                                    # per-phase modifiers below
  phases:
    - id: phase-1-show
      title: "Show"
      description: |
        Snitch plays the tape. The projector footage locks
        all three districts. The player has to hold the corner
        for two consecutive turns.
      modifiers:
        allDistrictsLocked: true
        openHands: true                  # both players see each other's hands — verification is on the table
      objective:
        - Hold the corner for two consecutive turns
    - id: phase-2-read
      title: "Read"
      description: |
        Snitch reads the receipts aloud. The verified card
        (`the-real-receipts`) enters play. The player has to
        deny it for two consecutive turns.
      modifiers:
        verifiedCardActive: true         # Snitch's `the-real-receipts` is on the field
        enemyVerifiedPower: 2            # the verified card gives Snitch +2 power
      objective:
        - Deny the verified card for two consecutive turns
    - id: phase-3-verdict
      title: "Verdict"
      description: |
        The verdict. Cracked Head's signature card is on the
        field. The player wins by holding all three districts
        while the verdict lands.
      modifiers:
        crackedHeadSignature: true       # Cracked Head's signature is live on Snitch's side
      objective:
        - Hold all three districts while the verdict lands
  starObjectives:
    - { id: win,       description: Beat Snitch across all three phases. }
    - { id: districts, description: Hold all three districts in Verdict. }
    - { id: truth,     description: Force Snitch to read the name out loud — 'Cracked Head.' }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 200 }
    # NOTE: Character unlock happens at finale (the-real-receipts), not here.
    #       `the-real-receipts` card drops at the finale too.
  teaching:
    tips:
      - "Phase 1 (Show) — districts lock. Hold the corner two turns in a row."
      - "Phase 2 (Read) — verified card gives Snitch +2 power. Deny it two turns in a row."
      - "Phase 3 (Verdict) — Cracked Head's signature is live. Hold all three districts."
      - "Win all three phases clean to force Snitch to read the name out loud (third star)."
    focusMechanics: [district locking, verified-card denial, signature denial]
    focusCards: [cornball, snow, the-real-receipts]
```

---

## 4. Drama notes

- **The chapter boss:** Snitch is the chapter boss. He has the
  real receipts and he's been holding them for four years. The
  funeral is his stage.
- **The reveal:** "The funeral is for Cracked Head. He's alive.
  He's been alive the whole time" is the season's second formal
  reveal. The first was Cracked Head's own appearance in Ch1's
  boss fight (and OG Uncle's confirmation in Ch3). Ch4 confirms
  it to the wider block. From this chapter forward, every
  character in the season knows.
- **The three phases:**
  1. **SHOW** — the tape plays. Districts lock. Both players
     see each other's hands. Verification is on the table.
  2. **READ** — Snitch reads the receipts. The verified card
     enters play. The player has to deny it.
  3. **VERDICT** — Cracked Head's signature card is on the
     field. The player wins by holding all three districts
     while the verdict lands.
- **The signature star:** "Force Snitch to read the name out
  loud — 'Cracked Head.'" is the third star. If the player wins
  all three phases clean, Snitch reads the name. Otherwise he
  reads around it ("somebody's cousin, somebody's brother,"
  per Church Auntie's setup).
- **OG Uncle + Baby Momma:** Both are in the back pew. They
  don't speak in this scene — their presence is the
  confirmation. They've known all along. Now the block does.
- **The setup:** Scene 08 (the-real-receipts) is the chapter
  finale. Church Auntie blesses the truth. Chapter 5 unlocks.