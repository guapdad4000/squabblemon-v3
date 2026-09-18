# SCENE — `block-party:red-side-retaliation`

> Standard battle. Ganger Red escalates on his own turf. This is
> where Cracked Head is named for the first time as Red's brother.
> The player's path through this scene affects scene 06's Snitch
> modifier (clean win = Snitch's intel is dated; loss = Snitch's
> intel is fresh).

---

## 1. Stage

```yaml
parallaxSceneId: block-party:red-side:retaliation
venueId: red-side-court
mood: block
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
  - id: chain-link
    depth: 0.55
    parallaxX: 0.55
    parallaxY: 0.25
    widthFactor: 1.0
    anchor: { x: 0.5, y: 0.65 }
  - id: red-court-poster
    depth: 0.7
    parallaxX: 0.7
    parallaxY: 0.3
    widthFactor: 0.5
    anchor: { x: 0.78, y: 0.45 }
  - id: ganger-red
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.35, y: 0.62 }                       # Red centered, intense
  - id: wifey
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.5
    anchor: { x: 0.78, y: 0.66 }                       # Wifey watching from the corner
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
  - { x: 0.35, y: 0.55, zoom: 1.3, holdMs: 2400, ease: easeInOut }   # tight on Ganger Red
  - { x: 0.55, y: 0.6, zoom: 1.15, holdMs: 2200, ease: easeInOut }   # two-shot of Red + Wifey
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: block-party:red-side-retaliation:pre:0
    speaker: Ganger Red
    portraitAssetId: assets/characters/ganger-red.webp
    soundHook: story.crowd.ambience
    text: |
      You held the corner. You held the block. You held the
      camera. Now hold this.
  - lineToken: block-party:red-side-retaliation:pre:1
    speaker: Ganger Red
    portraitAssetId: assets/characters/ganger-red.webp
    soundHook: story.crowd.cheer
    focusLayer: ganger-red
    text: |
      My brother — the one everybody says is dead — he's alive.
      And somebody on this corner knows it.
  - lineToken: block-party:red-side-retaliation:pre:2
    speaker: Ganger Red
    portraitAssetId: assets/characters/ganger-red.webp
    soundHook: story.footstep
    text: |
      I'm not asking you to choose a side. I'm asking you to
      choose the truth. And the truth's in the tape.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: block-party:red-side-retaliation:pre:0, atMs: 0,    soundHook: story.crowd.ambience }
  - { lineToken: block-party:red-side-retaliation:pre:1, atMs: 1800, soundHook: story.crowd.cheer, focusLayerId: ganger-red }
  - { lineToken: block-party:red-side-retaliation:pre:2, atMs: 3600, soundHook: story.footstep }
```

---

## 3. Battle

```yaml
battle:
  id: red-side-retaliation
  title: "Red Side Retaliation"
  battleType: standard
  mapPosition: { x: 57, y: 42 }
  prerequisites: [receipts-on-camera]
  optional: false
  enemy:
    name: Ganger Red
    portraitAssetId: assets/characters/ganger-red.webp
    behaviorProfile: balanced
    deck:
      - ganger-red
      - roaster
      - snow
      - plug
      - snitch
      - baby
      - oink
  cinematic:
    videoAssetId: assets/story/chapter-one/media/red-side-retaliation.mp4
    posterAssetId: assets/story/chapter-one/media/red-side-retaliation.webp
    environmentAssetId: assets/venues/red-side-court.webp
  modifiers:
    redTape: true                  # flag for scene 06's Snitch disposition (fresh intel)
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
    - { kind: card, id: ganger-red, amount: 1 }   # Ganger Red card drops here; not a character unlock (he's a chapter 2 rival)
  teaching:
    tips:
      - "Red Side decks run heavy On-Reveal — counter with cheap tempo."
      - "Holding all three districts denies Red's anchor play."
      - "Red named his brother. The tape is real."
    focusMechanics: [district denial, On-Reveal disruption]
    focusCards: [cornball, snow, ganger-red]
```

---

## 4. Drama notes

- **The first name:** "My brother — the one everybody says is
  dead — he's alive" is the chapter's first on-the-record
  statement that Cracked Head is alive. It comes from Red, not
  from the tape. The player now has to choose: believe Red, or
  side-alley to find out more.
- **The path flag:** `redTape: true` carries through to scene 06.
  If the player also won scene 02 (`blueTape` from scene 02),
  Snitch's intel is dated and his +2 motion comes a turn late.
  If the player lost either, Snitch's intel is fresh and the +2
  motion hits at round 4 as scripted.
- **The Wifey cameo:** Wifey appears here for the first time in
  the season. She's watching from the corner. Her full
  introduction is in chapter 2 (where she unlocks as a rival).
- **The setup:** "The truth's in the tape" is the setup for the
  side-alley-challenge (scene 05), where the player can find the
  alley's tape — the same tape Snitch was watching.