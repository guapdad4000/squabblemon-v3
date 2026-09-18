# CHAPTER 3 — `blue-side-blues` (Blue Side Blues)

> The third chapter. Compact-ticket: 3 standard battles, 3 tickets
> on a perfect run. The chapter's 3rd battle doubles as the finale.
> OG Uncle is sick; Ganger Blue won't visit. Wifey makes him go.
> Finale payout: +1 character unlock (OG Uncle), +1 chapter key.
> Total ticket payout on first perfect run: 3.

---

## 0. Identity

```yaml
id: blue-side-blues
order: 3
title: "Chapter Three: Blue Side Blues"
subtitle: "Two districts. He only needed one."
description: |
  OG Uncle is sick at the corner hospital. Ganger Blue won't
  visit. Wifey makes him go. Three battles, three secrets, three
  tickets. The block finds out what Blue's been holding.
mapAssetId: assets/story/chapter-three/environments/map.webp
format: compact-ticket
```

---

## 1. Beat sheet

```yaml
beats:
  - "Blue in Denial — Blue won't go to the hospital. He's afraid of what OG Uncle knows."
  - "Wifey's Push — Wifey forces the issue. The player helps her make Blue go."
  - "OG Uncle's Bedside — OG Uncle shares the truth: Cracked Head is alive. Three secrets, three tickets, one chapter key."
```

---

## 2. Cast (this chapter)

```yaml
cast:
  - { id: ganger-blue, role: lead-rival, scenes: [blue-in-denial, wifeys-push, og-uncles-bedside] }
  - { id: wifey, role: supporting-rival, scenes: [blue-in-denial, wifeys-push, og-uncles-bedside] }
  - { id: og-uncle, role: chapter-boss, scenes: [og-uncles-bedside] }   # OG Uncle unlocks here as a rival
  - { id: cornball, role: cameo, scenes: [blue-in-denial] }   # comic-relief cameo only
  - { id: baby-momma, role: cameo, scenes: [og-uncles-bedside] }   # waiting in the hallway
```

---

## 3. Nodes

```yaml
nodes:
  - id: blue-in-denial
    kind: battle
    battleType: standard
    mapPosition: { x: 20, y: 65 }
    prerequisites: []
    optional: false
    scene: scenes/01-blue-in-denial.md
  - id: wifeys-push
    kind: battle
    battleType: standard
    mapPosition: { x: 50, y: 45 }
    prerequisites: [blue-in-denial]
    optional: false
    scene: scenes/02-wifeys-push.md
  - id: og-uncles-bedside
    kind: reward                  # doubles as the chapter finale
    mapPosition: { x: 78, y: 25 }
    prerequisites: [wifeys-push]
    optional: false
    scene: scenes/03-og-uncles-bedside.md
```

---

## 4. Rewards ledger

```yaml
ledger:
  battles: 3                          # 3 nodes total: 2 standard battles + 1 finale encounter
  perfectTicketPayout: 2              # auto-granted from scenes 01 + 02 (3-star clears)
  finalePayout:
    pack-ticket: 1                    # explicit finale ticket — this is the 3rd of 3
    character-unlock:
      - og-uncle                      # OG Uncle unlocks as a playable rival at finale
    chapter-key:
      - story-key:chapter-four
    # NOTE: total tickets on first perfect run = 2 (auto) + 1 (finale) = 3.
```

---

## 5. Drama notes

- **The reveal:** OG Uncle tells Blue — and the player — that
  Cracked Head is alive. Witness protection. OG Uncle tipped the
  feds. Blue's "denial" in scene 01 isn't denial about the
  hospital — it's denial that his brother might have been saved
  without him knowing. The reveal at OG Uncle's bedside is the
  setup for chapter 5 (Old Heads Know) where the truth comes out
  more broadly.
- **The setup:** Wifey's "You owe him this" line in scene 02 is
  the push. The player helps her make Blue go. The mechanics
  reinforce this: in scene 02 the player fights alongside Wifey
  (`allyWifey: true`) rather than against her.
- **The callback:** OG Uncle's bedside line "Two districts. He
  only needed one." echoes the season's first recurring line from
  chapter 1 (Ganger Blue's "Two districts. Don't make me say it
  twice"). Chapter 8's "Zero districts. That's what you get for
  snitching." closes the loop.
- **The character unlock:** OG Uncle unlocks as a playable rival
  portrait at the bedside. He's the third corner boss to unlock
  (after Cracked Head in chapter 1 and — coming up — Baby Momma
  in chapter 2). His unlock is quiet, not dramatic; the reveal
  carries the drama.
- **The baby:** Baby Momma is waiting in the hallway. She
  doesn't speak in this chapter. Her presence is a setup for
  chapter 5's "Baby Momma drops the kid bombshell" beat.

---

## 6. Scene-by-scene index

The 3 scene files for this chapter live next to this file:

```
chapters/blue-side-blues/
├── chapter-3-blue-side-blues.md       (this file)
├── scenes/
│   ├── 01-blue-in-denial.md
│   ├── 02-wifeys-push.md
│   └── 03-og-uncles-bedside.md
```

Each scene file uses the `TEMPLATE.scene.md` format. The third
scene (og-uncles-bedside) doubles as the finale — it includes the
reward ceremony block instead of a battle block.

---

## 7. Open production flags (not blocking, but owed)

- **Character bible for OG Uncle** is already present (one of the
  four corner-boss worked examples).
- **Character bibles still owed:** wifey (appears here in a major
  role), cornball (cameo, may already be implicit).
- **CHARACTER_ROSTER** entries for wifey are presumed present
  from the engine pass; the bible is the missing piece.
- **Parallax art** for the 2 unique scenes (ganger-blue's flat,
  hospital-corridor, og-uncle's-room) is a director handoff.