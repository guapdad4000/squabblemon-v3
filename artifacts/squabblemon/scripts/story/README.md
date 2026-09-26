# Story Mode — editorial library

Season One Chapters 1–8 now use the [complete dialogue rewrite](rewrites/season-one/READTHROUGH.md): 626 spoken lines across the same 62 nodes and 51 battles. Other seasons are unchanged.

## Authority and editing

1. The [story bible](STORY_BIBLE.md) governs the family relationships, timeline and ending.
2. [READTHROUGH.md](rewrites/season-one/READTHROUGH.md) is the current Season One spoken screenplay. Earlier chapter scripts and expansion modules are historical references.
3. `lib/squabblemon-engine/src/story.ts` remains authoritative for encounters, rewards, scene art and save identities.

After editing the read-through, run `node scripts/compile-season-one-screenplay.mjs` from the repository root. It generates `lib/squabblemon-engine/src/storyChapters/seasonOneRewrite.json`; `--check` verifies it is current. `rewriteSeasonOne` replaces dialogue only and resolves speakers to their existing portraits. No new visual assets are required.

Use `storyDialogueToken`, never hardcode its format. Rewritten Season One lines use `script-v4`; other seasons retain `script-v3`. This intentionally prevents old positional read markers from skipping newly written lines. Completed nodes, battle clears and reward identities remain unchanged. Historical append-only expansion tests cover the archived expansion, not the current spoken script.

The rewrite establishes the player’s tournament goal, explains the family relationships before the arguments, and gives each match a stated role. The return leads to Red’s hidden message, then OG’s admission, the warehouse recording and the family confrontation. Blue’s fear of being displaced leads to his later cheating and disqualification. The ending offers a first parenting commitment, not instant forgiveness.

Optional defeat and phase cues still require separate integration. Existing video handoffs are frozen and do not automatically contain this rewrite. No new VO has been generated or verified for these lines.

## Puzzles and progress

Puzzles remain non-battle nodes with an additional server-validated completion step. Dialogue is saved first; submitting the authored order or explicitly bypassing the puzzle completes its story node and grants only its configured reward. Ordinary non-battle completion refuses puzzle nodes. Retries use the same profile lock and idempotent reward identities as the rest of story mode.

`/game/story` opens the theater, `?season=<id>` opens the matching chapter map, and a `?node=<id>` deep link takes priority so returning from battle does not repeatedly force the theater. Season Two starts after `the-crown`; Sherlock starts after `block-party` and never gates the main seasons.

Run `pnpm --filter @workspace/squabblemon test:story:seasons` for legacy encounter/reward compatibility, authored dialogue-prefix preservation, season membership, puzzle contracts and shipped-art checks.

## Draft provenance

The [MiniMax draft archive](sources/minimax-2026-09-17/chapters), old chapter read-throughs and expansion modules remain historical source material. The September 26 rewrite replaces their spoken Season One dialogue while preserving implemented scenes and mechanics. The Chapter One video-agent ZIP remains frozen at its previously delivered version.

## Review and validation

Open `/e2e/season-one-readthrough.fixture.html` on the development server to review every section in the existing StoryStage presentation without a login or battle. This development fixture does not write campaign progress and is not part of the production route.

Run `pnpm --filter @workspace/squabblemon test:story:seasons` with Node 24 to check source/generated parity, all scene coverage, shipped portraits, versioned read markers, campaign compatibility and existing story tests. With the dev server on port 4207, `node artifacts/squabblemon/e2e/verify-season-one-rewrite.mjs` checks the longest line in every section at 375×667, 390×844 and 1440×900, plus navigation and runtime errors. These checks verify integration and readability; editorial quality still benefits from a human play-through.
