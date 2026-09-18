# CHAPTER 2 — `red-side-tapes` (Red Side Tapes)

> The second chapter. Long-form: 5 required battles + 1 optional mastery
> + 1 mini-boss + 1 boss + 1 reward ceremony. 7 tickets on a perfect run,
> +1 finale ticket, +1 chapter key, +1 card back, +1 character unlock
> (Wifey), +1 clue card ("The Block" — Cracked Head's signature).
> Total ticket payout on first perfect run: 8.

---

## 0. Identity

```yaml
id: red-side-tapes
order: 2
title: "Chapter Two: Red Side Tapes"
subtitle: "Tape don't lie."
description: |
  Four-year-old security footage surfaces from the corner store. Ganger
  Red has been holding it. Ganger Blue has been denying it. The block
  has to pick a side before Baby Momma picks a card.
mapAssetId: assets/story/chapter-two/environments/map.webp
format: long-form
```

---

## 1. Beat sheet

```yaml
beats:
  - "The Tape Drops — Snitch surfaces a tape from the corner store CCTV."
  - "Red Side Testimony — Ganger Red lays out what his side saw."
  - "Blue Side Defense — Ganger Blue counters. Wifey tries to mediate."
  - "The Watch Party — Both sides play the tape publicly. The middle district locks."
  - "Alley Tape (optional) — Alley Runner offers a side match; the camera mechanic pays off here."
  - "Wifey's Verdict — Wifey forces the player to commit. Snitch is on the wall."
  - "Baby Momma Plays the Card — Baby Momma takes the mic. Three phases. She plays 'The Block.'"
  - "Tape Returned — The card is the season's first clue. Chapter three unlocks."
```

---

## 2. Cast (this chapter)

```yaml
cast:
  - { id: ganger-red, role: lead-rival, scenes: [the-tape-drops, red-side-testimony, the-watch-party, wifeys-verdict, baby-momma-plays-the-card, tape-returned] }
  - { id: baby-momma, role: chapter-boss, scenes: [baby-momma-plays-the-card, tape-returned] }
  - { id: wifey, role: supporting-rival, scenes: [blue-side-defense, the-watch-party, wifeys-verdict, tape-returned] }
  - { id: ganger-blue, role: supporting-rival, scenes: [blue-side-defense, the-watch-party, wifeys-verdict] }
  - { id: snitch, role: supporting, scenes: [the-tape-drops, the-watch-party, wifeys-verdict, tape-returned] }
  - { id: cornball, role: comic-relief, scenes: [the-tape-drops, tape-returned] }
  - { id: alley-runner, role: cameo, scenes: [alley-tape] }   # add to CHARACTER_ROSTER first
```

---

## 3. Nodes

```yaml
nodes:
  - id: the-tape-drops
    kind: battle
    battleType: guided
    mapPosition: { x: 8, y: 76 }
    prerequisites: []
    optional: false
    scene: scenes/01-the-tape-drops.md
  - id: red-side-testimony
    kind: battle
    battleType: standard
    mapPosition: { x: 23, y: 62 }
    prerequisites: [the-tape-drops]
    optional: false
    scene: scenes/02-red-side-testimony.md
  - id: blue-side-defense
    kind: battle
    battleType: standard
    mapPosition: { x: 40, y: 54 }
    prerequisites: [red-side-testimony]
    optional: false
    scene: scenes/03-blue-side-defense.md
  - id: the-watch-party
    kind: battle
    battleType: rule-twist
    mapPosition: { x: 57, y: 42 }
    prerequisites: [blue-side-defense]
    optional: false
    scene: scenes/04-the-watch-party.md
  - id: alley-tape
    kind: battle
    battleType: standard
    mapPosition: { x: 52, y: 76 }
    prerequisites: [red-side-testimony]
    optional: true
    scene: scenes/05-alley-tape.md
  - id: wifeys-verdict
    kind: battle
    battleType: mini-boss
    mapPosition: { x: 72, y: 31 }
    prerequisites: [the-watch-party]
    optional: false
    scene: scenes/06-wifeys-verdict.md
  - id: baby-momma-plays-the-card
    kind: battle
    battleType: boss
    mapPosition: { x: 88, y: 16 }
    prerequisites: [wifeys-verdict]
    optional: false
    scene: scenes/07-baby-momma-plays-the-card.md
  - id: tape-returned
    kind: reward
    mapPosition: { x: 94, y: 5 }
    prerequisites: [baby-momma-plays-the-card]
    optional: false
    scene: scenes/08-tape-returned.md
```

---

## 4. Rewards ledger

```yaml
ledger:
  battles: 7                          # 5 required + 1 optional + 1 mini-boss + 1 boss
  perfectTicketPayout: 7              # auto-granted per 3-star clear
  finalePayout:
    pack-ticket: 1                    # explicit finale ticket
    character-unlock:
      - wifey                         # unlocked on Tape Returned
    cosmetic:
      - red-side-tapes-crowned        # card back / overlay
    chapter-key:
      - story-key:chapter-three
    card:
      - the-block                     # Cracked Head's signature card — the season's first clue
```

---

## 5. Drama notes

- **The setup:** Snitch's "Watching the Feed" line from chapter 1's
  `side-alley-challenge` pays off here. The tape is what Snitch was
  watching. His cameo in `the-tape-drops` is the player realizing the
  four-year-old footage has been sitting on Snitch's hard drive the
  whole season.
- **The reveal:** Baby Momma plays **"The Block"** — a 6-cost, 12-power
  card from Cracked Head's old deck, with the On Reveal text:
  *"Add a copy of a card you played last turn to your hand."*
  That's Cracked Head's signature mechanic — replay, relive, return.
  The card echoes through every remaining chapter as the player keeps
  finding it in opponents' decks.
- **The callback:** The vending machine Cornball kicked in chapter 1
  is the same vending machine Cracked Head kicked four years ago. The
  tape shows it. (Same asset, different decade.) Cornball's line in
  `tape-returned` should be: *"Wait — that's MY vending machine. He
  kicked it first?"*
- **The choice:** The player's path through nodes 2 and 3 (Red Side
  Testimony first, then Blue Side Defense) determines Wifey's
  disposition in `wifeys-verdict`. If the player won both clean,
  Wifey sides with them. If the player lost either, Wifey judges
  against them. Either way, Baby Momma plays the card — but the
  card's flavor text changes based on the player's path
  (Red-path flavor: "He kept the receipts." / Blue-path flavor:
  "He kept the lie.").
