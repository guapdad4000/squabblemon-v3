# Story Mode — editorial library

The local playable campaign is assembled in `lib/squabblemon-engine/src/story.ts`. It contains 19 chapters across two seasons and a special presentation: 119 nodes, including 81 card battles and four illustrated evidence-order puzzles. Season One's original 62 nodes and 51 battles retain their save and reward identities. Start with the [story bible](STORY_BIBLE.md) and [Chapter One read-through](chapters/block-party/CHAPTER_ONE_READTHROUGH.md).

## Current writing

| Deliverable | Status |
| --- | --- |
| Story bible | Revised canon: timeline, family tree, player motivation, reveal order, ending, setup/payoff ledger. |
| Season One outline | Revised eight-chapter plan; Chapter 8 is now playable. |
| Chapter One | Eight complete scenes, 106 normal dialogue lines, seven optional defeat lines, three optional boss phase lines. |
| Chapter Two | [Red Side Tapes](chapters/red-side-tapes/CHAPTER_TWO_READTHROUGH.md): nine authored scenes, six original fights, 158 normal lines. The local game adds an optional courier table and a finale ticket. |
| Chapters Three–Eight | Playable local chapters adapted from the [MiniMax September 17 screenplay](sources/minimax-2026-09-17/chapters) to the revised story bible; every battle has authored setup and aftermath cards, and 12 selected exchanges have 60 appended lines without moving the original dialogue tokens. |
| Chapter Eight | Playable nine-battle conclusion written from the revised bible; the MiniMax checkout contained no Chapter Eight script. |
| Character bibles | Eleven: the original nine plus All Jokes Roaster and Church Auntie. |
| Stage instructions | Proposed staging and camera briefs, not certified production art. |
| Season Two | Eight executable chapters, 43 nodes, 24 battles, three puzzles, and 366 dialogue lines. See the [Season Two bible](../../../../docs/season-two-story-bible.md). |
| The Missing Motion | Three Sherlock guest chapters, 14 nodes, six battles, one puzzle, and 55 dialogue lines. Available after the first Season One chapter. |
| Theater entrance | Illustrated presentation posters, red curtain cutouts, bottom-origin spotlight, truthful progress/locks, and a direct Continue Story route. |

The [chapter index](chapters/block-party/chapter-1-block-party.md) links every scene and its mechanical contract. The [integration handoff](INTEGRATION_HANDOFF.md) separates finished writing from remaining game/art work. The [season outline](season-1/season-arc.md) follows the revised bible.

## Authority

1. STORY_BIBLE.md governs narrative continuity.
2. Revised character bibles govern voice and knowledge.
3. The chapter index and scene scripts govern their respective chapter screenplays.
4. lib/squabblemon-engine/src/story.ts remains the authority for currently implemented encounters and rewards.
5. Templates are blank authoring aids, not evidence of implemented features.

Markdown is not consumed automatically by the game. Chapter One uses the full 106-line screenplay and a 2D stage. Chapter Two's full dialogue and encounters are loaded from the authored JSON, with decks filled to the engine's current ten-card rule. Chapters Three–Seven use reconciled dialogue and supported battle mechanics. Chapter Eight closes the Crown story and grants its final reward. Season Two loads from `seasonTwo.ts`/`seasonTwoDialogue.ts`; the guest story loads from `storySpecials.ts`. Season membership is additive metadata above the existing chapter registry, not a replacement save format. New generated theater, poster, rooftop and evidence art lives under `public/assets/story/theater/`; later environments also reuse shipped venue art. VENUE_BY_ID remains empty; the playable route renders StoryStage rather than the unused cinematic prototypes.

## Scene format

Each scene has stage directions, a proposed layer/camera brief, ordered dialogue, an encounter reference, and director notes. The encounter reference incorporates the current engine node rather than duplicating decks and numeric rules in a second source. Stage directions are not spoken dialogue. The executable Chapters Three–Eight cards are authored in `seasonChapters.ts`; battles do not use a generic post-match fallback.

Use the shared `storyDialogueToken` helper: `node-id:script-v3:section:index`. StoryDialogueLine itself has no token property. Append Season One expansion lines rather than reordering existing lines, so saved positional tokens remain meaningful. Optional defeat and phase cues need separate integration; they are not currently supported by simply inserting them in an array.

New speakers need an existing portrait or an explicit placeholder and a roster entry. Never equate owning a card with unlocking its story portrait. Add no promised character-unlock or chapter availability unless the actual content and reward configuration support it.

## Puzzles and progress

Puzzles remain non-battle nodes with an additional server-validated completion step. Dialogue is saved first; submitting the authored order or explicitly bypassing the puzzle completes its story node and grants only its configured reward. Ordinary non-battle completion refuses puzzle nodes. Retries use the same profile lock and idempotent reward identities as the rest of story mode.

`/game/story` opens the theater, `?season=<id>` opens the matching chapter map, and a `?node=<id>` deep link takes priority so returning from battle does not repeatedly force the theater. Season Two starts after `the-crown`; Sherlock starts after `block-party` and never gates the main seasons.

Run `pnpm --filter @workspace/squabblemon test:story:seasons` for legacy encounter/reward compatibility, authored dialogue-prefix preservation, season membership, puzzle contracts and shipped-art checks.

## Draft provenance

The [MiniMax draft archive](sources/minimax-2026-09-17/chapters) is preserved as source material, not executable content. Its later survival reveal, second pregnancy and unsupported battle flags conflict with the playable Chapter One and revised bible, so Chapters Three–Seven retain its locations, opponents and comedy while following the revised canon. Chapter Seven now opens the final route, and Chapter Eight ends at the community meal and rooftop sale agreement. The Chapter One video-agent ZIP remains frozen at the version already handed off.

