# CHAPTER 6 — `the-function` (The Function)

> The sixth chapter. Compact-ticket: 3 standard battles + 1
> reward ceremony (no battle). 3 tickets on a perfect run
> (3 auto-granted from battles). The party before the war —
> everyone who's still alive is in the room. Bottle Girl runs
> the bar. Live Streamer narrates. Promoter books the return
> fight. The party ends with Cracked Head walking in.

---

## 0. Identity

```yaml
id: the-function
order: 6
title: "Chapter Six: The Function"
subtitle: "Everybody's in the room."
description: |
  The function before the war. Bottle Girl runs the bar.
  Live Streamer narrates the season. Promoter books the
  return fight. The whole block is here. The party ends
  with Cracked Head walking in.
mapAssetId: assets/story/chapter-six/environments/map.webp
format: compact-ticket
```

---

## 1. Beat sheet

```yaml
beats:
  - "The Function — Bottle Girl opens the bar. Live Streamer starts narrating. The whole block is here."
  - "The Bar Fight — A fight breaks out at the function. Bottle Girl runs the bar AND the bouncer."
  - "The Booking — Promoter books the return fight. Cracked Head vs Blue. Chapter seven's premise is set."
  - "Cracked Head Walks In — He's alive. He's here. The function goes quiet."
```

---

## 2. Cast (this chapter)

```yaml
cast:
  - { id: bottle-girl, role: lead-rival, scenes: [the-function, the-bar-fight, the-booking, cracked-head-walks-in] }
  - { id: live-streamer, role: narrator, scenes: [the-function, the-bar-fight, the-booking, cracked-head-walks-in] }   # add to CHARACTER_ROSTER first
  - { id: promoter, role: cameo, scenes: [the-booking, cracked-head-walks-in] }   # add to CHARACTER_ROSTER first
  - { id: cracked-head, role: finale, scenes: [cracked-head-walks-in] }   # the surprise entrance
  - { id: cornball, role: comic-cameo, scenes: [the-function, cracked-head-walks-in] }
  - { id: baby-momma, role: cameo, scenes: [the-bar-fight, cracked-head-walks-in] }   # pregnant, watching
  - { id: alley-runner, role: cameo, scenes: [the-bar-fight] }
  - { id: ganger-blue, role: cameo, scenes: [cracked-head-walks-in] }
  - { id: wifey, role: cameo, scenes: [cracked-head-walks-in] }
  - { id: og-uncle, role: cameo, scenes: [the-function, cracked-head-walks-in] }   # still standing, wheelchair from Ch7
  - { id: ganger-red, role: cameo, scenes: [the-function, cracked-head-walks-in] }
  - { id: snitch, role: cameo, scenes: [the-booking, cracked-head-walks-in] }
```

---

## 3. Nodes

```yaml
nodes:
  - id: the-function
    kind: battle
    battleType: guided
    mapPosition: { x: 20, y: 65 }
    prerequisites: []
    optional: false
    scene: scenes/01-the-function.md
  - id: the-bar-fight
    kind: battle
    battleType: standard
    mapPosition: { x: 50, y: 45 }
    prerequisites: [the-function]
    optional: false
    scene: scenes/02-the-bar-fight.md
  - id: the-booking
    kind: battle
    battleType: standard
    mapPosition: { x: 78, y: 25 }
    prerequisites: [the-bar-fight]
    optional: false
    scene: scenes/03-the-booking.md
  - id: cracked-head-walks-in
    kind: reward                  # doubles as the chapter finale — NO battle, just the reveal
    mapPosition: { x: 95, y: 8 }
    prerequisites: [the-booking]
    optional: false
    scene: scenes/04-cracked-head-walks-in.md
```

---

## 4. Rewards ledger

```yaml
ledger:
  battles: 3                          # 3 standard battles (no boss — the season arc says "—")
  perfectTicketPayout: 3              # auto-granted from scenes 01, 02, 03 (3-star clears)
  finalePayout:
    # NOTE: NO pack-ticket at finale — the 3 battle tickets ARE the chapter total.
    character-unlock:
      - bottle-girl                   # Bottle Girl unlocks as a playable rival at finale
    chapter-key:
      - story-key:chapter-seven
    card:
      - the-function                  # a card representing the night of the function — when Cracked Head walked in
```

---

## 5. Drama notes

- **The party:** Every character who's still standing is in
  the room. This is the season's biggest cast moment — the
  function is the gathering before the war. Live Streamer
  narrates the whole thing; the player meets them all.
- **Bottle Girl's role:** She runs the bar AND the bouncer.
  She's a corner boss in her own right. Her unlock at the
  finale is the chapter's character-unlock beat — she's
  earned it by hosting the function.
- **Promoter's role:** He books the return fight. Cracked
  Head vs Blue. Chapter 7's premise is locked in here.
  Promoter doesn't fight (he's the booking authority), but
  his appearance sets up the next chapter.
- **The Cracked Head entrance:** He walks in. The function
  goes quiet. He's alive. He's been alive the whole time.
  This is the season's BIGGEST dramatic moment — Cracked
  Head returns in person, not on a tape or in a testimony.
  Per the resolved-decision log: he's alive in witness
  protection; he walks in at the function's end.
- **OG Uncle's presence:** Per the resolved-decision log,
  OG Uncle is in a wheelchair from chapter 7 onward. He's
  still standing here (ch6). He sees Cracked Head walk in.
  The moment is between them.
- **The card drop:** `the-function` is the season's fourth
  clue card. Joins `the-block` (Ch2), `the-real-receipts`
  (Ch4), and `the-kid` (Ch5). The card's flavor text
  references the night of the function.
- **Live Streamer as narrator:** Live Streamer is the chapter's
  meta-presence — he's recording the function. His narration
  is the runtime's narrator voice for this chapter. Per the
  season arc character list: "Live Streamer — narrates the
  season."

---

## 6. Scene-by-scene index

The 4 scene files for this chapter live next to this file:

```
chapters/the-function/
├── chapter-6-the-function.md       (this file)
├── scenes/
│   ├── 01-the-function.md
│   ├── 02-the-bar-fight.md
│   ├── 03-the-booking.md
│   └── 04-cracked-head-walks-in.md
```

Each scene file uses the `TEMPLATE.scene.md` format. Scene 04
is a `kind: reward` node with no battle block — just the
ceremony.

---

## 7. Open production flags (not blocking, but owed)

- **Character bibles still owed for this chapter's cast:**
  `bottle-girl`, `live-streamer`, `promoter`. Cracked Head
  has a corner-boss bible (DONE). Most other cast members
  are cameos only.
- **CHARACTER_ROSTER entries** for `bottle-girl`,
  `live-streamer`, `promoter` are presumed present from the
  engine pass; if missing, the engine-side roster update is a
  separate ticket.
- **Parallax art** for the 4 unique scenes (function-venue,
  bar, booking-desk, cracked-head-entrance) is a director
  handoff, not a writer deliverable.