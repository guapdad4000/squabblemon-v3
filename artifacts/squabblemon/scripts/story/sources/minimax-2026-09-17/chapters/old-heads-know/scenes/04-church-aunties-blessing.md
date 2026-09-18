# SCENE — `old-heads-know:church-aunties-blessing`

> Rule-twist battle. Church Auntie prepares to bless the truth.
> The wider block gathers — Red is the witness, Baby Momma is
> the heart, Wifey stands by Blue. The twist: the player's
> deck is opened — both players see each other's hands — and
> the receipts are on the table. Verification meets blessing.

---

## 1. Stage

```yaml
parallaxSceneId: old-heads-know:church-auntie:blessing
venueId: church
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
  - id: ganger-red
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.18, y: 0.7 }                       # Red in the back pew, the witness
  - id: baby-momma
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.32, y: 0.7 }                       # Baby Momma beside Red, the heart
  - id: church-auntie
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.7, y: 0.55 }                       # Church Auntie at the altar
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
  - { x: 0.7, y: 0.55, zoom: 1.3, holdMs: 2400, ease: easeInOut }    # close on Church Auntie
  - { x: 0.5, y: 0.65, zoom: 1.15, holdMs: 2200, ease: easeInOut }    # pull back to show the pews
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: old-heads-know:church-aunties-blessing:pre:0
    speaker: Church Auntie
    portraitAssetId: assets/characters/church-auntie.webp
    soundHook: story.church.hymn
    text: |
      Bless this house. Bless the truth. The body's in the
      witness box. The kid is in the family. The receipts
      are on the table. We bless it all.
  - lineToken: old-heads-know:church-aunties-blessing:pre:1
    speaker: Ganger Red
    portraitAssetId: assets/characters/ganger-red.webp
    soundHook: story.pew.creak
    focusLayer: ganger-red
    text: |
      (From the back pew.) I been holding this tape for four
      years. Tonight the block blessed it. Witnesses in.
  - lineToken: old-heads-know:church-aunties-blessing:pre:2
    speaker: Church Auntie
    portraitAssetId: assets/characters/church-auntie.webp
    soundHook: story.church.amen
    text: |
      Whoever's sitting in this pew tonight — y'all came for
      somebody. The somebody has a name. The somebody is
      alive. The somebody's coming home.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: old-heads-know:church-aunties-blessing:pre:0, atMs: 0,    soundHook: story.church.hymn }
  - { lineToken: old-heads-know:church-aunties-blessing:pre:1, atMs: 2000, soundHook: story.pew.creak, focusLayerId: ganger-red }
  - { lineToken: old-heads-know:church-aunties-blessing:pre:2, atMs: 4000, soundHook: story.church.amen }
```

---

## 3. Battle

```yaml
battle:
  id: church-aunties-blessing
  title: "Church Auntie's Blessing"
  battleType: rule-twist
  mapPosition: { x: 57, y: 42 }
  prerequisites: [wifeys-stand]
  optional: false
  enemy:
    name: Church Auntie
    portraitAssetId: assets/characters/church-auntie.webp
    behaviorProfile: balanced
    deck:
      - church-auntie
      - wifey
      - baby-momma
      - og-uncle
      - snow
      - rastamon
      - plug
  cinematic:
    videoAssetId: assets/story/chapter-five/media/church-aunties-blessing.mp4
    posterAssetId: assets/story/chapter-five/media/church-aunties-blessing.webp
    environmentAssetId: assets/venues/church.webp
  modifiers:
    openHands: true                  # THE TWIST: both players see each other's hands
    familyCouncil: true              # carries over — family cards stay in play
    blessingMode: true               # the truth is on the table
  phases: []
  starObjectives:
    - { id: win,       description: Win the encounter. }
    - { id: districts, description: Hold all three districts while the blessing lands. }
    - { id: bless,     description: Win without playing any non-family cards. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 100 }
  teaching:
    tips:
      - "Open hands means the truth is on the table — verification is automatic."
      - "Family-council mode carries — keep all family cards in play."
      - "Blessing mode: win without playing non-family cards (third star)."
    focusMechanics: [open hands reading, family council, blessing mode]
    focusCards: [cornball, snow, church-auntie]
```

---

## 4. Drama notes

- **The rule twist:** `openHands: true` is the chapter's
  rule twist, but combined with `familyCouncil: true` and
  `blessingMode: true` — verification, family, and blessing
  all together. The receipts are on the table. The truth
  is visible.
- **The wider block:** Red is the witness (he's been holding
  the receipts since Ch2). Baby Momma is the heart. Wifey
  stands by Blue (scene 03 committed). The church is full.
- **The setup:** "The somebody has a name. The somebody is
  alive. The somebody's coming home" is the chapter's handoff.
  Cracked Head is alive. He's been in witness protection. He's
  coming home. Scene 06 (Hooper closes) is the side-show
  antagonist trying to disrupt this; scene 07 (OG Uncle's
  verdict) is the formal reckoning.
- **The third star:** "Win without playing any non-family
  cards" forces the player to commit to the family. If they
  play a non-family card, they failed — the truth requires
  family-only hands.