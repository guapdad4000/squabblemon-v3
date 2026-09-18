# CHAPTER 1 — `block-party` (Block Party)

> The first chapter. Long-form: 5 required battles + 1 optional mastery
> + 1 mini-boss + 1 boss + 1 reward ceremony. 7 tickets on a perfect run,
> +1 finale ticket, +1 chapter key, +1 card back, +1 character unlock
> (Cracked Head). Total ticket payout on first perfect run: 8.

---

## 0. Identity

```yaml
id: block-party
order: 1
title: "Chapter One: Block Party"
subtitle: "Take the block, keep the receipts."
description: |
  A neighborhood rivalry turns into a public test of your crew.
mapAssetId: assets/story/chapter-one/environments/map.webp
format: long-form
```

---

## 1. Beat sheet

```yaml
beats:
  - "Ganger Blue tests the new player at the corner store."
  - "The Blue Side pushes back. The player has to hold the corner."
  - "Ganger Red brings receipts. The camera is rolling. The middle district locks."
  - "Red Side escalates. Cracked Head is mentioned for the first time."
  - "Side Alley (optional): Alley Runner offers a mastery match."
  - "Snitch is watching the feed. The block is being recorded."
  - "Cracked Head takes the block. Three phases. The player earns the crown."
  - "Block Crowned. Chapter two unlocks."
```

---

## 2. Cast (this chapter)

```yaml
cast:
  - { id: ganger-blue, role: lead-rival, scenes: [welcome-to-the-block, blue-side-pressure, side-alley-challenge] }
  - { id: ganger-red, role: lead-rival, scenes: [receipts-on-camera, red-side-retaliation] }
  - { id: cracked-head, role: chapter-boss, scenes: [cracked-head-takes-the-block, block-crowned] }
  - { id: snitch, role: supporting-rival, scenes: [snitch-at-the-corner, block-crowned] }
  - { id: baby-momma, role: cameo, scenes: [red-side-retaliation, block-crowned] }   # watching from the corner
  - { id: cornball, role: comic-relief, scenes: [welcome-to-the-block, block-crowned] }
  - { id: wifey, role: supporting, scenes: [red-side-retaliation, block-crowned] }
  - { id: alley-runner, role: cameo, scenes: [side-alley-challenge] }   # add to CHARACTER_ROSTER first
```

---

## 3. Nodes

> The engine already implements this chapter. The screenplay below is the
> writer's view of the same data. The 8 nodes map 1:1 to the `nodes`
> array in the engine's `blockPartyChapter` constant.

```yaml
nodes:
  - id: welcome-to-the-block
    kind: battle
    battleType: guided
    mapPosition: { x: 8, y: 76 }
    prerequisites: []
    optional: false
    scene: scenes/01-welcome-to-the-block.md
  - id: blue-side-pressure
    kind: battle
    battleType: standard
    mapPosition: { x: 23, y: 62 }
    prerequisites: [welcome-to-the-block]
    optional: false
    scene: scenes/02-blue-side-pressure.md
  - id: receipts-on-camera
    kind: battle
    battleType: rule-twist
    mapPosition: { x: 40, y: 54 }
    prerequisites: [blue-side-pressure]
    optional: false
    scene: scenes/03-receipts-on-camera.md
  - id: red-side-retaliation
    kind: battle
    battleType: standard
    mapPosition: { x: 57, y: 42 }
    prerequisites: [receipts-on-camera]
    optional: false
    scene: scenes/04-red-side-retaliation.md
  - id: side-alley-challenge
    kind: battle
    battleType: standard
    mapPosition: { x: 52, y: 76 }
    prerequisites: [blue-side-pressure]
    optional: true
    scene: scenes/05-side-alley-challenge.md
  - id: snitch-at-the-corner
    kind: battle
    battleType: mini-boss
    mapPosition: { x: 72, y: 31 }
    prerequisites: [red-side-retaliation]
    optional: false
    scene: scenes/06-snitch-at-the-corner.md
  - id: cracked-head-takes-the-block
    kind: battle
    battleType: boss
    mapPosition: { x: 88, y: 16 }
    prerequisites: [snitch-at-the-corner]
    optional: false
    scene: scenes/07-cracked-head-takes-the-block.md
  - id: block-crowned
    kind: reward
    mapPosition: { x: 94, y: 5 }
    prerequisites: [cracked-head-takes-the-block]
    optional: false
    scene: scenes/08-block-crowned.md
```

---

## 4. Rewards ledger

```yaml
ledger:
  battles: 7                          # 5 required + 1 optional + 1 boss (mini-boss counts)
  perfectTicketPayout: 7              # auto-granted per 3-star clear
  finalePayout:
    pack-ticket: 1                    # explicit finale ticket
    character-unlock:
      - cracked-head                  # unlocked on Block Crowned
    cosmetic:
      - block-party-crowned           # card back / overlay
    chapter-key:
      - story-key:chapter-two
    card:
      - nerd                          # Closet Nerd — pulled from the boss deck as a reward
```

---

## 5. Drama notes

- **The reveal:** Cracked Head's "I'll be back" is the chapter's
  promise to the player. The player has to earn that line by
  holding all three districts in the boss fight. If they don't, the
  line is replaced with "You got lucky. See you next season."
- **The setup:** Snitch's "Watching the Feed" passive is mentioned
  in the side-alley-challenge scene. The player has to remember
  this for the snitch-at-the-corner boss fight, where Snitch
  cashes the chatter in for +2 CPU motion at round 4.
- **The callback:** The vending machine that Cornball kicks at the
  start of `welcome-to-the-block` is the same vending machine
  the player has to fight in the optional `side-alley-challenge`.
- **The character unlock:** Cracked Head is unlocked on Block
  Crowned. The player can then use him as their rival portrait
  in the deck editor.

---

## 6. Scene-by-scene index

The 8 scene files for this chapter live next to this file:

```
chapters/block-party/
├── chapter-1-block-party.md       (this file)
├── scenes/
│   ├── 01-welcome-to-the-block.md
│   ├── 02-blue-side-pressure.md
│   ├── 03-receipts-on-camera.md
│   ├── 04-red-side-retaliation.md
│   ├── 05-side-alley-challenge.md
│   ├── 06-snitch-at-the-corner.md
│   ├── 07-cracked-head-takes-the-block.md
│   └── 08-block-crowned.md
```

Each scene file uses the `TEMPLATE.scene.md` format. The dialogue and
camera path values are filled in from the engine's
`blockPartyChapter.preDialogue` / `postDialogue` arrays, and the
parallax scene ids map to entries in `parallaxScenes.ts`.
