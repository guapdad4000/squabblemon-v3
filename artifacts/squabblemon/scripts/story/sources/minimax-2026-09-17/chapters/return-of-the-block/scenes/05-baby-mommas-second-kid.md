# SCENE — `return-of-the-block:baby-mommas-second-kid`

> Optional mastery match. Baby Momma reveals the second kid is
> on the way. Per the resolved-decision log, the second child
> is canonical by chapter 7. The mastery carries into the
> boss fight (scene 07): a family-presence buff that gives
> the player +1 power when the lie is exposed.

---

## 1. Stage

```yaml
parallaxSceneId: return-of-the-block:baby-momma:second-kid
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
  - id: baby-momma
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.7, y: 0.62 }                       # Baby Momma, pregnant, in the alley
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
  - { x: 0.7, y: 0.55, zoom: 1.3, holdMs: 2400, ease: easeInOut }    # tight on Baby Momma
  - { x: 0.4, y: 0.6, zoom: 1.1, holdMs: 2200, ease: easeInOut }     # pull back to show the alley
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: return-of-the-block:baby-mommas-second-kid:pre:0
    speaker: Baby Momma
    portraitAssetId: assets/characters/baby-momma.webp
    soundHook: story.alley.footsteps
    text: |
      Yo — you came to the alley for the news. Good. I'ma
      tell it to you first. There's another one on the way.
  - lineToken: return-of-the-block:baby-mommas-second-kid:pre:1
    speaker: Baby Momma
    portraitAssetId: assets/characters/baby-momma.webp
    soundHook: story.card.shuffle
    focusLayer: baby-momma
    text: |
      (Hand on her belly.) Cracked Head's second kid. Same
      block, same blood. The kid Blue's gonna hold the
      corner for — the kid after that one.
  - lineToken: return-of-the-block:baby-mommas-second-kid:pre:2
    speaker: Baby Momma
    portraitAssetId: assets/characters/baby-momma.webp
    soundHook: story.crowd.cheer
    text: |
      Beat me clean and your deck carries +1 power into
      the verdict. Cracked Head's coming home to a family —
      not just a block.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: return-of-the-block:baby-mommas-second-kid:pre:0, atMs: 0,    soundHook: story.alley.footsteps }
  - { lineToken: return-of-the-block:baby-mommas-second-kid:pre:1, atMs: 1800, soundHook: story.card.shuffle, focusLayerId: baby-momma }
  - { lineToken: return-of-the-block:baby-mommas-second-kid:pre:2, atMs: 3600, soundHook: story.crowd.cheer }
```

---

## 3. Battle

```yaml
battle:
  id: baby-mommas-second-kid
  title: "Baby Momma's Second Kid"
  battleType: standard
  mapPosition: { x: 52, y: 76 }
  prerequisites: [snitchs-roll-call]
  optional: true                            # optional mastery match
  enemy:
    name: Baby Momma
    portraitAssetId: assets/characters/baby-momma.webp
    behaviorProfile: balanced
    deck:
      - baby-momma
      - the-kid                            # placeholder — the second kid card
      - snow
      - rastamon
      - plug
      - wifey
      - og-uncle
  cinematic:
    videoAssetId: assets/story/chapter-seven/media/baby-mommas-second-kid.mp4
    posterAssetId: assets/story/chapter-seven/media/baby-mommas-second-kid.webp
    environmentAssetId: assets/venues/alley.webp
  modifiers:
    familyPresence: true                 # FLAG: winning clean grants +1 power buff in boss fight
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
    - { kind: card, id: the-kid, amount: 1 }   # the second-kid card drops; not a character unlock (Baby Momma already unlocked in Ch5)
  teaching:
    tips:
      - "Win this clean and your deck gets +1 power in the lie-exposed fight."
      - "The kid is on the way — canonical per the season arc's resolved-decision log."
      - "Family-presence buff carries — the family is the chapter's spine."
    focusMechanics: [family presence buff, alley tempo, district denial]
    focusCards: [cornball, snow, baby-momma]
```

---

## 4. Drama notes

- **The second kid:** Per the resolved-decision log, "Baby
  Momma is Cracked Head's ex. She has one child by him at the
  start of season 1 (toddler, off-screen), and a second on
  the way by chapter 7." Scene 05 confirms the second kid
  canonically.
- **The mastery:** `familyPresence: true` is the chapter's
  mastery buff. Winning clean grants +1 power in the boss
  fight (scene 07). The family is the chapter's spine.
- **The card drop:** `the-kid` card drops here (already
  unlocked at Ch5's finale, but this scene grants the card
  to the player's collection).
- **The setup:** Scene 06 (wheelchair-og) is OG Uncle in the
  wheelchair. Scene 07 (the-lie-exposed) is the boss fight.
  The second kid is the chapter's hope — the block's
  future.