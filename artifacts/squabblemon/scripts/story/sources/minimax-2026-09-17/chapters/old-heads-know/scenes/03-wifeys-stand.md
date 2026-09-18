# SCENE — `old-heads-know:wifeys-stand`

> Standard battle. Wifey stands by Blue during the bombshell.
> Per the drama call sheet: "Wifey stands by Blue." She's not
> leaving. The player has to win this scene clean to keep her
> committed — losing it triggers the loss-path flavor at the
> finale.

---

## 1. Stage

```yaml
parallaxSceneId: old-heads-know:wifey:stand
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
  - id: ganger-blue
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.32, y: 0.7 }                       # Blue grieving
  - id: wifey
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.5, y: 0.6 }                        # Wifey standing beside Blue
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
  - { x: 0.5, y: 0.6, zoom: 1.35, holdMs: 2800, ease: easeInOut }   # two-shot of Blue + Wifey
  - { x: 0.32, y: 0.6, zoom: 1.2, holdMs: 1200, ease: easeInOut }   # tight on Blue's grief
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: old-heads-know:wifeys-stand:pre:0
    speaker: Wifey
    portraitAssetId: assets/characters/wifey.webp
    soundHook: story.door.close
    text: |
      Blue. I'm here. Whatever he is — grieving, angry,
      broken — I'm here. I stand by you.
  - lineToken: old-heads-know:wifeys-stand:pre:1
    speaker: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    soundHook: story.crowd.ambience
    focusLayer: ganger-blue
    text: |
      (Quietly.) I held this block for him. I held it for
      nobody. Now I'ma hold it for the kid. That's what I'ma
      do.
  - lineToken: old-heads-know:wifeys-stand:pre:2
    speaker: Wifey
    portraitAssetId: assets/characters/wifey.webp
    soundHook: story.crowd.cheer
    text: |
      Then we hold it together. The kid, the block, the
      receipts, the truth. Whatever comes next — we hold it
      together.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: old-heads-know:wifeys-stand:pre:0, atMs: 0,    soundHook: story.door.close }
  - { lineToken: old-heads-know:wifeys-stand:pre:1, atMs: 2200, soundHook: story.crowd.ambience, focusLayerId: ganger-blue }
  - { lineToken: old-heads-know:wifeys-stand:pre:2, atMs: 4200, soundHook: story.crowd.cheer }
```

---

## 3. Battle

```yaml
battle:
  id: wifeys-stand
  title: "Wifey's Stand"
  battleType: standard
  mapPosition: { x: 40, y: 54 }
  prerequisites: [baby-mommas-truth]
  optional: false
  enemy:
    name: Wifey
    portraitAssetId: assets/characters/wifey.webp
    behaviorProfile: balanced
    deck:
      - wifey
      - ganger-blue                            # Blue is in Wifey's deck — they fight together
      - snow
      - rastamon
      - plug
      - baby-momma
      - og-uncle
  cinematic:
    videoAssetId: assets/story/chapter-five/media/wifeys-stand.mp4
    posterAssetId: assets/story/chapter-five/media/wifeys-stand.webp
    environmentAssetId: assets/venues/hospital-room.webp
  modifiers:
    familyCouncil: true                  # carries over
    wifeyStands: true                    # FLAG: Wifey commits to Blue — clean win locks it in
  phases: []
  starObjectives:
    - { id: win,       description: Win the encounter. }
    - { id: districts, description: Hold all three districts while Wifey stands. }
    - { id: ally,      description: Win while Wifey's ally buff is active. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 100 }
  teaching:
    tips:
      - "Wifey's deck has Blue in it — they're a unit. Counter the pair, not the individual."
      - "Win this clean and Wifey's commitment locks in (carry to finale)."
      - "Family-council mode carries — keep everyone's cards in play."
    focusMechanics: [family council mode, ally tempo, district denial]
    focusCards: [cornball, snow, wifey]
```

---

## 4. Drama notes

- **Wifey's commitment:** "Whatever he is — grieving, angry,
  broken — I'm here. I stand by you." is Wifey's stand. She
  commits to the marriage through whatever comes next. The
  player has to win this clean to lock in her commitment.
- **Blue's grief to purpose:** "I held this block for him. I
  held it for nobody. Now I'ma hold it for the kid." is
  Blue's transition from grief to purpose. He's no longer
  holding the block for a ghost — he's holding it for his
  nephew. The block has a future now.
- **The setup:** "Whatever comes next — we hold it together"
  is the chapter's emotional spine. The player has won the
  family council. Scene 04 (church-auntie's blessing) is the
  public blessing of this commitment.
- **The flag:** `wifeyStands: true` carries to the finale.
  If the player wins this clean, Wifey joins the family
  council in the finale's flavor text. If the player loses,
  Wifey is "still deciding" — loss-path flavor.
- **The pair deck:** Wifey's deck includes `ganger-blue` —
  they're a unit. The mechanics reinforce the drama.