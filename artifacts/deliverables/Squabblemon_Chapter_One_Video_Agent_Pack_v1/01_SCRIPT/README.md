# Story Mode — editorial library

Heightened comedy-drama revision, 2026-09-08. Start with the [story bible](STORY_BIBLE.md) and [Chapter One read-through](chapters/block-party/CHAPTER_ONE_READTHROUGH.md).

## Current writing

| Deliverable | Status |
| --- | --- |
| Story bible | Revised canon: timeline, family tree, player motivation, reveal order, ending, setup/payoff ledger. |
| Season One outline | Revised eight-chapter plan; Chapters 2–8 are not full scripts or playable content. |
| Chapter One | Eight complete scenes, 106 normal dialogue lines, seven optional defeat lines, three optional boss phase lines. |
| Character bibles | Nine: Blue, Red, Cracked Head, Baby Momma, OG Uncle, Snitch, Wifey, Cornball, Alley Runner. |
| Stage instructions | Proposed staging and camera briefs, not certified production art. |

The [chapter index](chapters/block-party/chapter-1-block-party.md) links every scene and its mechanical contract. The [integration handoff](INTEGRATION_HANDOFF.md) separates finished writing from remaining game/art work. The [season outline](season-1/season-arc.md) follows the revised bible.

## Authority

1. STORY_BIBLE.md governs narrative continuity.
2. Revised character bibles govern voice and knowledge.
3. The chapter index and scene scripts govern the Chapter One screenplay.
4. lib/squabblemon-engine/src/story.ts remains the authority for currently implemented encounters and rewards.
5. Templates are blank authoring aids, not evidence of implemented features.

Markdown is not consumed automatically by the game. Its richer dialogue must be integrated deliberately. The current game contains one chapter, six roster entries, and 15 brief story lines. A 40-plus cast is an expansion ambition, not the shipped story roster. VENUE_BY_ID is currently empty; existing venue image files do not constitute a populated story venue registry.

## Scene format

Each scene has stage directions, a proposed layer/camera brief, ordered dialogue, an encounter reference, and director notes. The encounter reference incorporates the current engine node rather than duplicating decks and numeric rules in a second source. Stage directions are not spoken dialogue.

Use tokens node-id:pre:index and node-id:post:index for battle lines, and node-id:main:index for dialogue/reward nodes, matching the current Story.tsx derivation. StoryDialogueLine itself has no token property. Optional defeat and phase cues need separate integration; they are not currently supported by simply inserting them in an array.

New speakers need an existing portrait or an explicit placeholder and a roster entry. Never equate owning a card with unlocking its story portrait. Add no promised character-unlock or chapter availability unless the actual content and reward configuration support it.

## Next writing work

Write Red Side Tapes from the revised outline after Chapter One review. Complete its specific encounter purposes and reward design before promising a fixed scene count. Expand the remaining cast only as scenes need them. Avoid producing dozens of interchangeable bibles before the central relationships are coherent.

