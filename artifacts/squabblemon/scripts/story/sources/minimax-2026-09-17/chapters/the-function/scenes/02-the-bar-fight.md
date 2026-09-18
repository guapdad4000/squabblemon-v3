# SCENE — `the-function:bar-fight`

> Standard battle. A fight breaks out at the function. Bottle
> Girl runs the bar AND the bouncer. She's a corner boss in
> her own right — the function mechanic carries over.

---

## 1. Stage

```yaml
parallaxSceneId: the-function:bar-fight:melee
venueId: function-venue
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
  - id: venue-wall
    depth: 0.3
    parallaxX: 0.25
    parallaxY: 0.15
    widthFactor: 1.2
    anchor: { x: 0.5, y: 0.55 }
  - id: bar
    depth: 0.55
    parallaxX: 0.5
    parallaxY: 0.25
    widthFactor: 1.0
    anchor: { x: 0.5, y: 0.6 }
  - id: bottle-girl
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.5, y: 0.55 }                        # Bottle Girl, bouncer mode
  - id: alley-runner
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.18, y: 0.7 }                       # Alley Runner in the corner, watching
  - id: baby-momma
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.82, y: 0.7 }                       # Baby Momma, pregnant, watching
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
  - { x: 0.5, y: 0.55, zoom: 1.35, holdMs: 2400, ease: easeInOut }   # tight on Bottle Girl
  - { x: 0.5, y: 0.6, zoom: 1.15, holdMs: 2200, ease: easeInOut }    # pull back to show the brawl
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: the-function:bar-fight:pre:0
    speaker: Bottle Girl
    portraitAssetId: assets/characters/bottle-girl.webp
    soundHook: story.bar.bottles-break
    text: |
      (Bottle Girl vaults the bar.) Alright — who started
      it? Whoever started it gets bounced. I'm running this
      function — that includes the fights.
  - lineToken: the-function:bar-fight:pre:1
    speaker: Alley Runner
    portraitAssetId: assets/characters/alley-runner.webp
    soundHook: story.crowd.ambience
    focusLayer: alley-runner
    text: |
      (From the corner.) I didn't start it. I was just
      standing there. Ask the alley — ask the function.
  - lineToken: the-function:bar-fight:pre:2
    speaker: Bottle Girl
    portraitAssetId: assets/characters/bottle-girl.webp
    soundHook: story.crowd.cheer
    text: |
      Beat me first. Then we figure out who started it.
      Then we get back to the function.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: the-function:bar-fight:pre:0, atMs: 0,    soundHook: story.bar.bottles-break }
  - { lineToken: the-function:bar-fight:pre:1, atMs: 2000, soundHook: story.crowd.ambience, focusLayerId: alley-runner }
  - { lineToken: the-function:bar-fight:pre:2, atMs: 3800, soundHook: story.crowd.cheer }
```

---

## 3. Battle

```yaml
battle:
  id: the-bar-fight
  title: "The Bar Fight"
  battleType: standard
  mapPosition: { x: 50, y: 45 }
  prerequisites: [the-function]
  optional: false
  enemy:
    name: Bottle Girl
    portraitAssetId: assets/characters/bottle-girl.webp
    behaviorProfile: balanced
    deck:
      - bottle-girl
      - alley-runner
      - cornball
      - snow
      - rastamon
      - plug
      - snitch
  cinematic:
    videoAssetId: assets/story/chapter-six/media/bar-fight.mp4
    posterAssetId: assets/story/chapter-six/media/bar-fight.webp
    environmentAssetId: assets/venues/function-venue.webp
  modifiers:
    functionMode: true                # carries over from scene 01
    barFightToss: true                # FLAG: cards get knocked off tables — both players discard a card each turn
  phases: []
  starObjectives:
    - { id: win,       description: Win the encounter. }
    - { id: districts, description: Hold all three districts while the bar fight rages. }
    - { id: squabble,  description: Win without using SQUABBLE. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 100 }
  teaching:
    tips:
      - "Bar-fight toss means both players discard a card each turn — play around it."
      - "Function mode carries — don't exile any cameo character."
      - "Hold all three districts while the brawl settles."
    focusMechanics: [function mode, bar fight discard, district denial]
    focusCards: [cornball, snow, bottle-girl]
```

---

## 4. Drama notes

- **The bar mechanic:** `barFightToss: true` is the chapter's
  bar-fight twist. Both players discard a card each turn —
  cards get knocked off tables. The player has to play around
  the discard pressure.
- **Bottle Girl's role:** She runs the bar AND the bouncer.
  Per the season arc character list: "Bottle Girl — runs the
  function. Chapter 6." She's a corner boss in her own right.
  Her unlock at the finale is the chapter's character-unlock
  beat.
- **Alley Runner cameo:** "I was just standing there" is the
  recurring cameo's alibi. He's in every chapter — Ch6's
  bar fight is his turn.
- **Baby Momma's presence:** Pregnant, watching. Per the
  resolved-decision log, the second child is on the way by
  Ch7. She's visible here as a setup.
- **The setup:** Scene 03 (the-booking) is Promoter setting
  up the return fight. Cracked Head's entrance is the finale.