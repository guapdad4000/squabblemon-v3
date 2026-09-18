# SCENE — `old-heads-know:baby-mommas-truth`

> Standard battle. Baby Momma drops the kid bombshell: Cracked
> Head is the father of her kid. Per the resolved-decision log,
> she has one child by him at the start of season 1 (toddler,
> off-screen) and a second on the way by chapter 7. Blue has
> to hear it.

---

## 1. Stage

```yaml
parallaxSceneId: old-heads-know:baby-momma:truth
venueId: hospital-room
mood: night
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
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.5, y: 0.55 }                       # OG Uncle in the bed, watching
  - id: ganger-blue
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.2, y: 0.7 }                        # Blue on the left, listening
  - id: baby-momma
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.65, y: 0.6 }                       # Baby Momma centered, holding the toddler
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
  - { x: 0.65, y: 0.55, zoom: 1.3, holdMs: 2400, ease: easeInOut }    # tight on Baby Momma + the toddler
  - { x: 0.2, y: 0.6, zoom: 1.15, holdMs: 2200, ease: easeInOut }     # cut to Blue's reaction
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: old-heads-know:baby-mommas-truth:pre:0
    speaker: Baby Momma
    portraitAssetId: assets/characters/baby-momma.webp
    soundHook: story.card.shuffle
    text: |
      Blue — look at him. Look at my kid. That's your
      nephew. That's Cracked Head's son.
  - lineToken: old-heads-know:baby-mommas-truth:pre:1
    speaker: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    soundHook: story.crowd.ambience
    focusLayer: ganger-blue
    text: |
      (Quietly.) He's — he's mine? He's got my brother's —
      (Looks at OG Uncle.) You knew. You knew about the kid.
  - lineToken: old-heads-know:baby-mommas-truth:pre:2
    speaker: Baby Momma
    portraitAssetId: assets/characters/baby-momma.webp
    soundHook: story.card.flip
    text: |
      He knew. He paid for the hospital. He came to see him
      once a month for four years. And there's another one
      on the way.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: old-heads-know:baby-mommas-truth:pre:0, atMs: 0,    soundHook: story.card.shuffle }
  - { lineToken: old-heads-know:baby-mommas-truth:pre:1, atMs: 2000, soundHook: story.crowd.ambience, focusLayerId: ganger-blue }
  - { lineToken: old-heads-know:baby-mommas-truth:pre:2, atMs: 4000, soundHook: story.card.flip }
```

---

## 3. Battle

```yaml
battle:
  id: baby-mommas-truth
  title: "Baby Momma's Truth"
  battleType: standard
  mapPosition: { x: 23, y: 62 }
  prerequisites: [the-old-heads-convene]
  optional: false
  enemy:
    name: Baby Momma
    portraitAssetId: assets/characters/baby-momma.webp
    behaviorProfile: balanced
    deck:
      - baby-momma
      - the-kid                            # placeholder — the card drops at finale
      - snow
      - rastamon
      - plug
      - wifey
      - og-uncle
  cinematic:
    videoAssetId: assets/story/chapter-five/media/baby-mommas-truth.mp4
    posterAssetId: assets/story/chapter-five/media/baby-mommas-truth.webp
    environmentAssetId: assets/venues/hospital-room.webp
  modifiers:
    familyCouncil: true                  # carries over from scene 01
    kidReveal: true                      # FLAG: the kid bombshell has dropped; the block knows now
  phases: []
  starObjectives:
    - { id: win,       description: Win the encounter. }
    - { id: districts, description: Hold all three districts while Baby Momma speaks. }
    - { id: squabble,  description: Win without using SQUABBLE. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 100 }
  teaching:
    tips:
      - "Baby Momma's deck is centered around family — counter with tempo."
      - "Hold all three districts while the bombshell lands."
      - "There's another one on the way — the second-kid flag carries to the finale."
    focusMechanics: [family council mode, district denial]
    focusCards: [cornball, snow, baby-momma]
```

---

## 4. Drama notes

- **The kid bombshell:** "That's your nephew. That's Cracked
  Head's son." is the chapter's central beat. Blue has to
  hear it. The kid is real.
- **OG Uncle's role:** "He knew. He paid for the hospital. He
  came to see him once a month for four years." is the family's
  acknowledgment that OG Uncle has been quietly supporting the
  kid for four years. He's been the witness-protection keeper
  AND the godfather, in secret.
- **The setup:** "There's another one on the way." is the
  chapter 7 setup. Per the resolved-decision log: Baby Momma
  has a second child on the way by chapter 7. The
  `the-kid` card at the finale represents the second child.
- **Blue's reaction:** "You knew. You knew about the kid." is
  Blue's grief compounding. He's just learned that OG Uncle
  knew about Cracked Head being alive (Ch3) AND about the kid
  (now). The family has been keeping secrets from him.
- **The flag:** `kidReveal: true` carries to the finale. The
  player's path through the chapter affects the finale's
  flavor (the second-kid is referenced differently based on
  prior choices).