# SCENE — `old-heads-know:the-old-heads-convene`

> Opening battle of Chapter 5. The Old Heads — OG Uncle, Church
> Auntie, the corner-store elders — gather at OG Uncle's bedside.
> The wider family arrives: Blue, Wifey, Baby Momma, Red.
> Cornball is at the door with snacks. This is a guided battle
> that frames the chapter's "family council" mechanic.

---

## 1. Stage

```yaml
parallaxSceneId: old-heads-know:og-uncle:family-council
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
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.6
    anchor: { x: 0.5, y: 0.55 }                       # OG Uncle in the bed, propped up
  - id: ganger-blue
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.18, y: 0.7 }                        # Blue at the bedside, sitting
  - id: wifey
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.32, y: 0.7 }                        # Wifey beside Blue
  - id: baby-momma
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.78, y: 0.7 }                        # Baby Momma at the foot of the bed
  - id: cornball
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.4
    anchor: { x: 0.85, y: 0.85 }                       # Cornball at the door with snacks
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
  - { x: 0.5, y: 0.55, zoom: 1.3, holdMs: 2400, ease: easeInOut }    # close on OG Uncle
  - { x: 0.5, y: 0.65, zoom: 1.1, holdMs: 2200, ease: easeInOut }    # pull back to show the family
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: old-heads-know:old-heads-convene:pre:0
    speaker: OG Uncle
    portraitAssetId: assets/characters/og-uncle.webp
    soundHook: story.hospital.monitor
    text: |
      Y'all came. All of you. Even the ones I told not to
      come. That's the family — you come when you called, and
      you don't ask why.
  - lineToken: old-heads-know:old-heads-convene:pre:1
    speaker: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    soundHook: story.pew.creak
    text: |
      (Softly.) I been holding this block for him for four
      years. I thought he was dead. You told me he was dead.
  - lineToken: old-heads-know:old-heads-convene:pre:2
    speaker: OG Uncle
    portraitAssetId: assets/characters/og-uncle.webp
    soundHook: story.card.flip
    focusLayer: og-uncle
    text: |
      I told you what I had to tell you. Tonight I tell you
      the rest. The kid. The receipts. The block. Sit down.
      Baby Momma's gonna speak first.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: old-heads-know:old-heads-convene:pre:0, atMs: 0,    soundHook: story.hospital.monitor }
  - { lineToken: old-heads-know:old-heads-convene:pre:1, atMs: 2000, soundHook: story.pew.creak }
  - { lineToken: old-heads-know:old-heads-convene:pre:2, atMs: 4000, soundHook: story.card.flip, focusLayerId: og-uncle }
```

---

## 3. Battle

```yaml
battle:
  id: the-old-heads-convene
  title: "The Old Heads Convene"
  battleType: guided
  mapPosition: { x: 8, y: 76 }
  prerequisites: []
  optional: false
  enemy:
    name: OG Uncle
    portraitAssetId: assets/characters/og-uncle.webp
    behaviorProfile: balanced
    deck:
      - og-uncle
      - wifey
      - baby-momma
      - snow
      - rastamon
      - plug
      - church-auntie
  cinematic:
    videoAssetId: assets/story/chapter-five/media/old-heads-convene.mp4
    posterAssetId: assets/story/chapter-five/media/old-heads-convene.webp
    environmentAssetId: assets/venues/hospital-room.webp
  modifiers:
    familyCouncil: true              # FLAG: family-council mode — both players' hands are open
    handSizeBonus: 1                 # the receipts give the player one extra card in opening hand
  phases: []
  starObjectives:
    - { id: win,       description: Win the encounter. }
    - { id: districts, description: Hold all three districts while the family gathers. }
    - { id: council,   description: Win while keeping all family members' cards in play. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 50 }
    # NOTE: OG Uncle was already unlocked in chapter 3. No unlock here.
    #       Baby Momma unlocks at finale (the-family-blessed).
  teaching:
    tips:
      - "Family-council mode means everyone's cards stay in play — don't exile any."
      - "Hold all three districts while the family gathers — the truth needs space."
      - "Baby Momma speaks next. The kid bombshell is in scene 02."
    focusMechanics: [family council mode, hand size bonus, district scoring]
    focusCards: [cornball, snow, og-uncle]
```

---

## 4. Drama notes

- **The chapter mechanic:** `familyCouncil: true` is the
  chapter's signature. All family cards stay in play — the
  player can't exile any. The third-star objective enforces
  this. The family has to hold together for the truth to land.
- **OG Uncle's setup:** "Tonight I tell you the rest. The kid.
  The receipts. The block." is OG Uncle's preview. He's
  orchestrating the reveal order: Baby Momma first (the kid),
  then OG Uncle (the receipts), then the block (the future).
- **Blue's grief:** "I thought he was dead. You told me he was
  dead" is Blue's continuing grief. Per the resolved-decision
  log, Blue discovered the witness-protection arrangement
  after the fact. OG Uncle didn't tell him.
- **The Cornball cameo:** Cornball at the door with snacks.
  Comic relief — he doesn't speak.
- **The setup:** Scene 02 is Baby Momma's truth. The kid
  bombshell drops.