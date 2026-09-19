# Story Mode — editorial library

The local playable campaign is defined in `lib/squabblemon-engine/src/story.ts` and `seasonChapters.ts`. All eight chapters are loaded there: 62 nodes, including 51 card battles. Start with the [story bible](STORY_BIBLE.md) and [Chapter One read-through](chapters/block-party/CHAPTER_ONE_READTHROUGH.md).

## Current writing

| Deliverable | Status |
| --- | --- |
| Story bible | Revised canon: timeline, family tree, player motivation, reveal order, ending, setup/payoff ledger. |
| Season One outline | Revised eight-chapter plan; Chapter 8 is now playable. |
| Chapter One | Eight complete scenes, 106 normal dialogue lines, seven optional defeat lines, three optional boss phase lines. |
| Chapter Two | [Red Side Tapes](chapters/red-side-tapes/CHAPTER_TWO_READTHROUGH.md): nine authored scenes, six original fights, 158 normal lines. The local game adds an optional courier table and a finale ticket. |
| Chapters Three–Seven | Playable local chapters adapted from the [MiniMax September 17 screenplay](sources/minimax-2026-09-17/chapters) to the revised story bible. |
| Chapter Eight | Playable nine-battle conclusion written from the revised bible; the MiniMax checkout contained no Chapter Eight script. |
| Character bibles | Eleven: the original nine plus All Jokes Roaster and Church Auntie. |
| Stage instructions | Proposed staging and camera briefs, not certified production art. |

The [chapter index](chapters/block-party/chapter-1-block-party.md) links every scene and its mechanical contract. The [integration handoff](INTEGRATION_HANDOFF.md) separates finished writing from remaining game/art work. The [season outline](season-1/season-arc.md) follows the revised bible.

## Authority

1. STORY_BIBLE.md governs narrative continuity.
2. Revised character bibles govern voice and knowledge.
3. The chapter index and scene scripts govern their respective chapter screenplays.
4. lib/squabblemon-engine/src/story.ts remains the authority for currently implemented encounters and rewards.
5. Templates are blank authoring aids, not evidence of implemented features.

Markdown is not consumed automatically by the game. The local game now contains eight chapters. Chapter One uses the full 106-line screenplay and a 2D stage. Chapter Two's full dialogue and encounters are loaded from the authored JSON, with decks filled to the engine's current ten-card rule. Chapters Three–Seven use reconciled dialogue and supported battle mechanics. Chapter Eight closes the Crown story and grants its final reward. New maps, scene art and expressions can replace the existing venue and layered-art fallbacks without changing node IDs or progress. VENUE_BY_ID remains empty; the playable route uses existing venue art directly.

## Scene format

Each scene has stage directions, a proposed layer/camera brief, ordered dialogue, an encounter reference, and director notes. The encounter reference incorporates the current engine node rather than duplicating decks and numeric rules in a second source. Stage directions are not spoken dialogue.

Use tokens node-id:pre:index and node-id:post:index for battle lines, and node-id:main:index for dialogue/reward nodes, matching the current Story.tsx derivation. StoryDialogueLine itself has no token property. Optional defeat and phase cues need separate integration; they are not currently supported by simply inserting them in an array.

New speakers need an existing portrait or an explicit placeholder and a roster entry. Never equate owning a card with unlocking its story portrait. Add no promised character-unlock or chapter availability unless the actual content and reward configuration support it.

## Draft provenance

The [MiniMax draft archive](sources/minimax-2026-09-17/chapters) is preserved as source material, not executable content. Its later survival reveal, second pregnancy and unsupported battle flags conflict with the playable Chapter One and revised bible, so Chapters Three–Seven retain its locations, opponents and comedy while following the revised canon. Chapter Seven now opens the final route, and Chapter Eight ends at the community meal and rooftop sale agreement. The Chapter One video-agent ZIP remains frozen at the version already handed off.

