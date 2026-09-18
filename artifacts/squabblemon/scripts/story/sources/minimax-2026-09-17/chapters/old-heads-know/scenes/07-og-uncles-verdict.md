# SCENE — `old-heads-know:og-uncles-verdict`

> The chapter boss. OG Uncle tests the player with the truth.
> Two phases: THE TRUTH (the receipts land — districts lock —
> the player holds) and THE RECKONING (OG Uncle demands the
> player choose — Blue's grief or the block's future). The
> player wins by holding all three districts across both
> phases and forcing OG Uncle to deliver his verdict.

---

## 1. Stage

```yaml
parallaxSceneId: old-heads-know:og-uncle:verdict
venueId: hospital-room
mood: night
durationMs: 8400                                # longer than usual — two phases
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
  - id: hospital-wall
    depth: 0.3
    parallaxX: 0.25
    parallaxY: 0.15
    widthFactor: 1.2
    anchor: { x: 0.5, y: 0.55 }
  - id: bed
    depth: 0.6
    parallaxX: 0.5
    parallaxY: 0.25
    widthFactor: 0.95
    anchor: { x: 0.5, y: 0.65 }
  - id: og-uncle
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.6
    anchor: { x: 0.5, y: 0.55 }                       # OG Uncle in the bed, centered, sitting up
  - id: ganger-blue
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.18, y: 0.7 }                       # Blue on the left, listening
  - id: baby-momma
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.82, y: 0.7 }                       # Baby Momma on the right, holding the toddler
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
  - { x: 0.5, y: 0.5, zoom: 1.0, holdMs: 1800, ease: easeInOut }     # wide on the bedside
  - { x: 0.5, y: 0.55, zoom: 1.4, holdMs: 2800, ease: easeInOut }    # tight on OG Uncle
  - { x: 0.18, y: 0.6, zoom: 1.15, holdMs: 1800, ease: easeInOut }   # cut to Blue
  - { x: 0.5, y: 0.6, zoom: 1.2, holdMs: 2000, ease: easeInOut }     # settle center, the verdict lands
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: old-heads-know:og-uncles-verdict:pre:0
    speaker: OG Uncle
    portraitAssetId: assets/characters/og-uncle.webp
    soundHook: story.hospital.monitor
    text: |
      You came this far. You held the family together. You
      heard Baby Momma. You saw Wifey stand. Now I'ma test
      you with the truth.
  - lineToken: old-heads-know:og-uncles-verdict:pre:1
    speaker: OG Uncle
    portraitAssetId: assets/characters/og-uncle.webp
    soundHook: story.tape.play
    focusLayer: og-uncle
    text: |
      The receipts say he's alive. The body wasn't in the
      ground. The kid is in the family. The block is gonna
      come for you — and you're gonna have to hold it.
  - lineToken: old-heads-know:og-uncles-verdict:pre:2
    speaker: OG Uncle
    portraitAssetId: assets/characters/og-uncle.webp
    soundHook: story.card.flip
    text: |
      Two districts. He only needed one. I'm old. I'm sick.
      I'm not gonna hold the block for him anymore. You
      hold it. The verdict lands. Win or don't.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: old-heads-know:og-uncles-verdict:pre:0, atMs: 0,    soundHook: story.hospital.monitor }
  - { lineToken: old-heads-know:og-uncles-verdict:pre:1, atMs: 2000, soundHook: story.tape.play, focusLayerId: og-uncle }
  - { lineToken: old-heads-know:og-uncles-verdict:pre:2, atMs: 4600, soundHook: story.card.flip }
```

---

## 3. Battle

```yaml
battle:
  id: og-uncles-verdict
  title: "OG Uncle's Verdict"
  battleType: boss
  mapPosition: { x: 88, y: 16 }
  prerequisites: [hooper-closes]
  optional: false
  enemy:
    name: OG Uncle
    portraitAssetId: assets/characters/og-uncle.webp
    behaviorProfile: balanced
    deck:
      - og-uncle
      - the-real-receipts                       # carries over from Ch4 — the verified receipts
      - baby-momma
      - wifey
      - snow
      - rastamon
      - plug
  cinematic:
    videoAssetId: assets/story/chapter-five/media/og-uncles-verdict.mp4
    posterAssetId: assets/story/chapter-five/media/og-uncles-verdict.webp
    environmentAssetId: assets/venues/hospital-room.webp
  modifiers: {}                                    # per-phase modifiers below
  phases:
    - id: phase-1-the-truth
      title: "The Truth"
      description: |
        OG Uncle tells the truth. The receipts land. All
        three districts lock. The player has to hold all
        three districts while the truth lands.
      modifiers:
        openHands: true                  # verification is automatic — both players see each other's hands
        allDistrictsLocked: true         # the truth locks the block
      objective:
        - Hold all three districts while the receipts land
    - id: phase-2-the-reckoning
      title: "The Reckoning"
      description: |
        OG Uncle demands the player choose: Blue's grief or
        the block's future. The player has to hold all three
        districts while the verdict lands.
      modifiers:
        playerChoice: true               # the player chooses a card that determines the block's future
        enemyMotionCostReduction: 1      # OG Uncle's deck is heavy on Motion
      objective:
        - Hold all three districts while the verdict lands
  starObjectives:
    - { id: win,       description: Beat OG Uncle across both phases. }
    - { id: districts, description: Hold all three districts across both phases. }
    - { id: verdict,   description: Force OG Uncle to deliver his verdict — 'You hold it now.' }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 250 }
    # NOTE: Baby Momma unlocks as a rival portrait at finale (the-family-blessed), not here.
    #       OG Uncle was already unlocked in chapter 3 (scene 03).
  teaching:
    tips:
      - "Phase 1 (The Truth) — districts lock. Hold all three while the receipts land."
      - "Phase 2 (The Reckoning) — choose a card that determines the block's future. Hold the districts."
      - "Win both phases clean to force OG Uncle's verdict (third star): 'You hold it now.'"
    focusMechanics: [district locking, open hands, choice resolution]
    focusCards: [cornball, snow, og-uncle]
```

---

## 4. Drama notes

- **The chapter boss:** OG Uncle is the chapter boss with two
  phases (per the season arc). He's testing the player with
  the truth — can they hold the block through the reckoning?
- **The two phases:**
  1. **THE TRUTH** — the receipts land. Districts lock.
     Open hands — verification is automatic. The player
     holds the block while the truth lands.
  2. **THE RECKONING** — OG Uncle demands the player choose.
     The player picks a card that determines the block's
     future. Motion discount on OG Uncle's side (he's
     determined). The player has to hold the districts.
- **The signature star:** "Force OG Uncle to deliver his
  verdict — 'You hold it now.'" is the third star. If the
  player wins both phases clean, OG Uncle says the line. If
  not, he says "You weren't ready."
- **The recurring line:** "Two districts. He only needed one"
  is OG Uncle's mid-season echo of the chapter 1 line. The
  season's recurring line echoes again in chapter 8 ("Zero
  districts. That's what you get for snitching.").
- **The handoff:** Scene 08 (the-family-blessed) is the
  chapter finale. Church Auntie blesses the verdict. Baby
  Momma unlocks. Chapter 6 unlocks.