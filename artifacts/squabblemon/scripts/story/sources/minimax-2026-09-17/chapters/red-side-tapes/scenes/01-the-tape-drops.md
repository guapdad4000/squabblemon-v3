# SCENE — `red-side-tapes:the-tape-drops`

> Opening battle of Chapter 2. Snitch surfaces a four-year-old tape
> from the corner store CCTV. The player has to take it from him.
> This is a guided battle — same shape as `block-party:welcome-to-the-block`.
> It teaches the player that the "Watching the Feed" line from
> chapter 1 was a setup, not a throwaway.

---

## 1. Stage

```yaml
parallaxSceneId: red-side-tapes:opening:tape-drops
venueId: corner-store-court
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
  - id: storefront
    depth: 0.4
    parallaxX: 0.4
    parallaxY: 0.2
    widthFactor: 1.1
    anchor: { x: 0.5, y: 0.65 }
  - id: vending-machine
    depth: 0.6
    parallaxX: 0.55
    parallaxY: 0.35
    widthFactor: 0.35
    anchor: { x: 0.18, y: 0.7 }                   # same vending machine from Ch1 (callback)
  - id: lamp-post
    depth: 0.7
    parallaxX: 0.8
    parallaxY: 0.5
    widthFactor: 0.4
    anchor: { x: 0.15, y: 0.6 }
  - id: cornball
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.3, y: 0.7 }
  - id: snitch
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.55
    anchor: { x: 0.7, y: 0.62 }                   # close on Snitch holding the tape
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
  - { x: 0.5, y: 0.5, zoom: 1.0, holdMs: 1800, ease: easeInOut }     # wide on the corner
  - { x: 0.7, y: 0.55, zoom: 1.25, holdMs: 2400, ease: easeInOut }   # close on Snitch + the tape
  - { x: 0.3, y: 0.6, zoom: 1.1, holdMs: 2200, ease: easeInOut }     # pull back to show the vending machine (callback hook)
```

---

## 2. Dialog

> Pre-battle dialogue. The runtime renders these via the `DialogueScene`
> component. Post-battle dialogue is held by the engine's
> `redSideTapesChapter.postDialogue` array — not authored here.

```yaml
lines:
  - lineToken: red-side-tapes:tape-drops:pre:0
    speaker: Snitch
    portraitAssetId: assets/characters/snitch.webp
    soundHook: story.tape.static
    text: |
      Got something for you. Four years old. Don't ask where I got it —
      just ask how long I've been watching the feed.
  - lineToken: red-side-tapes:tape-drops:pre:1
    speaker: Cornball
    portraitAssetId: assets/characters/cornball.webp
    soundHook: story.footstep
    text: |
      (Cornball runs in with a bag of chips.) Yo — is that the same
      vending machine from last week?
  - lineToken: red-side-tapes:tape-drops:pre:2
    speaker: Snitch
    portraitAssetId: assets/characters/snitch.webp
    soundHook: story.tape.rewind
    focusLayer: snitch
    text: |
      Press play, or burn it. Either way, the block's gonna know
      what's on this tape before the sun goes down.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: red-side-tapes:tape-drops:pre:0, atMs: 0,    soundHook: story.tape.static }
  - { lineToken: red-side-tapes:tape-drops:pre:1, atMs: 1800, soundHook: story.footstep }
  - { lineToken: red-side-tapes:tape-drops:pre:2, atMs: 3200, soundHook: story.tape.rewind, focusLayerId: snitch }
```

---

## 3. Battle

```yaml
battle:
  id: the-tape-drops
  title: "The Tape Drops"
  battleType: guided
  mapPosition: { x: 8, y: 76 }
  prerequisites: []
  optional: false
  enemy:
    name: Snitch
    portraitAssetId: assets/characters/snitch.webp
    behaviorProfile: balanced
    deck:
      - cornball
      - snow
      - rastamon
      - wifey
      - oink
      - plug
      - snitch
  cinematic:
    videoAssetId: assets/story/chapter-two/media/tape-loading.mp4
    posterAssetId: assets/story/chapter-two/media/tape-loading.webp
    environmentAssetId: assets/venues/corner-store-court.webp
  modifiers:
    handSizeBonus: 1                 # the tape gives the player one extra card in opening hand (rule-twist hook)
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
    - { kind: currency, id: street-xp, amount: 50 }
    - { kind: character-unlock, id: snitch, amount: 1 }   # first meeting, the player unlocks Snitch as a rival portrait
  teaching:
    tips:
      - "Tape drops add a card to your opening hand — play around it."
      - "Snitch's deck has watchers, not fighters. Hold tempo."
    focusMechanics: [tape-drop bonus, district scoring, Motion]
    focusCards: [cornball, snow, snitch]
```

---

## 4. Drama notes

- **The setup (callback):** Snitch's "Watching the Feed" line from
  chapter 1's `side-alley-challenge` was a setup. This scene is the
  payoff — the tape is what Snitch was watching. The four-year-old
  footage has been sitting on Snitch's hard drive the whole season.
- **The character unlock:** Snitch unlocks as a playable rival
  portrait. He's a wildcard, not a lead rival — but the player can
  now use him in the deck editor as a flex pick.
- **The pacing:** This is a guided battle. Use it to teach the player
  that the tape mechanic from this chapter hands them a card bonus.
  Show the 3 stars, show the ticket, show the chapter map.
- **The vending machine:** Layer `vending-machine` reuses the same
  sprite Cornball kicked in chapter 1. The `tape-returned` scene's
  Cornball line ("Wait — that's MY vending machine. He kicked it
  first?") is the season's first formal callback.