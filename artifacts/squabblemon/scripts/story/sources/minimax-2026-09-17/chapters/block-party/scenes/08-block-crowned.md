# SCENE — `block-party:block-crowned`

> The reward ceremony. Cracked Head says his line (or the
> loss-path line). The chapter key drops. Cracked Head unlocks as
> a rival portrait. The Closet Nerd card drops as the surprise
> boss-deck reward. Cornball's vending machine gets the season's
> first formal callback setup. Chapter two unlocks here.

---

## 1. Stage

```yaml
parallaxSceneId: block-party:block-crowned:ceremony
venueId: corner-store-court
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
  - id: storefront
    depth: 0.4
    parallaxX: 0.4
    parallaxY: 0.2
    widthFactor: 1.1
    anchor: { x: 0.5, y: 0.65 }
  - id: rooftop
    depth: 0.55
    parallaxX: 0.5
    parallaxY: 0.2
    widthFactor: 1.0
    anchor: { x: 0.5, y: 0.35 }                       # Cracked Head on the rooftop for his line
  - id: cracked-head
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.6
    anchor: { x: 0.5, y: 0.5 }                        # Cracked Head on the rooftop, smaller (looking down)
  - id: ganger-blue
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.2, y: 0.7 }                        # Blue on the left, looking up
  - id: ganger-red
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.8, y: 0.7 }                        # Red on the right, looking up
  - id: cornball
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.4
    anchor: { x: 0.5, y: 0.8 }                        # Cornball front-and-center, looking up
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
  - { x: 0.5, y: 0.35, zoom: 1.3, holdMs: 2400, ease: easeInOut }    # tilt up to the rooftop, Cracked Head
  - { x: 0.5, y: 0.7, zoom: 1.2, holdMs: 2200, ease: easeInOut }      # tilt back down to the block
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: block-party:block-crowned:pre:0
    speaker: Cracked Head
    portraitAssetId: assets/characters/cracked-head.webp
    soundHook: story.crowd.ambience
    # Flavor branch — engine reads whether the player earned the line (clean 3-phase win).
    #   clean path: "I'll be back."
    #   loss path:  "You got lucky. See you next season."
    text: |
      I'll be back.
  - lineToken: block-party:block-crowned:pre:1
    speaker: Cornball
    portraitAssetId: assets/characters/cornball.webp
    soundHook: story.crowd.cheer
    focusLayer: cornball
    text: |
      (Cornball squints up at the rooftop.) He kicked it first?
      That vending machine — I kicked it first.
  - lineToken: block-party:block-crowned:pre:2
    speaker: Ganger Blue
    portraitAssetId: assets/characters/ganger-blue.webp
    soundHook: story.card.flip
    text: |
      Two districts. He only needed one. He took 'em all.
      Chapter two. We're next.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: block-party:block-crowned:pre:0, atMs: 0,    soundHook: story.crowd.ambience }
  - { lineToken: block-party:block-crowned:pre:1, atMs: 2400, soundHook: story.crowd.cheer, focusLayerId: cornball }
  - { lineToken: block-party:block-crowned:pre:2, atMs: 4600, soundHook: story.card.flip }
```

---

## 3. Reward ceremony (no battle — this is a `kind: reward` node)

```yaml
ceremony:
  id: block-crowned
  kind: reward
  title: "Block Crowned"
  mapPosition: { x: 94, y: 5 }
  prerequisites: [cracked-head-takes-the-block]
  optional: false

  # The full finalePayout from chapter-1-block-party.md.
  rewards:
    - { kind: pack-ticket,       id: street-pack-ticket,       amount: 1 }
    - { kind: character-unlock,  id: cracked-head,             amount: 1 }   # Cracked Head unlocks as a playable rival
    - { kind: cosmetic,          id: block-party-crowned,      amount: 1 }
    - { kind: chapter-key,       id: story-key:chapter-two,    amount: 1 }
    - { kind: card,              id: nerd,                     amount: 1 }   # Closet Nerd — pulled from the boss deck as a reward

  # Drama flavor branches — engine reads the boss 3-phase clean-win state.
  flavor:
    on-clean-path:
      cracked-head-line: "I'll be back."
      blue-line: "Two districts. He only needed one."
      chapter-promise: "He'll be back. We hold the block 'til then."
    on-loss-path:
      cracked-head-line: "You got lucky. See you next season."
      blue-line: "Two districts. Don't make me say it twice."
      chapter-promise: "We held the block tonight. Tomorrow's a new fight."
```

---

## 4. Drama notes

- **The chapter promise:** Cracked Head's "I'll be back" is the
  chapter's promise to the player. Per the chapter-1 drama
  notes: "The player has to earn that line by holding all three
  districts in the boss fight. If they don't, the line is
  replaced with 'You got lucky. See you next season.'"
- **The character unlock:** Cracked Head becomes a playable rival
  portrait. He's the season's chapter boss, but he's also a
  character the player can use in the deck editor. His first
  rival-screen appearance should feel familiar — he's been
  watching the block from the rooftop.
- **The Closet Nerd card:** Per the chapter cast, "Closet Nerd —
  surprise boss-drop reward in chapter 1 (he's been hiding in
  Cracked Head's deck the whole time)." The player gets the
  `nerd` card here. It's a teaser for chapter 5, where Closet
  Nerd returns as a deeper beat.
- **The Cornball callback setup:** Cornball's "I kicked it first"
  is the first half of the season's vending-machine callback.
  Chapter 2's `tape-returned` is the payoff: "Wait — that's MY
  vending machine. He kicked it first?" Three kicks, three
  seasons of memory.
- **The handoff:** "Chapter two. We're next." is the setup for
  chapter 2 (Red Side Tapes). The player now has Cracked Head in
  their deck, the chapter-two key, and a Closet Nerd card. The
  side-alley tape is about to surface.