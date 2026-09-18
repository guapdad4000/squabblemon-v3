# CHAPTER 7 — `return-of-the-block` (Return of the Block)

> The seventh chapter. Long-form: 5 required battles + 1
> optional mastery + 1 mini-boss + 1 boss (Cracked Head, 3
> phases) + 1 reward ceremony. 7 battles + 1 finale = 8 tickets
> on a perfect run. Cracked Head returns. Blue takes the deal.
> The lie is exposed. The block changes hands.

---

## 0. Identity

```yaml
id: return-of-the-block
order: 7
title: "Chapter Seven: Return of the Block"
subtitle: "Zero districts. That's what you get for snitching."
description: |
  Cracked Head walks into the corner store. Blue's deal is
  exposed. The lie is out. OG Uncle is in a wheelchair. Baby
  Momma's carrying the second kid. The block changes hands.
mapAssetId: assets/story/chapter-seven/environments/map.webp
format: long-form
```

---

## 1. Beat sheet

```yaml
beats:
  - "Blue Takes the Deal — Blue meets Officer Oink at the corner. Takes the deal."
  - "Snitch's Roll Call — Snitch records Blue taking the deal."
  - "Blue's Guilt — Blue's guilt catches up. The lie is starting to weigh."
  - "Cracked Head at the Corner — Cracked Head walks into the corner store. The middle district locks."
  - "Baby Momma's Second Kid (optional) — Baby Momma reveals the second kid is on the way."
  - "Wheelchair OG — OG Uncle in a wheelchair. The moment."
  - "The Lie Exposed — Cracked Head vs Blue. Three phases. The lie is out."
  - "The Block Changes Hands — The block changes. Chapter eight unlocks."
```

---

## 2. Cast (this chapter)

```yaml
cast:
  - { id: cracked-head, role: chapter-boss, scenes: [cracked-head-at-the-corner, the-lie-exposed, the-block-changes-hands] }
  - { id: ganger-blue, role: lead-rival, scenes: [blue-takes-the-deal, snitchs-roll-call, blues-guilt, the-lie-exposed, the-block-changes-hands] }
  - { id: snitch, role: supporting, scenes: [snitchs-roll-call, blues-guilt, the-block-changes-hands] }
  - { id: officer-oink, role: cameo, scenes: [blue-takes-the-deal] }   # the lockdown (Ch4, Ch7, Ch8)
  - { id: baby-momma, role: cameo, scenes: [baby-mommas-second-kid, the-block-changes-hands] }   # pregnant, second kid
  - { id: og-uncle, role: cameo, scenes: [wheelchair-og, the-block-changes-hands] }   # wheelchair (per resolved-decision log)
  - { id: wifey, role: cameo, scenes: [blues-guilt, the-block-changes-hands] }   # stands by Blue
  - { id: ganger-red, role: cameo, scenes: [snitchs-roll-call, the-block-changes-hands] }
  - { id: delivery-demon, role: cameo, scenes: [the-block-changes-hands] }   # add to CHARACTER_ROSTER first
  - { id: cornball, role: comic-cameo, scenes: [snitchs-roll-call, the-block-changes-hands] }
```

---

## 3. Nodes

```yaml
nodes:
  - id: blue-takes-the-deal
    kind: battle
    battleType: guided
    mapPosition: { x: 8, y: 76 }
    prerequisites: []
    optional: false
    scene: scenes/01-blue-takes-the-deal.md
  - id: snitchs-roll-call
    kind: battle
    battleType: standard
    mapPosition: { x: 23, y: 62 }
    prerequisites: [blue-takes-the-deal]
    optional: false
    scene: scenes/02-snitchs-roll-call.md
  - id: blues-guilt
    kind: battle
    battleType: standard
    mapPosition: { x: 40, y: 54 }
    prerequisites: [snitchs-roll-call]
    optional: false
    scene: scenes/03-blues-guilt.md
  - id: cracked-head-at-the-corner
    kind: battle
    battleType: rule-twist
    mapPosition: { x: 57, y: 42 }
    prerequisites: [blues-guilt]
    optional: false
    scene: scenes/04-cracked-head-at-the-corner.md
  - id: baby-mommas-second-kid
    kind: battle
    battleType: standard
    mapPosition: { x: 52, y: 76 }
    prerequisites: [snitchs-roll-call]
    optional: true
    scene: scenes/05-baby-mommas-second-kid.md
  - id: wheelchair-og
    kind: battle
    battleType: mini-boss
    mapPosition: { x: 72, y: 31 }
    prerequisites: [cracked-head-at-the-corner]
    optional: false
    scene: scenes/06-wheelchair-og.md
  - id: the-lie-exposed
    kind: battle
    battleType: boss
    mapPosition: { x: 88, y: 16 }
    prerequisites: [wheelchair-og]
    optional: false
    scene: scenes/07-the-lie-exposed.md
  - id: the-block-changes-hands
    kind: reward
    mapPosition: { x: 94, y: 5 }
    prerequisites: [the-lie-exposed]
    optional: false
    scene: scenes/08-the-block-changes-hands.md
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
      - delivery-demon                # Delivery Demon unlocks as a playable rival at finale
    cosmetic:
      - return-of-the-block-crowned   # card back / overlay
    chapter-key:
      - story-key:chapter-eight
    card:
      - the-block-changes             # the season's fifth clue card — when the block changes hands
```

