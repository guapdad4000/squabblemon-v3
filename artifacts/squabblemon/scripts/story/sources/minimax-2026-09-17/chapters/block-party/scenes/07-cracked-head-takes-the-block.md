# SCENE — `block-party:cracked-head-takes-the-block`

> The chapter boss. Cracked Head — believed dead for four years —
> returns to claim the block his younger brother Ganger Blue has
> been holding in his place. Three phases: ARRIVAL (Cracked Head
> enters, demands all three districts), THE BLOCK HELD (player
> defends), "I'LL BE BACK" (Cracked Head concedes). The third
> star objective forces Cracked Head to say the full quote.

---

## 1. Stage

```yaml
parallaxSceneId: block-party:cracked-head:takes-the-block
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
  - id: rooftop
    depth: 0.55
    parallaxX: 0.5
    parallaxY: 0.2
    widthFactor: 1.0
    anchor: { x: 0.5, y: 0.35 }                       # the rooftop silhouette behind the storefront
  - id: cracked-head
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.65
    anchor: { x: 0.5, y: 0.58 }                       # Cracked Head, centered, larger than the rivals
  - id: ganger-blue
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.2, y: 0.7 }                        # Blue on the left, smaller — this isn't his moment
  - id: ganger-red
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.8, y: 0.7 }                        # Red on the right, watching
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
  - { x: 0.5, y: 0.35, zoom: 1.0, holdMs: 1800, ease: easeInOut }     # wide on the rooftop (Cracked Head's silhouette)
  - { x: 0.5, y: 0.55, zoom: 1.4, holdMs: 2600, ease: easeInOut }     # tight on Cracked Head, descent
  - { x: 0.2, y: 0.6, zoom: 1.15, holdMs: 1000, ease: easeInOut }     # cut to Blue
  - { x: 0.5, y: 0.6, zoom: 1.2, holdMs: 1000, ease: easeInOut }      # settle center, fight begins
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: block-party:cracked-head-takes-the-block:pre:0
    speaker: Cracked Head
    portraitAssetId: assets/characters/cracked-head.webp
    soundHook: story.crowd.ambience
    text: |
      Took you long enough. Four years I'ma been watching this
      block from the rooftop. Four years Blue's been holding
      it for me. Time's up.
  - lineToken: block-party:cracked-head-takes-the-block:pre:1
    speaker: Cracked Head
    portraitAssetId: assets/characters/cracked-head.webp
    soundHook: story.crowd.cheer
    focusLayer: cracked-head
    text: |
      You want the corner? Hold all three districts. You want
      the block? Beat me across all three rounds.
  - lineToken: block-party:cracked-head-takes-the-block:pre:2
    speaker: Cracked Head
    portraitAssetId: assets/characters/cracked-head.webp
    soundHook: story.card.flip
    text: |
      Don't get it twisted. I'm not here for the tape. I'm here
      for the block. Earn the line and I'll say it right.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: block-party:cracked-head-takes-the-block:pre:0, atMs: 0,    soundHook: story.crowd.ambience }
  - { lineToken: block-party:cracked-head-takes-the-block:pre:1, atMs: 2000, soundHook: story.crowd.cheer, focusLayerId: cracked-head }
  - { lineToken: block-party:cracked-head-takes-the-block:pre:2, atMs: 4400, soundHook: story.card.flip }
```

---

## 3. Battle

```yaml
battle:
  id: cracked-head-takes-the-block
  title: "Cracked Head Takes the Block"
  battleType: boss
  mapPosition: { x: 88, y: 16 }
  prerequisites: [snitch-at-the-corner]
  optional: false
  enemy:
    name: Cracked Head
    portraitAssetId: assets/characters/cracked-head.webp
    behaviorProfile: balanced
    deck:
      - cracked-head
      - the-block                                  # placeholder — the card is officially unlocked in chapter 2
      - snow
      - roaster
      - plug
      - snitch
      - wifey
  cinematic:
    videoAssetId: assets/story/chapter-one/media/cracked-head-boss.mp4
    posterAssetId: assets/story/chapter-one/media/cracked-head-boss.webp
    environmentAssetId: assets/venues/corner-store-court.webp
  modifiers: {}                                    # per-phase modifiers below
  phases:
    - id: phase-1-arrival
      title: "Arrival"
      description: |
        Cracked Head enters. All three districts lock. The player
        must hold the corner for two consecutive turns.
      modifiers:
        allDistrictsLocked: true
      objective:
        - Hold the corner for two consecutive turns
    - id: phase-2-the-block-held
      title: "The Block Held"
      description: |
        Cracked Head escalates. His Motion cards cost 1 less.
        The player has to match tempo or get buried.
      modifiers:
        enemyMotionCostReduction: 1
      objective:
        - Win this phase on turns 4-5
    - id: phase-3-ill-be-back
      title: "I'll Be Back"
      description: |
        Cracked Head plays his signature move. Both players have
        to play around it. The player wins by holding all three
        districts while his signature resolves.
      modifiers:
        crackedHeadSignature: true
      objective:
        - Hold all three districts while his signature is live
  starObjectives:
    - { id: win,       description: Beat Cracked Head across all three phases. }
    - { id: districts, description: Hold all three districts in I'll Be Back. }
    - { id: line,      description: Force Cracked Head to say the full 'I'll be back' line — earn the quote. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 200 }
    # NOTE: Cracked Head unlocks as a rival portrait at the finale (block-crowned), not here.
    #       The boss drops currency; the character unlock is the finale payout.
  teaching:
    tips:
      - "Phase 1 (Arrival) — districts lock. Hold the corner two turns in a row."
      - "Phase 2 (The Block Held) — Motion discount. Match tempo or lose."
      - "Phase 3 (I'll Be Back) — signature is live. Hold all three districts."
      - "Win all three phases clean to force Cracked Head's 'I'll be back' quote (third star)."
    focusMechanics: [district locking, Motion tempo, signature denial]
    focusCards: [cornball, snow, the-block]
```

---

## 4. Drama notes

- **The chapter boss:** Cracked Head's three-phase fight is the
  chapter's promise to the player. Phase 1 establishes the
  territory demand. Phase 2 escalates tempo. Phase 3 forces the
  player to deny the signature — same setup as chapter 2's boss
  fight (where Baby Momma plays "The Block").
- **The reveal:** Cracked Head's "Four years I'ma been watching
  this block from the rooftop. Four years Blue's been holding
  it for me" is the chapter's first on-the-record reveal that
  Cracked Head is alive. Per the resolved-decision log: Blue
  discovered the witness-protection arrangement and Snitch
  spread the rumor that Cracked Head died. Blue's betrayal in
  chapter 7 is his guilt catching up.
- **The signature star:** "Force Cracked Head to say the full
  'I'll be back' line" is the third star objective. If the
  player wins all three phases clean, Cracked Head says
  "I'll be back" over the rooftop. If not, he says "You got
  lucky. See you next season." (per chapter-1 drama notes).
- **The card placeholder:** Cracked Head's deck lists `the-block`
  here even though the card officially unlocks in chapter 2.
  This is a director-call: the card sprite can be a placeholder
  here, the proper unlock happens at chapter 2's finale.