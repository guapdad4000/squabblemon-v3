# Chapter One: Block Party

Heightened comedy-drama revision, 2026-09-08. **Not yet integrated into the playable dialogue.**

Read the whole chapter: [Chapter One read-through](CHAPTER_ONE_READTHROUGH.md). Canon: [story bible](../../STORY_BIBLE.md). Technical handoff: [integration checklist](../../INTEGRATION_HANDOFF.md).

## 0. Identity

```yaml
id: block-party
order: 1
title: "Chapter One: Block Party"
subtitle: "Take the block, keep the receipts."
description: "A neighborhood rivalry turns into a public test of your crew."
mapAssetId: assets/story/chapter-one/environments/map.webp
format: long-form
```

One evening, from corner-store registration to the rooftop ceremony. Six required battles, one optional mastery battle, one reward scene. The engine's existing encounter structure is preserved.

## 1. Dramatic spine

The player arrives seeking a place in an Open. Blue tests whether someone outside his crew deserves access; Red tests whether their success can withstand scrutiny. Winning earns the player an independent place in the final and ultimately the power to schedule open play. Each opponent must acknowledge an earned concession.

Around that climb, a memorial program and Red's evasions prepare the public return of Cracked Head. His reappearance exposes a wound the Crown cannot repair. The player defeats his claim to automatic authority while the family begins a harder argument about absence. Baby Momma demands a conversation without cameras. Red produces the message he should have delivered four years ago.

## 2. Cast

| Character | Scenes | Dramatic function |
| --- | --- | --- |
| Ganger Blue | 1, 2, 4, 7, 8 | Gatekeeper, working organizer, younger brother confronting the return. |
| Ganger Red | 3, 4, 6, 7, 8 | Rival who demands full records but has concealed one himself. |
| Cracked Head | 7, 8 | Returning champion whose old authority must face a new winner. |
| Snitch | 3, 6, 7, 8 | Makes public conflict profitable; cannot dictate every private boundary. |
| Wifey | 2, 8 | Names shared labor and turns the win into an open schedule. |
| Cornball | 1, 5, 8 | Defends the Open's promise and provides grounded comedy. |
| Alley Runner | 5, optional | Represents independent crews and offers a fair mastery match. |
| Baby Momma | 8 | Refuses a public reunion as a substitute for accountability. |

Play the chapter as oversized neighborhood comedy colliding with a family reckoning: folding-chair royalty, a vending-machine investigation, air-fryer journalism, an entrance with malfunctioning music, and a ceremony Baby Momma takes over. OG Uncle is established in the season bible, not a speaking cameo here. Other neighbors may fill crowd layers without new dialogue. All eight speakers have character bibles.

## 3. Nodes and scene index

| Scene | Type | Prerequisite | Position | Script |
| --- | --- | --- | --- | --- |
| 1. Welcome to the Block | guided | None | 8, 76 | [Scene 1](scenes/01-welcome-to-the-block.md) |
| 2. Blue Side Pressure | standard | welcome-to-the-block | 23, 62 | [Scene 2](scenes/02-blue-side-pressure.md) |
| 3. Receipts on Camera | rule-twist | blue-side-pressure | 40, 54 | [Scene 3](scenes/03-receipts-on-camera.md) |
| 4. Red Side Retaliation | standard | receipts-on-camera | 57, 42 | [Scene 4](scenes/04-red-side-retaliation.md) |
| 5. Side Alley Challenge | standard (optional) | blue-side-pressure | 52, 76 | [Scene 5](scenes/05-side-alley-challenge.md) |
| 6. Snitch at the Corner | mini-boss | red-side-retaliation | 72, 31 | [Scene 6](scenes/06-snitch-at-the-corner.md) |
| 7. Cracked Head Takes the Block | boss | snitch-at-the-corner | 88, 16 | [Scene 7](scenes/07-cracked-head-takes-the-block.md) |
| 8. Block Crowned | reward | cracked-head-takes-the-block | 94, 5 | [Scene 8](scenes/08-block-crowned.md) |

Required route: **1 → 2 → 3 → 4 → 6 → 7 → 8**. Scene 5 branches from Scene 2 and can be played later, including after completion. It never gates the story and assumes no main-route outcome.

The final opponent is Cracked Head. The memorial describes what Blue believed, not an objective death. Red knows of survival but not the return date. Snitch knows an entrance was arranged but not the rescue history.

## 4. Rewards ledger — existing game contract

| Source | Reward |
| --- | --- |
| Required battles 1, 2, 3, 4, 6, 7 | 50 + 75 + 100 + 125 + 175 + 250 = 775 street-xp |
| Optional battle 5 | side-alley-tagged-cardback ×1 |
| Seven first perfect battle clears | Up to seven Street Pack Tickets, one per battle |
| Ceremony | nerd card ×1; Street Pack Ticket ×1; block-party-crowned cosmetic ×1; story-key:chapter-two ×1 |

A first perfect run including the optional match yields **eight tickets**. Character unlocks are not configured and are not promised by this screenplay. The Nerd card is an event prize, not a character pulled out of Cracked Head's deck. A key reward does not mean Chapter Two is currently playable.

## 5. Setup, payoff, and pacing

- Open sign obscured by Blue's jacket → shared schedule displayed at the ceremony.
- Blue claims the lights → Wifey corrects his ownership language → Blue volunteers to bring lights after losing.
- Red demands an uncut match → conceals a message → finally offers it to Baby Momma.
- Memorial program identifies Blue's brother → the rooftop return lands on Blue's reaction before the stream.
- Cornball negotiates with the vending machine → optional route supplies a practical solution and an unsweetened sparkling-water anticlimax. Required ending remains valid without it.
- “I'll be back at the table” promises a future challenge, not a later revelation that Cracked Head is alive.

There are 106 main-route/optional-route authored dialogue cards across the eight scene files, plus seven optional defeat cards and three optional phase lines. Here “main dialogue” means pre-battle, victory, and ceremony text; it includes the optional alley's normal exchange. The required route alone has 95 cards. Read at player pace, with short establishing shots and pauses at the memorial, return, and private-conversation boundary.

## 6. Editorial completion

All eight scenes are written. All speaking characters have voice and continuity notes. Main-route clues survive skipping the alley. Pre-battle dialogue no longer congratulates the player for an unplayed match. Any legal boss win gets the same canonical ending. The ending sets up Red Side Tapes without an unimplemented Chapter Two availability claim.

Production remains: dialogue integration, three new Chapter 1 roster entries, asset/cue alignment, saved-dialogue migration review, and playthrough verification. See the handoff before treating this draft as shipped.


