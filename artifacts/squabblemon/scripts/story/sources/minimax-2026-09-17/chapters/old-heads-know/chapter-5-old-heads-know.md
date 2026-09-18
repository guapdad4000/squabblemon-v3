# CHAPTER 5 — `old-heads-know` (Old Heads Know)

> The fifth chapter. Long-form: 5 required battles + 1 optional
> mastery + 1 mini-boss (Hooper) + 1 boss (OG Uncle, 2-phase) +
> 1 reward ceremony. 7 battles + 1 finale = 8 tickets on a perfect
> run. Family secret out: Cracked Head is alive. Baby Momma drops
> the kid bombshell. Wifey stands by Blue. Church Auntie blesses
> the truth. The player has to fight OG Uncle across two phases
> to earn the chapter.

> **Season-arc note:** the season arc's chapter table shows 7
> tickets for chapter 5. This screenplay ships 8 tickets
> (matching the chapter 1 / 2 / 4 long-form template). If the
> season-arc number is the source of truth, drop the optional
> mastery (alleys-confession) — that brings the count to 6 + 1
> finale = 7. Flagged for reconciliation.

---

## 0. Identity

```yaml
id: old-heads-know
order: 5
title: "Chapter Five: Old Heads Know"
subtitle: "Two districts. I only needed one."
description: |
  The Old Heads convene at OG Uncle's bedside. Baby Momma drops
  the kid bombshell. Wifey stands by Blue. Church Auntie
  blesses the truth. The family finds out what's been hiding
  for four years. Hooper closes the chapter.
mapAssetId: assets/story/chapter-five/environments/map.webp
format: long-form
```

---

## 1. Beat sheet

```yaml
beats:
  - "The Old Heads Convene — OG Uncle's bedside. The family gathers: Blue, Wifey, Baby Momma, Red, Church Auntie."
  - "Baby Momma's Truth — Baby Momma drops the kid bombshell: Cracked Head is the father."
  - "Wifey's Stand — Wifey stands by Blue. Blue grieves."
  - "Church Auntie's Blessing — Church Auntie prepares to bless the truth. The wider block gathers."
  - "Alley's Confession (optional) — Alley Runner offers a side match. Recurring cameo."
  - "Hooper Closes — Hooper (Old Heads vs Side Show) closes the chapter. Mini-boss."
  - "OG Uncle's Verdict — OG Uncle tests the player with the truth. Two phases."
  - "The Family Blessed — Church Auntie blesses. Baby Momma unlocks. Chapter six unlocks."
```

---

## 2. Cast (this chapter)

```yaml
cast:
  - { id: og-uncle, role: chapter-boss, scenes: [the-old-heads-convene, og-uncles-verdict, the-family-blessed] }
  - { id: baby-momma, role: lead-rival, scenes: [baby-mommas-truth, church-aunties-blessing, og-uncles-verdict, the-family-blessed] }
  - { id: wifey, role: supporting-rival, scenes: [wifeys-stand, church-aunties-blessing, the-family-blessed] }
  - { id: ganger-blue, role: supporting-rival, scenes: [the-old-heads-convene, baby-mommas-truth, wifeys-stand, og-uncles-verdict] }
  - { id: ganger-red, role: cameo, scenes: [baby-mommas-truth, the-family-blessed] }   # the witness
  - { id: church-auntie, role: officiant, scenes: [church-aunties-blessing, the-family-blessed] }
  - { id: hooper, role: mini-boss, scenes: [hooper-closes] }   # add to CHARACTER_ROSTER first
  - { id: alley-runner, role: cameo, scenes: [alleys-confession] }
  - { id: cornball, role: comic-cameo, scenes: [the-old-heads-convene, the-family-blessed] }
  - { id: cracked-head, role: referenced, scenes: [baby-mommas-truth, og-uncles-verdict] }   # not present, but central
```

---

## 3. Nodes

