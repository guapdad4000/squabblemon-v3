# Multi-season implementation contract

This expansion preserves all Season One chapter IDs, node IDs, encounter rules and reward claim identities. Chapters remain in the existing flat registry; additive season membership groups them for navigation. Chapter order stays globally unique. New IDs use hyphens, not colons.

## Engine

- `story.ts` re-exports `storySeasons`, `getStorySeason`, `getStorySeasonForChapter`, `StorySeasonDefinition`, `StoryPuzzleDefinition`, `isStoryPuzzleSolution`.
- A non-battle node may have `puzzle?: StoryPuzzleDefinition`. It retains `scenes` and its existing node kind. Puzzle completion MUST be refused by the ordinary non-battle endpoint.
- A puzzle contains `id,title,instruction,imageAssetId,pieces:[{id,label,detail}],solution:string[],hints:string[],solvedText,skipText`. Its order is validated by the server. Bypass is explicit and grants only the same authored story reward, never a bonus.
- Season Two module exports `seasonTwoChapters: readonly StoryChapter[]`. Eight chapter IDs are listed in `storySeasons.ts`, orders 9–16; first requires `the-crown`.
- Guest module exports `specialPresentationChapters: readonly StoryChapter[]`. Three Sherlock chapter IDs are listed in `storySeasons.ts`, orders 17–19; first requires `block-party`.
- Season One dialogue module exports `expandSeasonOneDialogue(chapters: readonly StoryChapter[]): readonly StoryChapter[]`. Append uniquely authored lines to selected existing sections, never reorder/replace existing lines, change encounters, or change rewards. Existing array-position dialogue tokens remain valid.

## API

Add optional `seasons` to StoryCampaign. Each summary includes metadata plus `status` (locked/available/cleared), `recommendedNodeId` (nullable), `starsEarned`, `starsAvailable`, `clearedNodes`, `totalNodes`. Compute from authoritative chapter/node statuses; legacy responses remain valid.

Add `POST /api/player/story/puzzle` with operationId `completePlayerStoryPuzzle`. Body: `{nodeId:string,idempotencyKey:string,order?:string[],skip?:boolean,dialogueSeen?:string[]}`. Return the same shape as `completePlayerStoryNode`, plus `resolution: "solved" | "skipped"`. Authenticate identically to existing story actions; atomically lock the player profile, check availability, validate solution or explicit skip, persist completion and grant once. Reject ordinary completion for puzzle nodes. No new database or new auth system.

## Frontend

The existing `/game/story` gains the theater entrance. `?season=<id>` opens that season's existing chapter map; `?node=<id>` wins over season selection and resumes the correct chapter after battles. Do not force theater between battles. Theater must show all three real presentations, with truthful locks/progress and a Continue Story action. Keep selection user-scoped or URL-based.

Use the generated `useCompletePlayerStoryPuzzle` and existing bootstrap/story cache invalidations for puzzle completion. UI must show instructions, reorderable illustrated evidence pieces with mouse/touch and keyboard/button alternatives, hints, submit/error/retry, explicit bypass, saved completed state and reward result. Enter this screen after puzzle scene dialogue and before ordinary completion. Pass node identity explicitly to StoryStage instead of parsing it from a dialogue token.

## Art

Main agent supplies optimized assets under public/assets/story/theater:
`theater.webp`, `curtain-left.webp`, `curtain-right.webp`, `season-one.webp`, `season-two.webp`, `sherlock.webp`, `rooftop.webp`, `evidence.webp`.

Use generated art rather than generic dashboard UI. Full-height red side curtains, a beam originating bottom-center, pointer/touch aiming and selected-poster illumination. Preserve native scrolling, keyboard focus, reduced-motion settings, mobile safe areas and existing dedicated soundtracks.

## Ownership

Main: engine integration, season/puzzle contracts above, image generation/optimization, asset checks and end-to-end verification.
Content worker: seasonTwo.ts and its own supporting content files.
Guest/dialogue worker: storySpecials.ts, seasonOneDialogueExpansion.ts and editorial docs.
Backend worker: API spec/codegen, API service/routes/transactions/tests.
Design worker: game frontend components/styles/routes and local tests.