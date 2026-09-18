# SCENE — `red-side-tapes:red-side-testimony`

> Standard battle. The player takes the tape to Ganger Red. He lays
> out what his side saw on the night Cracked Head "died." This is
> the player's first proper meeting with Ganger Red — he unlocks
> here as the lead rival of the chapter.

---

## 1. Stage

```yaml
parallaxSceneId: red-side-tapes:red-side:testimony
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
    anchor: { x: 0.15, y: 0.45 }                    # tattered Red Side flyer on the wall
  - id: ganger-red
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.7, y: 0.62 }                     # close on Ganger Red
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
  - { x: 0.7, y: 0.55, zoom: 1.25, holdMs: 2400, ease: easeInOut }   # close on Ganger Red
  - { x: 0.3, y: 0.6, zoom: 1.1, holdMs: 2200, ease: easeInOut }     # pull back to show the Red Side flyer
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: red-side-tapes:red-side-testimony:pre:0
    speaker: Ganger Red
    portraitAssetId: assets/characters/ganger-red.webp
    soundHook: story.tape.play
    text: |
      I been holding this tape for four years. Watch what happens
      at one-fourteen. That's the corner. That's the night.
  - lineToken: red-side-tapes:red-side-testimony:pre:1
    speaker: Ganger Red
    portraitAssetId: assets/characters/ganger-red.webp
    soundHook: story.tape.scrub
    focusLayer: ganger-red
    text: |
      You see that? That's my brother. That's who Cracked Head
      was protecting when he "died." Nobody came to tell me.
  - lineToken: red-side-tapes:red-side-testimony:pre:2
    speaker: Ganger Red
    portraitAssetId: assets/characters/ganger-red.webp
    soundHook: story.crowd.ambience
    text: |
      I'm not asking you to choose a side. I'm asking you to choose
      a tape. There are two. Only one of them is real.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: red-side-tapes:red-side-testimony:pre:0, atMs: 0,    soundHook: story.tape.play }
  - { lineToken: red-side-tapes:red-side-testimony:pre:1, atMs: 1800, soundHook: story.tape.scrub, focusLayerId: ganger-red }
  - { lineToken: red-side-tapes:red-side-testimony:pre:2, atMs: 3600, soundHook: story.crowd.ambience }
```

---

## 3. Battle

```yaml
battle:
  id: red-side-testimony
  title: "Red Side Testimony"
  battleType: standard
  mapPosition: { x: 23, y: 62 }
  prerequisites: [the-tape-drops]
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
    videoAssetId: assets/story/chapter-two/media/red-side-testimony.mp4
    posterAssetId: assets/story/chapter-two/media/red-side-testimony.webp
    environmentAssetId: assets/venues/red-side-court.webp
  modifiers:
    tapeReveal: red-tape              # flag the player's path as Red-Side for wifeys-verdict disposition
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
    - { kind: character-unlock, id: ganger-red, amount: 1 }   # first proper meeting, Ganger Red unlocks as the lead rival
  teaching:
    tips:
      - "Red Side decks play slow — punish with Motion."
      - "Holding all three districts denies the Red Side On-Reveal."
    focusMechanics: [district denial, Motion]
    focusCards: [cornball, snow, ganger-red]
```

---

## 4. Drama notes

- **The lead rival:** Ganger Red unlocks here as a playable rival
  portrait. He's the "Red Side" answer to chapter 1's Ganger Blue —
  same archetype (lieutenant holding territory), different flavor
  (tired instead of testing).
- **The path flag:** This scene sets the `tapeReveal: red-tape`
  modifier. The engine reads it in `wifeys-verdict` to determine
  Wifey's disposition toward the player. If the player also wins
  `blue-side-defense` clean, both flags are set and Wifey sides
  with the player. If the player lost either, Wifey judges against.
- **The setup:** Ganger Red's "There are two. Only one of them is
  real." line is a setup for `the-watch-party` (scene 04), where
  both tapes play publicly. The player will learn which one is
  actually real — the answer is: neither tape is complete. Both
  sides are lying about something.