```yaml
nodes:
  - id: the-old-heads-convene
    kind: battle
    battleType: guided
    mapPosition: { x: 8, y: 76 }
    prerequisites: []
    optional: false
    scene: scenes/01-the-old-heads-convene.md
  - id: baby-mommas-truth
    kind: battle
    battleType: standard
    mapPosition: { x: 23, y: 62 }
    prerequisites: [the-old-heads-convene]
    optional: false
    scene: scenes/02-baby-mommas-truth.md
  - id: wifeys-stand
    kind: battle
    battleType: standard
    mapPosition: { x: 40, y: 54 }
    prerequisites: [baby-mommas-truth]
    optional: false
    scene: scenes/03-wifeys-stand.md
  - id: church-aunties-blessing
    kind: battle
    battleType: rule-twist
    mapPosition: { x: 57, y: 42 }
    prerequisites: [wifeys-stand]
    optional: false
    scene: scenes/04-church-aunties-blessing.md
  - id: alleys-confession
    kind: battle
    battleType: standard
    mapPosition: { x: 52, y: 76 }
    prerequisites: [baby-mommas-truth]
    optional: true
    scene: scenes/05-alleys-confession.md
  - id: hooper-closes
    kind: battle
    battleType: mini-boss
    mapPosition: { x: 72, y: 31 }
    prerequisites: [church-aunties-blessing]
    optional: false
    scene: scenes/06-hooper-closes.md
  - id: og-uncles-verdict
    kind: battle
    battleType: boss
    mapPosition: { x: 88, y: 16 }
    prerequisites: [hooper-closes]
    optional: false
    scene: scenes/07-og-uncles-verdict.md
  - id: the-family-blessed
    kind: reward
    mapPosition: { x: 94, y: 5 }
    prerequisites: [og-uncles-verdict]
    optional: false
    scene: scenes/08-the-family-blessed.md
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
      - baby-momma                    # Baby Momma unlocks as a playable rival at finale
    cosmetic:
      - old-heads-know-crowned        # card back / overlay
    chapter-key:
      - story-key:chapter-six
    card:
      - the-kid                       # the second child — Baby Momma's second kid (canonical, per resolved-decision log)
```

---

## 5. Drama notes

- **The third reveal:** Ch3's bedside scene and Ch4's funeral
  have already established that Cracked Head is alive. Ch5 is
  the THIRD confirmation — the formal family council, with the
  receipts and the witnesses. From this chapter forward, the
  family officially knows.
- **The kid bombshell:** Baby Momma drops it: Cracked Head is
  the father of her kid. Per the resolved-decision log, she
  has one child by him at the start of season 1 (toddler,
  off-screen) and a second on the way by chapter 7. The
  `the-kid` card represents the second child.
- **Wifey's stand:** "I stand by Blue. Whatever he is — grieving,
  angry, broken — I stand by him." Wifey commits to the
  marriage. She's not leaving. The player has to win scene 03
  clean to keep her committed.
- **OG Uncle's verdict (2-phase):**
  1. **THE TRUTH** — OG Uncle tells the player what happened.
     The player's hand is forced open (open hands modifier). The
     player has to hold all three districts while the truth
     lands.
  2. **THE RECKONING** — OG Uncle demands the player choose
     between Blue's grief and the block's future. The player
     has to hold all three districts while the block decides.
- **The Hoops mini-boss:** Hooper is the "old heads vs side
  show" closer — per the season arc character list, "Hooper —
  chapter 5 closer." He's the side-show antagonist who tries
  to disrupt the family council. The player has to push him
  out of the church.
- **The character unlock:** Baby Momma unlocks as a playable
  rival portrait at the finale. She's the heart of the season
  and the chapter's emotional center. Her unlock is dramatic,
  not quiet — she drops the kid bombshell and the player earns
  her by hearing it.

---

## 6. Scene-by-scene index

The 8 scene files for this chapter live next to this file:

```
chapters/old-heads-know/
├── chapter-5-old-heads-know.md       (this file)
├── scenes/
│   ├── 01-the-old-heads-convene.md
│   ├── 02-baby-mommas-truth.md
│   ├── 03-wifeys-stand.md
│   ├── 04-church-aunties-blessing.md
│   ├── 05-alleys-confession.md
│   ├── 06-hooper-closes.md
│   ├── 07-og-uncles-verdict.md
│   └── 08-the-family-blessed.md
```

Each scene file uses the `TEMPLATE.scene.md` format. The dialogue
and camera path values are filled in from the engine's
`oldHeadsKnowChapter.preDialogue` / `postDialogue` arrays, and
the parallax scene ids map to entries in `parallaxScenes.ts`.

---

## 7. Open production flags (not blocking, but owed)

- **Character bibles still owed for this chapter's cast:**
  `baby-momma` (corner boss, bible is one of the four worked
  examples — DONE), `wifey`, `ganger-red`, `church-auntie`,
  `hooper`, `alley-runner`, `cornball`. Baby Momma's bible is
  present; the rest are still owed.
- **CHARACTER_ROSTER entries** for `hooper` are presumed present
  from the engine pass; if missing, the engine-side roster
  update is a separate ticket.
- **Parallax art** for the 7 unique scenes (og-uncle's-room,
  family-council, baby-momma-truth, wifey-stand, church-blessing,
  alley-confession, hooper-close, og-uncle-verdict) is a
  director handoff, not a writer deliverable.