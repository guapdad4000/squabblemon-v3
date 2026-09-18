# SCENE — `red-side-tapes:blue-side-defense`

> Standard battle. The player takes the tape to Ganger Blue. He
> denies. Wifey tries to mediate. The blue-side court feels
> smaller than red's — Wifey keeps it that way on purpose.

---

## 1. Stage

```yaml
parallaxSceneId: red-side-tapes:blue-side:defense
venueId: blue-side-court
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
  - id: chain-link
    depth: 0.4
    parallaxX: 0.4
    parallaxY: 0.2
    widthFactor: 1.0
    anchor: { x: 0.5, y: 0.65 }
  - id: barber-chair
    depth: 0.55
    parallaxX: 0.55
    parallaxY: 0.3
    widthFactor: 0.5
    anchor: { x: 0.2, y: 0.6 }                       # empty barber chair (Barber Bro is chapter 4)
  - id: blue-court-poster
    depth: 0.7
    parallaxX: 0.7
    parallaxY: 0.3
    widthFactor: 0.5
    anchor: { x: 0.78, y: 0.45 }                    # tattered Blue Side flyer on the wall
  - id: ganger-blue
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.35, y: 0.62 }                    # Ganger Blue, arms folded
  - id: wifey
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.5
    anchor: { x: 0.7, y: 0.66 }                     # Wifey standing between Blue and the player
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
  - { x: 0.35, y: 0.55, zoom: 1.25, holdMs: 2400, ease: easeInOut }   # close on Ganger Blue
  - { x: 0.55, y: 0.6, zoom: 1.15, holdMs: 2200, ease: easeInOut }    # two-shot of Blue + Wifey
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: red-side-tapes:blue-side-defense:pre:0
    speaker: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    soundHook: story.crowd.ambience
    text: |
      Red's been holding that tape for four years. You know why
      he held it? Because it's a setup. He's been waiting for the
      right moment to drop it on me.
  - lineToken: red-side-tapes:blue-side-defense:pre:1
    speaker: Wifey
    portraitAssetId: assets/characters/wifey.webp
    soundHook: story.door.close
    focusLayer: wifey
    text: |
      Blue. Baby. Both of you. We can talk about this at the
      table like grown folks, or we can do it on the corner.
      Your call.
  - lineToken: red-side-tapes:blue-side-defense:pre:2
    speaker: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    soundHook: story.crowd.cheer
    text: |
      There's nothing to talk about. Whoever's on that tape made
      a choice four years ago. I made mine. I'm not the one who's
      lying.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: red-side-tapes:blue-side-defense:pre:0, atMs: 0,    soundHook: story.crowd.ambience }
  - { lineToken: red-side-tapes:blue-side-defense:pre:1, atMs: 2000, soundHook: story.door.close, focusLayerId: wifey }
  - { lineToken: red-side-tapes:blue-side-defense:pre:2, atMs: 3600, soundHook: story.crowd.cheer }
```

---

## 3. Battle

```yaml
battle:
  id: blue-side-defense
  title: "Blue Side Defense"
  battleType: standard
  mapPosition: { x: 40, y: 54 }
  prerequisites: [red-side-testimony]
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
      - snitch
      - wifey
      - oink
  cinematic:
    videoAssetId: assets/story/chapter-two/media/blue-side-defense.mp4
    posterAssetId: assets/story/chapter-two/media/blue-side-defense.webp
    environmentAssetId: assets/venues/blue-side-court.webp
  modifiers:
    tapeReveal: blue-tape             # flag the player's path as Blue-Side for wifeys-verdict disposition
  phases: []
  starObjectives:
    - { id: win,       description: Win the encounter. }
    - { id: districts, description: Finish holding all three districts. }
    - { id: squabble,  description: Win without using SQUABBLE. }
  recommendedCollection:
    - cornball
    - snow
    - rastamon
  rewards:
    - { kind: currency, id: street-xp, amount: 75 }
    # NOTE: Ganger Blue was already unlocked in chapter 1. No unlock here.
    #       Wifey unlocks at finale (tape-returned).
  teaching:
    tips:
      - "Blue Side decks run heavy on Motion — counter with On-Reveal."
      - "Holding all three districts denies the Blue Side's anchor play."
    focusMechanics: [district denial, On-Reveal timing]
    focusCards: [cornball, snow, wifey]
```

---

## 4. Drama notes

- **The alt-side rival:** Ganger Blue is the alt-side rival for the
  chapter. He's already unlocked from chapter 1, so no unlock here.
  The drama is that he appeared in chapter 1 as a tester and now
  shows up as a defender. The player's familiarity with him pays off
  in the line reads.
- **The path flag:** This scene sets the `tapeReveal: blue-tape`
  modifier. Together with the red-tape flag from
  `red-side-testimony`, the engine tracks which sides the player
  has seen. Both clean wins = Wifey sides with the player in
  `wifeys-verdict`. Either loss = Wifey judges against.
- **The Wifey setup:** Wifey's "We can talk about this at the table
  like grown folks" is a setup for `wifeys-verdict`, where she
  forces the player to make a commitment. She's been waiting for
  this scene since she first appeared in chapter 1.