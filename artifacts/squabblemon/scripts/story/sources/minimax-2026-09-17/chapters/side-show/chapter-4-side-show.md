# CHAPTER 4 — `side-show` (Side Show)

> The fourth chapter. Long-form: 5 required battles + 1 optional
> mastery + 1 mini-boss (Scammer) + 1 boss (Snitch, 3-phase) +
> 1 reward ceremony. 7 battles + 1 finale = 8 tickets on a perfect
> run. Snitch has the real receipts from the funeral night four
> years ago; a Scammer is selling fakes. The player has to figure
> out which is real. Church Auntie officiates a funeral that
> everyone says isn't for Cracked Head — and then it is.

> **Season-arc note:** the season arc's chapter table shows 6
> tickets for chapter 4. This screenplay ships 8 tickets
> (matching the chapter 1 / chapter 2 long-form template of 7
> battle auto-grants + 1 finale). If the season-arc number
> needs to match exactly, drop the optional mastery (nail-techs-
> counter) — that brings the count to 6 + 1 finale = 7, still
> one over. Otherwise drop a required battle. Flagged for
> reconciliation with the user.

---

## 0. Identity

```yaml
id: side-show
order: 4
title: "Chapter Four: Side Show"
subtitle: "Real ones cost more."
description: |
  Snitch has the real receipts from the night Cracked Head
  "died." A Scammer is selling fake ones. Church Auntie
  officiates a funeral that isn't for Cracked Head — until it is.
mapAssetId: assets/story/chapter-four/environments/map.webp
format: long-form
```

---

## 1. Beat sheet

```yaml
beats:
  - "The Receipts Market — Snitch surfaces a tape and a stack of receipts. The player meets the network."
  - "Snitch's Price — Snitch sets the cost. He doesn't sell at face value."
  - "The Scammer's Pitch — A Scammer offers 'better' (fake) receipts. The middle district locks."
  - "Church Auntie's Setup — Church Auntie prepares the funeral. The public cover story is 'someone else.'"
  - "Nail Tech's Counter (optional) — Nail Tech in the alley has the real receipts. The mastery."
  - "The Fake Funeral — The Scammer interrupts. Mini-boss fight. Defend the real receipts."
  - "Snitch's Verdict — Snitch reveals who's really being eulogized. Cracked Head. Three phases."
  - "The Real Receipts — Church Auntie blesses the truth. Chapter five unlocks."
```

---

## 2. Cast (this chapter)

```yaml
cast:
  - { id: snitch, role: chapter-boss, scenes: [the-receipts-market, snitchs-price, the-scammers-pitch, snitchs-verdict, the-real-receipts] }
  - { id: scammer, role: antagonist, scenes: [the-scammers-pitch, the-fake-funeral] }   # add to CHARACTER_ROSTER first
  - { id: church-auntie, role: supporting, scenes: [church-aunties-setup, the-fake-funeral, snitchs-verdict, the-real-receipts] }
  - { id: nail-tech, role: cameo, scenes: [nail-techs-counter] }   # add to CHARACTER_ROSTER first
  - { id: og-uncle, role: cameo, scenes: [the-fake-funeral, snitchs-verdict] }   # sits in the back row
  - { id: baby-momma, role: cameo, scenes: [the-fake-funeral, snitchs-verdict] }   # watching
  - { id: cornball, role: cameo, scenes: [the-receipts-market, the-real-receipts] }
  - { id: cracked-head, role: referenced, scenes: [snitchs-verdict, the-real-receipts] }   # not present, but the funeral is for him
```

---

## 3. Nodes