- **The character unlock:** Wifey unlocks here as a playable rival
  portrait. She becomes the alt-side rival going into chapter 3.

---

## 6. Scene-by-scene index

The 8 scene files for this chapter live next to this file:

```
chapters/red-side-tapes/
├── chapter-2-red-side-tapes.md       (this file)
├── scenes/
│   ├── 01-the-tape-drops.md
│   ├── 02-red-side-testimony.md
│   ├── 03-blue-side-defense.md
│   ├── 04-the-watch-party.md
│   ├── 05-alley-tape.md
│   ├── 06-wifeys-verdict.md
│   ├── 07-baby-momma-plays-the-card.md
│   └── 08-tape-returned.md
```

Each scene file uses the `TEMPLATE.scene.md` format. The dialogue and
camera path values are filled in from the engine's
`redSideTapesChapter.preDialogue` / `postDialogue` arrays, and the
parallax scene ids map to entries in `parallaxScenes.ts`.

---

## 7. Open production flags (not blocking, but owed)

- **Character bibles still owed for this chapter:** `ganger-red`,
  `wifey`, `snitch`, `alley-runner`. (Cornball cameo only — no new
  bible needed.) The four corner bosses (`ganger-blue`,
  `cracked-head`, `baby-momma`, `og-uncle`) already have bibles.
- **CHARACTER_ROSTER entries** for `ganger-red`, `wifey`, `snitch`,
  `alley-runner` are presumed present from the engine pass; if any
  are missing, the engine-side roster update is a separate ticket.
- **Parallax art** for the 6 unique scenes (corner-store-court,
  red-side-court, blue-side-court, watch-party-set, alley-tape,
  baby-momma-rooftop) is a director handoff, not a writer deliverable.
- **Chapter 1 backfill:** 7 of 8 chapter-1 scene files are still
  unwritten (`02-blue-side-pressure`, `03-receipts-on-camera`,
  `04-red-side-retaliation`, `05-side-alley-challenge`,
  `06-snitch-at-the-corner`, `07-cracked-head-takes-the-block`,
  `08-block-crowned`). Scene 01 is the only worked example. Backfill
  is owed but not blocking chapter 2.