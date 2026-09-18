# SCENE — `old-heads-know:hooper-closes`

> Mini-boss battle. Hooper — the Old Heads vs Side Show closer
> — interrupts the family council. He's the side-show
> antagonist who tries to disrupt the blessing. The player
> has to push him out of the church.

---

## 1. Stage

```yaml
parallaxSceneId: old-heads-know:hooper:closes
venueId: church
mood: dusk
durationMs: 7200
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
  - id: hooper
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.6
    anchor: { x: 0.78, y: 0.6 }                       # Hooper at the church door, disrupting
  - id: church-auntie
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.5
    anchor: { x: 0.32, y: 0.55 }                      # Church Auntie at the altar, holding the line
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
  - { x: 0.78, y: 0.55, zoom: 1.3, holdMs: 2400, ease: easeInOut }    # tight on Hooper at the door
  - { x: 0.5, y: 0.55, zoom: 1.15, holdMs: 2200, ease: easeInOut }    # settle on the altar
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: old-heads-know:hooper-closes:pre:0
    speaker: Hooper
    portraitAssetId: assets/characters/hooper.webp
    soundHook: story.church.door-slam
    text: |
      Hold up — the old heads done blessed the truth, but
      the side show don't agree. We got our own receipts.
      We got our own story.
  - lineToken: old-heads-know:hooper-closes:pre:1
    speaker: Church Auntie
    portraitAssetId: assets/characters/church-auntie.webp
    soundHook: story.church.hymn
    focusLayer: church-auntie
    text: |
      You don't come into this house with that. Whatever
      side show you're running — it ain't the Lord. It
      ain't the family. Sit down or leave.
  - lineToken: old-heads-know:hooper-closes:pre:2
    speaker: Hooper
    portraitAssetId: assets/characters/hooper.webp
    soundHook: story.crowd.cheer
    text: |
      I'm not sitting down. The old heads blessed a lie.
      Cracked Head ain't alive — he's in the ground, and the
      receipts say so.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: old-heads-know:hooper-closes:pre:0, atMs: 0,    soundHook: story.church.door-slam }
  - { lineToken: old-heads-know:hooper-closes:pre:1, atMs: 2000, soundHook: story.church.hymn, focusLayerId: church-auntie }
  - { lineToken: old-heads-know:hooper-closes:pre:2, atMs: 4000, soundHook: story.crowd.cheer }
```

---

## 3. Battle

```yaml
battle:
  id: hooper-closes
  title: "Hooper Closes"
  battleType: mini-boss
  mapPosition: { x: 72, y: 31 }
  prerequisites: [church-aunties-blessing]
  optional: false
  enemy:
    name: Hooper
    portraitAssetId: assets/characters/hooper.webp
    behaviorProfile: balanced
    deck:
      - hooper
      - plug
      - baby
      - oink
      - cornball
      - snow
      - wifey
  cinematic:
    videoAssetId: assets/story/chapter-five/media/hooper-closes.mp4
    posterAssetId: assets/story/chapter-five/media/hooper-closes.webp
    environmentAssetId: assets/venues/church.webp
  modifiers:
    sideShowDisrupt: true             # the side show is disrupting the blessing
    familyCouncil: true              # carries over
    hooperLies: true                 # FLAG: Hooper's deck has cards that claim Cracked Head is dead — counter with verification
  phases: []
  starObjectives:
    - { id: win,       description: Win the encounter. }
    - { id: districts, description: Hold all three districts while Hooper disrupts. }
    - { id: evict,     description: Push Hooper out of the church without playing his lie cards. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 125 }
    # NOTE: Mini-bosses don't unlock characters. Baby Momma unlocks at finale.
  teaching:
    tips:
      - "Hooper's deck has lie cards — they claim Cracked Head is dead. Don't play them."
      - "Family-council mode carries — keep all family cards in play."
      - "Push Hooper out of the church — your job is the blessing, not the fight."
    focusMechanics: [family council mode, lie detection, eviction tempo]
    focusCards: [cornball, snow, hooper]
```

---

## 4. Drama notes

- **The mini-boss:** Hooper is the chapter's antagonist. Per
  the season arc character list: "Hooper — chapter 5 closer.
  Old Heads vs Side Show." He's the side-show disruption.
- **The lie mechanic:** `hooperLies: true` is the chapter's
  mini-boss mechanic. Hooper's deck has cards that claim
  Cracked Head is dead. The player has to verify and not
  play the lies. The mechanic is similar to Ch4's
  `fakeWatermark` ( Scammer's fakes).
- **The setup:** Scene 07 (OG Uncle's verdict) is the formal
  reckoning. OG Uncle tests the player with the truth. The
  mini-boss (Hooper) is the side-show disruption that has to
  be cleared before the verdict.
- **The third star:** "Push Hooper out of the church without
  playing his lie cards" is the player's test. If they
  played a lie, they failed. The verdict depends on this —
  the player who can spot lies can win the boss clean.
- **The flag:** `hooperLies: true` carries to the boss fight.
  If the player fails here, Hooper's lies echo into the
  verdict — the boss fight is harder.