```yaml
nodes:
  - id: the-receipts-market
    kind: battle
    battleType: guided
    mapPosition: { x: 8, y: 76 }
    prerequisites: []
    optional: false
    scene: scenes/01-the-receipts-market.md
  - id: snitchs-price
    kind: battle
    battleType: standard
    mapPosition: { x: 23, y: 62 }
    prerequisites: [the-receipts-market]
    optional: false
    scene: scenes/02-snitchs-price.md
  - id: the-scammers-pitch
    kind: battle
    battleType: rule-twist
    mapPosition: { x: 40, y: 54 }
    prerequisites: [snitchs-price]
    optional: false
    scene: scenes/03-the-scammers-pitch.md
  - id: church-aunties-setup
    kind: battle
    battleType: standard
    mapPosition: { x: 57, y: 42 }
    prerequisites: [the-scammers-pitch]
    optional: false
    scene: scenes/04-church-aunties-setup.md
  - id: nail-techs-counter
    kind: battle
    battleType: standard
    mapPosition: { x: 52, y: 76 }
    prerequisites: [snitchs-price]
    optional: true
    scene: scenes/05-nail-techs-counter.md
  - id: the-fake-funeral
    kind: battle
    battleType: mini-boss
    mapPosition: { x: 72, y: 31 }
    prerequisites: [church-aunties-setup]
    optional: false
    scene: scenes/06-the-fake-funeral.md
  - id: snitchs-verdict
    kind: battle
    battleType: boss
    mapPosition: { x: 88, y: 16 }
    prerequisites: [the-fake-funeral]
    optional: false
    scene: scenes/07-snitchs-verdict.md
  - id: the-real-receipts
    kind: reward
    mapPosition: { x: 94, y: 5 }
    prerequisites: [snitchs-verdict]
    optional: false
    scene: scenes/08-the-real-receipts.md
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
      - church-auntie                 # Church Auntie unlocks as a playable rival at finale
    cosmetic:
      - side-show-crowned             # card back / overlay
    chapter-key:
      - story-key:chapter-five
    card:
      - the-real-receipts             # a card representing the real receipts (the season's second clue card)
```

---

## 5. Drama notes

- **The receipts conflict:** Snitch has the real receipts from the
  night Cracked Head "died." A Scammer is selling fake ones at
  half the price. The player's job: figure out which is real.
- **The fake funeral:** Church Auntie officiates a funeral that
  is publicly framed as "for the community" (or "for a
  neighborhood elder") but is actually a quiet memorial for
  Cracked Head. Per the resolved-decision log, Cracked Head is
  alive in witness protection. The funeral is the family's
  way of grieving the public Cracked Head while knowing the
  real one is safe.
- **The reveal:** Snitch's verdict (scene 07) is the season's
  second reveal that Cracked Head is alive. The first was
  Cracked Head's own appearance in Ch1's boss fight (and OG
  Uncle's confirmation in Ch3). Ch4 confirms it to the wider
  block: Snitch shows the receipts, the tape plays, the funeral
  is for Cracked Head. From this chapter forward, every
  character in the season knows.
- **The setup:** The real receipts card (`the-real-receipts`)
  drops at the finale. It's the season's second clue card (after
  Ch2's `the-block`). In Ch7 (Return of the Block), the player
  will use this card in the return fight.
- **The callback:** Church Auntie's "Bless this house" line is
  the setup for Ch8's wedding/finale officiation.
- **The character unlock:** Church Auntie unlocks at the finale
  as a playable rival portrait. She's the chapter's heart.

---

## 6. Scene-by-scene index

The 8 scene files for this chapter live next to this file:

```
chapters/side-show/
├── chapter-4-side-show.md       (this file)
├── scenes/
│   ├── 01-the-receipts-market.md
│   ├── 02-snitchs-price.md
│   ├── 03-the-scammers-pitch.md
│   ├── 04-church-aunties-setup.md
│   ├── 05-nail-techs-counter.md
│   ├── 06-the-fake-funeral.md
│   ├── 07-snitchs-verdict.md
│   └── 08-the-real-receipts.md
```

Each scene file uses the `TEMPLATE.scene.md` format. The dialogue
and camera path values are filled in from the engine's
`sideShowChapter.preDialogue` / `postDialogue` arrays, and the
parallax scene ids map to entries in `parallaxScenes.ts`.

---

## 7. Open production flags (not blocking, but owed)

- **Character bibles still owed for this chapter's cast:** `scammer`,
  `church-auntie`, `nail-tech`. Snitch's bible is owed from
  chapter 2 and remains owed. OG Uncle and Cornball cameo only.
- **CHARACTER_ROSTER entries** for `scammer`, `church-auntie`,
  `nail-tech` are presumed present from the engine pass; if
  any are missing, the engine-side roster update is a separate
  ticket.
- **Parallax art** for the 7 unique scenes (corner-store-court,
  receipts-bazaar, scammer-pitch, funeral-stage, alley-counter,
  fake-funeral, snitch-rooftop) is a director handoff, not a
  writer deliverable.