---

## 5. Drama notes

- **Blue's deal:** Per the resolved-decision log, "Blue
  betrays Cracked Head in chapter 7 and redeems in chapter 8."
  The deal Blue takes is the betrayal — he sells Cracked
  Head's location to whoever wants him dead (or arrested, or
  exposed). Officer Oink is the buyer.
- **The lie is exposed:** In the boss fight (scene 07), the
  lie is out. Cracked Head knows Blue took the deal. The
  family finds out. Three phases: ARRIVAL (Cracked Head walks
  in), THE LIE (Blue's deal is exposed), THE FORGIVENESS
  (the family chooses to forgive or not — player's choice).
- **OG Uncle's wheelchair:** Per the resolved-decision log,
  OG Uncle is in a wheelchair from chapter 7 onward. He's
  present at the corner store. His moment with Cracked Head
  is scene 06.
- **Baby Momma's second kid:** Per the resolved-decision log,
  Baby Momma's second child is on the way by chapter 7.
  Scene 05 (optional mastery) reveals this.
- **The block changes hands:** Per the season arc, "the block
  changes hands" in Ch7. The player wins by holding all three
  districts across the boss fight. Whoever wins takes the
  season — Ch8 sets up the redemption arc.
- **The recurring line:** "Zero districts. That's what you get
  for snitching" is the chapter's take on the "Two districts"
  line. It echoes Ch1 ("Two districts. Don't make me say it
  twice.") and Ch5 ("Two districts. He only needed one.").
- **The character unlock:** Delivery Demon — "drops the
  package" per season arc — unlocks at finale. He's the
  chapter's natural unlock target; he carries the package
  that includes the chapter key + the season's resolution.

---

## 6. Scene-by-scene index

The 8 scene files for this chapter live next to this file:

```
chapters/return-of-the-block/
├── chapter-7-return-of-the-block.md       (this file)
├── scenes/
│   ├── 01-blue-takes-the-deal.md
│   ├── 02-snitchs-roll-call.md
│   ├── 03-blues-guilt.md
│   ├── 04-cracked-head-at-the-corner.md
│   ├── 05-baby-mommas-second-kid.md
│   ├── 06-wheelchair-og.md
│   ├── 07-the-lie-exposed.md
│   └── 08-the-block-changes-hands.md
```

Each scene file uses the `TEMPLATE.scene.md` format. The
dialogue and camera path values are filled in from the engine's
`returnOfTheBlockChapter.preDialogue` / `postDialogue` arrays,
and the parallax scene ids map to entries in `parallaxScenes.ts`.

---

## 7. Open production flags (not blocking, but owed)

- **Character bibles still owed for this chapter's cast:**
  `officer-oink`, `delivery-demon`. Most others have bibles or
  are corner bosses (DONE).
- **CHARACTER_ROSTER entries** for `officer-oink`,
  `delivery-demon` are presumed present from the engine pass;
  if missing, the engine-side roster update is a separate
  ticket.
- **Parallax art** for the 7 unique scenes (corner-store-court,
  snitch-rooftop, blue-flat, corner-entrance, baby-momma-spot,
  wheelchair-court, lie-exposed-block) is a director handoff,
  not a writer deliverable.