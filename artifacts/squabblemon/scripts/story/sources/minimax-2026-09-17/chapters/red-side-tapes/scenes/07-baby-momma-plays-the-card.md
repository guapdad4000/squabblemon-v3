# SCENE — `red-side-tapes:baby-momma-plays-the-card`

> The chapter boss. Baby Momma — Cracked Head's ex, the heart of
> the season — steps out of the corner store and plays "The Block,"
> a 6-cost / 12-power card from Cracked Head's old deck. Three
> phases: SET (tape replay), READ (On-Reveal doubles), PLAYED
> (the card lives). The player has to outplay the card itself to
> win. This is the season's first formal reveal that Cracked Head
> is alive — his deck is in play.

---

## 1. Stage

```yaml
parallaxSceneId: red-side-tapes:baby-momma:plays-the-card
venueId: corner-store-court
mood: dusk
durationMs: 8400                                # longer than usual — three phases
grain: 0.08                                     # the projector footage bleeds into the scene
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
  - id: the-block-card                 # THE card, hovering in the scene from phase 1 onward
    depth: 0.6
    parallaxX: 0.7
    parallaxY: 0.3
    widthFactor: 0.45
    anchor: { x: 0.5, y: 0.4 }                  # card glows above the storefront, center stage
  - id: baby-momma
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.6
    anchor: { x: 0.5, y: 0.6 }                  # centered, holding the card
  - id: ganger-red
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.2, y: 0.7 }                  # Red on the left, watching
  - id: snitch
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.4
    anchor: { x: 0.8, y: 0.7 }                  # Snitch on the right, camera rolling
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
  - { x: 0.5, y: 0.5, zoom: 1.0, holdMs: 1800, ease: easeInOut }     # wide — the corner
  - { x: 0.5, y: 0.4, zoom: 1.3, holdMs: 2200, ease: easeInOut }     # close on the card (the-block-card layer)
  - { x: 0.5, y: 0.55, zoom: 1.4, holdMs: 2400, ease: easeInOut }    # close on Baby Momma
  - { x: 0.3, y: 0.6, zoom: 1.1, holdMs: 1000, ease: easeInOut }     # pan to Red
  - { x: 0.5, y: 0.6, zoom: 1.15, holdMs: 1000, ease: easeInOut }    # settle center, fight begins
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: red-side-tapes:baby-momma-plays-the-card:pre:0
    speaker: Baby Momma
    portraitAssetId: assets/characters/baby-momma.webp
    soundHook: story.tape.play
    text: |
      I been waiting four years for somebody to bring me a tape.
      Four years I been sitting at this corner with his kid on
      my hip and his deck in my bag.
  - lineToken: red-side-tapes:baby-momma-plays-the-card:pre:1
    speaker: Baby Momma
    portraitAssetId: assets/characters/baby-momma.webp
    soundHook: story.card.shuffle
    focusLayer: baby-momma
    text: |
      Now I'ma play you a card. His card. From his old deck.
      You think this corner forgot him? The corner don't forget.
  - lineToken: red-side-tapes:baby-momma-plays-the-card:pre:2
    speaker: Baby Momma
    portraitAssetId: assets/characters/baby-momma.webp
    soundHook: story.card.flip
    text: |
      You think you earned it? Let's see you hold it. Three phases.
      The card is set. The card is read. The card is played.
      Outplay the card — and it's yours.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: red-side-tapes:baby-momma-plays-the-card:pre:0, atMs: 0,    soundHook: story.tape.play }
  - { lineToken: red-side-tapes:baby-momma-plays-the-card:pre:1, atMs: 2200, soundHook: story.card.shuffle, focusLayerId: baby-momma }
  - { lineToken: red-side-tapes:baby-momma-plays-the-card:pre:2, atMs: 4600, soundHook: story.card.flip }
```

---

## 3. Battle

