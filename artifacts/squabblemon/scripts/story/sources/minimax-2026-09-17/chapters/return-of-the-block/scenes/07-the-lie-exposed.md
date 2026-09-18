# SCENE — `return-of-the-block:the-lie-exposed`

> The chapter boss. Cracked Head vs Ganger Blue — 1v1, 3
> phases. The lie is exposed. Per the resolved-decision log:
> "Chapter 8: Blue fights for the block anyway and earns his
> name back." This is the fight that determines whether Blue
> earns redemption in Ch8. Three phases: THE LIE (the deal
> is on the table), THE FORGIVENESS (the family chooses),
> THE VERDICT (the corner decides).

---

## 1. Stage

```yaml
parallaxSceneId: return-of-the-block:cracked-head:boss
venueId: corner-store-court
mood: dusk
durationMs: 8400                                # longer than usual — three phases
grain: 0.08                                     # the projector footage bleeds in
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
  - id: og-uncle-wheelchair
    depth: 0.55
    parallaxX: 0.5
    parallaxY: 0.25
    widthFactor: 0.6
    anchor: { x: 0.32, y: 0.65 }                       # OG Uncle in the wheelchair, watching
  - id: cracked-head
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.65
    anchor: { x: 0.5, y: 0.58 }                        # Cracked Head, centered, larger than Blue
  - id: ganger-blue
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.5
    anchor: { x: 0.78, y: 0.66 }                       # Blue, mid-frame, facing Cracked Head
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
  - { x: 0.5, y: 0.5, zoom: 1.0, holdMs: 1800, ease: easeInOut }     # wide on the corner
  - { x: 0.5, y: 0.55, zoom: 1.4, holdMs: 2400, ease: easeInOut }    # tight on Cracked Head
  - { x: 0.78, y: 0.6, zoom: 1.2, holdMs: 1800, ease: easeInOut }    # cut to Blue
  - { x: 0.5, y: 0.6, zoom: 1.2, holdMs: 2400, ease: easeInOut }     # settle center, the verdict lands
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: return-of-the-block:lie-exposed:pre:0
    speaker: Cracked Head
    portraitAssetId: assets/characters/cracked-head.webp
    soundHook: story.crowd.ambience
    text: |
      You took the deal, Blue. OG tipped the feds to save my
      life. You sold the truth to the police. The block
      heard. Now we fight for it.
  - lineToken: return-of-the-block:lie-exposed:pre:1
    speaker: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    soundHook: story.crowd.cheer
    focusLayer: ganger-blue
    text: |
      I held this block for you. Four years. For a lie. I
      sold it for the truth. Beat me — earn the corner back.
  - lineToken: return-of-the-block:lie-exposed:pre:2
    speaker: Cracked Head
    portraitAssetId: assets/characters/cracked-head.webp
    soundHook: story.card.flip
    text: |
      Three phases. The lie. The forgiveness. The verdict.
      Whichever way it lands — the block decides. Outplay
      me, and the corner's yours.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: return-of-the-block:lie-exposed:pre:0, atMs: 0,    soundHook: story.crowd.ambience }
  - { lineToken: return-of-the-block:lie-exposed:pre:1, atMs: 2000, soundHook: story.crowd.cheer, focusLayerId: ganger-blue }
  - { lineToken: return-of-the-block:lie-exposed:pre:2, atMs: 4400, soundHook: story.card.flip }
```

---

## 3. Battle

```yaml
battle:
  id: the-lie-exposed
  title: "The Lie Exposed"
  battleType: boss
  mapPosition: { x: 88, y: 16 }
  prerequisites: [wheelchair-og]
  optional: false
  enemy:
    name: Cracked Head
    portraitAssetId: assets/characters/cracked-head.webp
    behaviorProfile: balanced
    deck:
      - cracked-head
      - the-block                                  # Cracked Head's signature card, in play
      - snow
      - rastamon
      - plug
      - snitch
      - wifey
  cinematic:
    videoAssetId: assets/story/chapter-seven/media/lie-exposed.mp4
    posterAssetId: assets/story/chapter-seven/media/lie-exposed.webp
    environmentAssetId: assets/venues/corner-store-court.webp
  modifiers: {}                                    # per-phase modifiers below
  phases:
    - id: phase-1-the-lie
      title: "The Lie"
      description: |
        The deal is on the table. All three districts lock.
        The player has to hold the corner while the lie lands.
      modifiers:
        allDistrictsLocked: true
        openHands: true                  # the lie is on the table — both players see
      objective:
        - Hold the corner for two consecutive turns
    - id: phase-2-the-forgiveness
      title: "The Forgiveness"
      description: |
        The family chooses. Wifey's stand (carried from Ch5)
        gives the player an ally buff. Cracked Head's Motion
        costs 1 less. The player has to outplay the tempo.
      modifiers:
        enemyMotionCostReduction: 1
        allyWifey: true                  # Wifey stands by Blue (carries from Ch5)
      objective:
        - Win this phase on turns 4-5
    - id: phase-3-the-verdict
      title: "The Verdict"
      description: |
        The corner decides. Cracked Head's signature is live.
        The player has to hold all three districts while the
        verdict lands.
      modifiers:
        crackedHeadSignature: true       # Cracked Head's signature is live
      objective:
        - Hold all three districts while the verdict lands
  starObjectives:
    - { id: win,       description: Beat Cracked Head across all three phases. }
    - { id: districts, description: Hold all three districts in The Verdict. }
    - { id: redemption, description: Force Cracked Head to say the redemption line — 'You earn it back tomorrow.' }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 250 }
    # NOTE: Character unlock happens at finale (the-block-changes-hands), not here.
    #       Delivery Demon unlocks at finale.
  teaching:
    tips:
      - "Phase 1 (The Lie) — districts lock. Hold the corner two turns in a row."
      - "Phase 2 (The Forgiveness) — Wifey is your ally. Cracked Head's Motion costs 1 less."
      - "Phase 3 (The Verdict) — Cracked Head's signature is live. Hold all three districts."
      - "Win all three phases clean to force Cracked Head's redemption line (third star)."
    focusMechanics: [district locking, ally tempo, signature denial]
    focusCards: [cornball, snow, cracked-head]
```

---

## 4. Drama notes

- **The chapter boss:** Cracked Head vs Ganger Blue — 1v1,
  3 phases. Per the resolved-decision log: "Chapter 8: Blue
  fights for the block anyway and earns his name back." The
  Ch7 boss is the fight that determines whether Blue gets the
  redemption arc.
- **The three phases:**
  1. **THE LIE** — the deal is on the table. All districts
     lock. Both players see each other's hands. The player
     has to hold the corner while the lie lands.
  2. **THE FORGIVENESS** — the family chooses. Wifey stands
     by Blue (carries from Ch5). Cracked Head's Motion costs
     1 less. The player has to outplay the tempo.
  3. **THE VERDICT** — the corner decides. Cracked Head's
     signature is live. The player has to hold all three
     districts while the verdict lands.
- **The signature star:** "Force Cracked Head to say the
  redemption line — 'You earn it back tomorrow.'" is the
  third star. If the player wins all three phases clean,
  Cracked Head says the line. If not, "You earned nothing."
- **Wifey's ally:** Wifey joins the player's side in phase 2.
  Her `wifeyStands: true` flag from Ch5 carries through.
- **The handoff:** Scene 08 (the-block-changes-hands) is
  the chapter finale. The block changes. Chapter 8 unlocks.