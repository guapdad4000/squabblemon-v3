# SCENE — `red-side-tapes:tape-returned`

> The reward ceremony. The player has earned the chapter — Wifey
> unlocks as a playable rival, the player gets "The Block" card
> (Cracked Head's signature), the chapter-three key drops, the
> red-side-tapes-crowned cosmetic unlocks, and the finale ticket
> is granted. Cornball's vending-machine line is the season's
> first formal callback. Chapter three unlocks here.

---

## 1. Stage

```yaml
parallaxSceneId: red-side-tapes:tape-returned:ceremony
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
  - id: vending-machine
    depth: 0.6
    parallaxX: 0.55
    parallaxY: 0.35
    widthFactor: 0.35
    anchor: { x: 0.18, y: 0.7 }                       # the same vending machine from scene 01
  - id: the-block-card
    depth: 0.55
    parallaxX: 0.6
    parallaxY: 0.25
    widthFactor: 0.4
    anchor: { x: 0.5, y: 0.4 }                        # the card, glowing, returned to the player
  - id: baby-momma
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.5
    anchor: { x: 0.25, y: 0.65 }                      # Baby Momma on the left, watching
  - id: ganger-red
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.45
    anchor: { x: 0.4, y: 0.7 }                         # Ganger Red next to Baby Momma
  - id: wifey
    depth: 0.85
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.5
    anchor: { x: 0.65, y: 0.6 }                       # Wifey handing the card back
  - id: cornball
    depth: 0.83
    parallaxX: 0.95
    parallaxY: 0.6
    widthFactor: 0.4
    anchor: { x: 0.85, y: 0.78 }                      # Cornball mid-frame, holding the chips
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
  - { x: 0.5, y: 0.5, zoom: 1.0, holdMs: 1800, ease: easeInOut }     # wide on the corner, all five characters
  - { x: 0.5, y: 0.4, zoom: 1.3, holdMs: 2200, ease: easeInOut }     # close on the card (the-block-card layer)
  - { x: 0.65, y: 0.55, zoom: 1.25, holdMs: 2200, ease: easeInOut }   # close on Wifey
  - { x: 0.18, y: 0.65, zoom: 1.1, holdMs: 1000, ease: easeInOut }    # settle on the vending machine (callback beat)
```

---

## 2. Dialog

```yaml
lines:
  - lineToken: red-side-tapes:tape-returned:pre:0
    speaker: Wifey
    portraitAssetId: assets/characters/wifey.webp
    soundHook: story.card.flip
    text: |
      You earned it. Both tapes. The card. The block. I'ma give
      you the chapter key — and I'ma give you the card back.
  - lineToken: red-side-tapes:tape-returned:pre:1
    speaker: Cornball
    portraitAssetId: assets/characters/cornball.webp
    soundHook: story.footstep
    focusLayer: cornball
    text: |
      (Cornball squints at the vending machine.) Wait — that's MY
      vending machine. He kicked it first?
  - lineToken: red-side-tapes:tape-returned:pre:2
    speaker: Baby Momma
    portraitAssetId: assets/characters/baby-momma.webp
    soundHook: story.card.shuffle
    # Flavor branch — engine reads the player's tapeReveal state and picks one of:
    #   red-tape-and-blue-tape both clean: text A ("He kept the receipts.")
    #   otherwise:                       text B ("He kept the lie.")
    text: |
      He kept the receipts.
  - lineToken: red-side-tapes:tape-returned:pre:3
    speaker: Wifey
    portraitAssetId: assets/characters/wifey.webp
    soundHook: story.chapter.unlock
    text: |
      Chapter three. Take the key. Blue Side is about to need you.
```

### Dialog cues

```yaml
dialogCues:
  - { lineToken: red-side-tapes:tape-returned:pre:0, atMs: 0,    soundHook: story.card.flip }
  - { lineToken: red-side-tapes:tape-returned:pre:1, atMs: 2000, soundHook: story.footstep, focusLayerId: cornball }
  - { lineToken: red-side-tapes:tape-returned:pre:2, atMs: 3400, soundHook: story.card.shuffle }
  - { lineToken: red-side-tapes:tape-returned:pre:3, atMs: 5000, soundHook: story.chapter.unlock }
```

---

## 3. Reward ceremony (no battle — this is a `kind: reward` node)

```yaml
ceremony:
  id: tape-returned
  kind: reward
  title: "Tape Returned"
  mapPosition: { x: 94, y: 5 }
  prerequisites: [baby-momma-plays-the-card]
  optional: false

  # The full finalePayout from chapter-2-red-side-tapes.md.
  rewards:
    - { kind: pack-ticket,       id: street-pack-ticket, amount: 1 }
    - { kind: character-unlock,  id: wifey,              amount: 1 }   # Wifey unlocks as a playable rival
    - { kind: cosmetic,          id: red-side-tapes-crowned, amount: 1 }
    - { kind: chapter-key,       id: story-key:chapter-three, amount: 1 }
    - { kind: card,              id: the-block,          amount: 1 }   # Cracked Head's signature card — the season's first clue

  # Drama flavor branches — engine reads the tapeReveal state and grants one.
  flavor:
    on-clean-path:
      card-flavor: "He kept the receipts."
      card-subtitle: "Cracked Head's signature."
      wifey-line: "Y'all both earned this. Don't make me regret it."
    on-loss-path:
      card-flavor: "He kept the lie."
      card-subtitle: "Cracked Head's signature."
      wifey-line: "You earned it the hard way. Don't waste it."
```

---

## 4. Drama notes

- **The reward ceremony:** All five finale payouts land here.
  The `pack-ticket` is the explicit +1 finale grant; the other
  four are the chapter key, character unlock, cosmetic, and the
  clue card.
- **The character unlock:** Wifey becomes a playable rival portrait.
  She's the alt-side rival going into chapter 3 (Blue Side Blues),
  where she'll be a major presence.
- **The callback:** Cornball's "Wait — that's MY vending machine.
  He kicked it first?" is the season's first formal callback.
  The vending machine was introduced in chapter 1 (Cornball kicked
  it) and recurs in chapter 2's opening (Snitch's tape). Now we
  learn Cracked Head kicked it four years ago. Same machine, three
  kicks, three seasons of memory.
- **The flavor branches:** The runtime reads the player's path
  through scenes 02 and 03 and applies one of the two flavor
  branches. The card is identical either way; only the flavor
  text changes.
- **The handoff:** "Blue Side is about to need you" is the chapter
  3 setup. The player now has Wifey in their deck, "The Block" in
  their collection, and a chapter-three key. Chapter 3 (Blue Side
  Blues) is a compact-ticket chapter — 3 battles, 3 tickets,
  OG Uncle is sick, Ganger Blue is in denial.