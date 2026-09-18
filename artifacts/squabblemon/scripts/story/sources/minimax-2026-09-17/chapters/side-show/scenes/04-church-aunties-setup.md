# SCENE — `side-show:church-aunties-setup`

> Standard battle. Church Auntie prepares the funeral. The
> public cover story is "for the community" (or for a
> neighborhood elder); the player is allowed to suspect but
> not yet know it's for Cracked Head. OG Uncle sits in the back
> row. This scene is the calm before the fake-funeral storm.

---

## 1. Stage

```yaml
parallaxSceneId: side-show:church-auntie:setup
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
  - id: og-uncle
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.18, y: 0.7 }                       # OG Uncle in the back pew
  - id: church-auntie
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.7, y: 0.55 }                      # Church Auntie at the altar
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
  - { x: 0.5, y: 0.5, zoom: 1.0, holdMs: 1800, ease: easeInOut }     # wide on the church
  - { x: 0.7, y: 0.55, zoom: 1.3, holdMs: 2400, ease: easeInOut }    # close on Church Auntie
  - { x: 0.18, y: 0.6, zoom: 1.15, holdMs: 2200, ease: easeInOut }   # cut to OG Uncle in the back row
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: side-show:church-aunties-setup:pre:0
    speaker: Church Auntie
    portraitAssetId: assets/characters/church-auntie.webp
    soundHook: story.church.hymn
    text: |
      Bless this house. We gather tonight for a member of
      our community — somebody's cousin, somebody's brother.
      We don't say the name. The Lord knows.
  - lineToken: side-show:church-aunties-setup:pre:1
    speaker: OG Uncle
    portraitAssetId: assets/characters/og-uncle.webp
    soundHook: story.pew.creak
    focusLayer: og-uncle
    text: |
      (From the back pew.) The Lord knows. The block knows.
      We don't say it out loud — not yet.
  - lineToken: side-show:church-aunties-setup:pre:2
    speaker: Church Auntie
    portraitAssetId: assets/characters/church-auntie.webp
    soundHook: story.church.amen
    text: |
      Whoever's sitting in this pew tonight — y'all came for
      somebody. The somebody's name is written in the
      receipts. Snitch has 'em. Find 'em.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: side-show:church-aunties-setup:pre:0, atMs: 0,    soundHook: story.church.hymn }
  - { lineToken: side-show:church-aunties-setup:pre:1, atMs: 2200, soundHook: story.pew.creak, focusLayerId: og-uncle }
  - { lineToken: side-show:church-aunties-setup:pre:2, atMs: 4000, soundHook: story.church.amen }
```

---

## 3. Battle

```yaml
battle:
  id: church-aunties-setup
  title: "Church Auntie's Setup"
  battleType: standard
  mapPosition: { x: 57, y: 42 }
  prerequisites: [the-scammers-pitch]
  optional: false
  enemy:
    name: Church Auntie
    portraitAssetId: assets/characters/church-auntie.webp
    behaviorProfile: balanced
    deck:
      - church-auntie
      - wifey
      - baby
      - snow
      - rastamon
      - plug
      - og-uncle
  cinematic:
    videoAssetId: assets/story/chapter-four/media/church-aunties-setup.mp4
    posterAssetId: assets/story/chapter-four/media/church-aunties-setup.webp
    environmentAssetId: assets/venues/church.webp
  modifiers:
    sanctuaryFlag: true              # FLAG: player is in the church now; the Scammer's interruption will trigger the mini-boss
  phases: []
  starObjectives:
    - { id: win,       description: Win the encounter. }
    - { id: districts, description: Hold all three districts. }
    - { id: squabble,  description: Win without using SQUABBLE. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 100 }
  teaching:
    tips:
      - "Church Auntie's deck runs heavy on support — counter with tempo."
      - "OG Uncle is sitting in the back pew. He's not speaking yet."
      - "Sanctuary flag is set — the Scammer will interrupt the next scene."
    focusMechanics: [tempo disruption, district denial]
    focusCards: [cornball, snow, church-auntie]
```

---

## 4. Drama notes

- **The setup:** "We don't say the name. The Lord knows" is the
  cover story. Per the season-arc drama call sheet: "Church
  Auntie officiates a fake funeral; it's not for Cracked Head.
  (It is.)" The public line is "for the community" — the
  private truth is Cracked Head.
- **OG Uncle's line:** "The Lord knows. The block knows. We
  don't say it out loud — not yet" is OG Uncle's confirmation
  that the funeral is real-for-Cracked-Head but not yet
  publicly named. He's sitting in the back pew, watching. He's
  not speaking yet.
- **The sanctuary flag:** `sanctuaryFlag: true` sets up the
  mini-boss (scene 06) — the Scammer interrupts the funeral,
  forcing the player to defend the real receipts.
- **The handoff:** "The somebody's name is written in the
  receipts. Snitch has 'em. Find 'em." is Church Auntie's
  redirect — she tells the player to go back to Snitch and
  verify the receipts. The boss fight (scene 07) is where
  Snitch reveals the truth.
- **The unlock:** Church Auntie is NOT unlocked here — she
  unlocks at the finale (scene 08). She's the chapter's heart,
  but the unlock is reserved for the reward ceremony.