```yaml
battle:
  id: baby-momma-plays-the-card
  title: "Baby Momma Plays the Card"
  battleType: boss
  mapPosition: { x: 88, y: 16 }
  prerequisites: [wifeys-verdict]
  optional: false
  enemy:
    name: Baby Momma
    portraitAssetId: assets/characters/baby-momma.webp
    behaviorProfile: balanced
    deck:
      - baby-momma
      - the-block                                   # Cracked Head's signature card, in play
      - wifey
      - snow
      - plug
      - snitch
      - cornball
  cinematic:
    videoAssetId: assets/story/chapter-two/media/baby-momma-boss.mp4
    posterAssetId: assets/story/chapter-two/media/baby-momma-boss.webp
    environmentAssetId: assets/venues/corner-store-court.webp
  modifiers: {}                                    # per-phase modifiers below
  phases:
    - id: phase-1-the-card-is-set
      title: "The Card is Set"
      description: |
        Baby Momma plays the tape again. On-Reveal effects fire
        twice for both players (replay mechanic).
      modifiers:
        onRevealDouble: true
      objective:
        - Hold the corner for two consecutive turns
    - id: phase-2-the-card-is-read
      title: "The Card is Read"
      description: |
        Baby Momma reads the card aloud. Her Motion cards cost 1
        less. The player has to match the tempo or get buried.
      modifiers:
        enemyMotionCostReduction: 1
      objective:
        - Win this phase on turns 4-5
    - id: phase-3-the-card-is-played
      title: "The Card is Played"
      description: |
        The card is on the field. Both players have to play around
        it. The player wins by holding all three districts while
        the card is active.
      modifiers:
        theBlockActive: true                        # signature card is now in play on Baby Momma's side
      objective:
        - Hold all three districts while the card is live
  starObjectives:
    - { id: win,        description: Beat Baby Momma across all three phases. }
    - { id: districts,  description: Hold all three districts in The Card is Played. }
    - { id: signature,  description: Win without Baby Momma's The Block ever resolving. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 200 }
    # NOTE: "The Block" card unlock happens at finale (tape-returned), not here.
    #       The boss drops currency. The clue card is the finale payout.
  teaching:
    tips:
      - "Phase 1 (SET) — On-Reveal doubles. Save your heavy On-Reveal for the back half."
      - "Phase 2 (READ) — Baby Momma's Motion costs 1 less. Match tempo with cheap cards turn 1-3."
      - "Phase 3 (PLAYED) — 'The Block' is live. Hold all three districts or it resolves."
      - "Win the boss without 'The Block' resolving for the signature star."
    focusMechanics: [On-Reveal doubling, Motion tempo, signature card denial]
    focusCards: [cornball, snow, the-block]
```

---

## 4. Drama notes

- **The chapter boss:** Baby Momma is the chapter's heart. She
  doesn't fight for territory — she fights for clarity, and for
  the truth about Cracked Head. Her deck is centered around his
  signature card, which she plays in phase 3.
- **The three phases:**
  1. **SET** — the tape plays again. Reuses the chapter's rule
     twist (`onRevealDouble`) to confirm it's a season mechanic,
     not a one-off.
  2. **READ** — Baby Momma reads the card aloud. Tempo, not
     territory. The player has to match her Motion discount or
     lose the turn cycle.
  3. **PLAYED** — the card is on the field. The signature card
     mechanic ("Add a copy of a card you played last turn to
     your hand") is now live. The player wins by denying it.
- **The signature star:** The third star objective — "Win without
  Baby Momma's The Block ever resolving" — is a callback to
  Cracked Head's chapter 7 boss setup. If the player learns to
  deny signature cards here, they'll be ready for the chapter 7
  fight.
- **The reveal:** Cracked Head's signature card being in play,
  drawn from his old deck, is the season's first formal reveal
  that Cracked Head is alive. Baby Momma's line "The corner
  don't forget" is the cue.
- **The flavor:** If both prior scenes were clean wins
  (`tapeReveal: red-tape` AND `tapeReveal: blue-tape`), the card's
  flavor text reads "He kept the receipts." Otherwise it reads
  "He kept the lie." The card itself is identical either way.