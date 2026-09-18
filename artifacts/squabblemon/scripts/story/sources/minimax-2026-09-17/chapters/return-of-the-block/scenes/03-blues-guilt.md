# SCENE — `return-of-the-block:blues-guilt`

> Standard battle. Blue's guilt catches up. Wifey stands by
> Blue — she doesn't leave. Per the resolved-decision log,
  "Blue betrays Cracked Head in chapter 7 and redeems in
> chapter 8." This scene is the weight of the betrayal. The
> player has to hold the corner while Blue grieves.

---

## 1. Stage

```yaml
parallaxSceneId: return-of-the-block:blue:guilt
venueId: blue-side-flat
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
  - id: brick-wall
    depth: 0.3
    parallaxX: 0.25
    parallaxY: 0.15
    widthFactor: 1.2
    anchor: { x: 0.5, y: 0.55 }
  - id: couch
    depth: 0.6
    parallaxX: 0.55
    parallaxY: 0.3
    widthFactor: 0.6
    anchor: { x: 0.65, y: 0.7 }                       # Blue's couch, where he sat in Ch3
  - id: ganger-blue
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.7, y: 0.62 }                      # Blue on the couch, head in hands
  - id: wifey
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.5
    anchor: { x: 0.18, y: 0.66 }                     # Wifey at the kitchen counter, watching
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
  - { x: 0.7, y: 0.6, zoom: 1.35, holdMs: 2800, ease: easeInOut }   # tight on Blue grieving
  - { x: 0.18, y: 0.55, zoom: 1.15, holdMs: 2200, ease: easeInOut }   # cut to Wifey
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: return-of-the-block:blues-guilt:pre:0
    speaker: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    soundHook: story.crowd.ambience
    text: |
      (Head in hands.) I sold him. I sold my brother. He's
      alive. He's coming home. And I sold him to the police.
  - lineToken: return-of-the-block:blues-guilt:pre:1
    speaker: Wifey
    portraitAssetId: assets/characters/wifey.webp
    soundHook: story.door.close
    focusLayer: wifey
    text: |
      Blue. Whatever you sold — you didn't sell the block.
      You didn't sell the kid. You didn't sell me. We
      figure out the rest.
  - lineToken: return-of-the-block:blues-guilt:pre:2
    speaker: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    soundHook: story.crowd.cheer
    text: |
      Two districts. I only needed one. He only needed one.
      The lie's the lie — the block's is the block's. We
      hold it.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: return-of-the-block:blues-guilt:pre:0, atMs: 0,    soundHook: story.crowd.ambience }
  - { lineToken: return-of-the-block:blues-guilt:pre:1, atMs: 2000, soundHook: story.door.close, focusLayerId: wifey }
  - { lineToken: return-of-the-block:blues-guilt:pre:2, atMs: 4000, soundHook: story.crowd.cheer }
```

---

## 3. Battle

```yaml
battle:
  id: blues-guilt
  title: "Blue's Guilt"
  battleType: standard
  mapPosition: { x: 40, y: 54 }
  prerequisites: [snitchs-roll-call]
  optional: false
  enemy:
    name: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    behaviorProfile: balanced
    deck:
      - ganger-blue
      - snow
      - rastamon
      - plug
      - wifey
      - baby
      - oink
  cinematic:
    videoAssetId: assets/story/chapter-seven/media/blues-guilt.mp4
    posterAssetId: assets/story/chapter-seven/media/blues-guilt.webp
    environmentAssetId: assets/venues/blue-side-flat.webp
  modifiers:
    dealTaken: true                  # carries over
    guiltFlag: true                  # FLAG: Blue's guilt is the chapter's central weight
    wifeyStands: true                # carries over from Ch5 — Wifey stands by Blue
  phases: []
  starObjectives:
    - { id: win,       description: Win the encounter. }
    - { id: districts, description: Hold all three districts while Blue grieves. }
    - { id: squabble,  description: Win without using SQUABBLE. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 100 }
  teaching:
    tips:
      - "Blue's guilt is the chapter's weight — hold all three districts while he grieves."
      - "Wifey's commitment carries from Ch5 — she's still here."
      - "Win clean and Blue's redemption path opens. Lose and the deal sticks."
    focusMechanics: [guilt weight, ally tempo, district denial]
    focusCards: [cornball, snow, ganger-blue]
```

---

## 4. Drama notes

- **The guilt:** Blue sold his brother. He's on his couch,
  grieving. This is the same couch from Ch3's `blue-in-denial`
  — Blue's been in denial for the whole season. Now the deal
  is done and the guilt is real.
- **Wifey's stand:** "You didn't sell the block. You didn't
  sell the kid. You didn't sell me." Wifey is the constant.
  She stood by Blue in Ch3, Ch5, and now Ch7. Her
  `wifeyStands: true` flag from Ch5 carries through.
- **The redemption setup:** "We figure out the rest" is
  Wifey's commitment. The redemption arc (per resolved-
  decision log: "Chapter 8: Blue fights for the block
  anyway and earns his name back") is set up here.
- **The recurring line:** "Two districts. I only needed one."
  is the second echo of the season's first recurring line.
  Blue's take this time — both he and Cracked Head only
  needed one.
- **The setup:** Scene 04 (Cracked Head at the corner) is
  his return. Scene 06 (wheelchair-og) is OG Uncle in the
  wheelchair. Scene 07 (the-lie-exposed) is the boss fight.