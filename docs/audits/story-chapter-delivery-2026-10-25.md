# Story chapter delivery — 2026-10-25

Evidence state: source inspected, local checks passed, isolated Chromium fixture passed. Worktree `codex/v2-performance-api`, based on `61e9a86`, with concurrent runtime work present. This is not a deployed-revision, physical-device or real-account journey claim.

## Contract

`lib/squabblemon-engine/src/story.ts` remains the canonical fully validated campaign for the API, rule/reward validation, authoring Studio and test fixtures. None of its content or validation was removed. `generate-story-delivery.ts` evaluates that canonical source, retaining full validation, and serializes 35 exact chapter envelopes plus a lightweight chapter/node/character/rule/dialogue-revision index. The current canonical campaign revision is `8e4acbda84d613544ee5cb47844e539d8885588c6c7c0f551facbc36df8bc226`.

The player Story route imports `src/lib/story/catalog.ts`. Its Vite URL imports refer to external hashed JSON assets; they do not import chapter bodies. The poster theater needs only the index and authoritative campaign progress. A season/map or requested node loads only its chapter. Chapter selection loads that chapter on demand; visited content is reused. There is no speculative campaign-wide prefetch. Full scenes, encounter snapshots, rewards, IDs, prerequisites, puzzles and media references are serialized unchanged. Studio still intentionally loads the complete authoring campaign on its own optional route.

The loader deduplicates concurrent requests, clears rejected requests, validates campaign/chapter revisions and chapter identity before caching, and recursively freezes authored content. It stores no player progress or account state. Obsolete route completions cannot change the current selection. Direct `NodeOverlay` callers hydrate their own chapter using the same cache. Network failures expose retry; incompatible or missing old deployment assets expose reload. Asset URLs come from Vite, retaining configured base paths and hashed deployment identity. Public chapter fetches omit credentials.

An early dynamic-JSON-import implementation failed the real Chromium retry test because the browser cached its rejected module load. The final transport uses `fetch` of hashed external JSON assets; the same interrupted-request test now recovers with Retry without reloading.

## Enforced checks

- `node --import tsx scripts/generate-story-delivery.ts --check` rejects stale/missing/obsolete generated artifacts after full canonical validation.
- `src/lib/story/chapterCatalog.test.ts` compares every complete chapter, character list, rule, venue index and dialogue token with canonical source, plus deduplication, cache reuse, freezing, explicit unknown-node failure, retry, stale rejection and out-of-order loading.
- `node scripts/check-story-delivery.test.mjs` passes 6 delivery-guard regressions.
- `node scripts/check-story-delivery.mjs` rejects eager canonical screenplay or chapter-body imports in the transitive Story route closure. It enforces an 80 KiB index-chunk ceiling and 128 KiB per external chapter ceiling, validates all emitted bodies against their generated input, and requires exact chapter/revision coverage. Existing global entry budgets remain unchanged.

## Local measurements

Direct production Vite build: Node `/usr/bin/node`, port configuration 4193, `BASE_PATH=/`, same worktree source; final log `/tmp/story-delivery-build-final.log`.

| Delivery | Final bytes | Final gzip shown by Vite |
| --- | ---: | ---: |
| Story route chunk | 79.05 kB | 24.28 kB |
| Shared lightweight catalog/index chunk | 65,369 | 15.73 kB |
| Requested Chapter One external JSON | 81.23 kB | 15.97 kB |
| Largest individual chapter | 102,007 | chapter-dependent |
| All shared static Story route dependencies | 1,394,873 | not summed here |

The parent baseline recorded the previously eager full Story catalog at 575.14 kB / 175.09 kB gzip. That catalog is absent from the final player Story closure. The optional full authoring Studio chunk remains 576.12 kB / 174.99 kB gzip. Overall route dependencies still include shared UI and gameplay engine code; chapter splitting does not eliminate those costs.

Focused chapter/presentation/reward-ledger tests pass 25/25. Frontend typecheck and `git diff --check` pass.

`node --import tsx e2e/verify-story-delivery.ts` mounts the real Story surface with synthetic authoritative progress through an isolated Vite fixture. Chromium `/usr/bin/google-chrome`, reduced motion, 390×844 and 1280×900, fresh pages:

- Poster theater requests zero chapter bodies.
- Season entry requests only `block-party`; switching chapters requests only `red-side-tapes`; returning to the first chapter makes no new chapter request.
- A fresh direct node URL for `s2-the-morning-after-evidence` requests only `s2-the-morning-after` and displays its scene.
- An aborted chapter request shows recovery controls; Retry succeeds after the network becomes available, without a reload.
- A stale revision never renders; Reload recovers the current chapter.
- Navigating away during a held request keeps the theater visible after the obsolete request completes.
- No page errors in the phone/desktop navigation cases.

Browser evidence: `/tmp/story-delivery-browser-final.log`, `/tmp/story-delivery-browser.json`, `/tmp/story-delivery-390.png`, `/tmp/story-delivery-1280.png`. Network assertions measure isolated development-fixture chapter requests, while emitted sizes/closure checks measure the production build. They are distinct evidence. Parent integration owns final unified release and production-route verification.

## Existing House playthrough fixture refresh

The unified frontend gate exposed two obsolete House winning transcripts. This is separate from Story delivery. Reconstructing the tracked pre-pass engine from `git HEAD` plus `/tmp/squabble-runtime-overhaul-20261025/before.patch` in `/tmp/story-prior-engine` reproduced the same losses as the current engine, with identical district results for all six old transcripts. Raw `git HEAD` before the preceding CPU-policy changes still won all six. The pre-pass/current engine diff consists of replay structural-sharing wiring; the earlier policy changes are already present in `before.patch`.

Only two lane values in `src/storySquabbleHouse.playthroughs.json` were refreshed:

- Hands on the Clock: round-five Soul Food move 13 uses lane 1 instead of lane 0; the current authoritative replay wins districts 1 (24–19) and 2 (20–0).
- Wet Floor: round-six Cognac move 15 uses lane 0 instead of lane 2; the current authoritative replay wins districts 0 (20–16) and 1 (9–0).

All starter card IDs, unupgraded state, match seeds, remaining moves and server replay assertions are unchanged. A bounded single-move lane search needed five and three candidates respectively. No game, story, CPU or balance rule was changed. The refreshed six complete match results are deeply equal after JSON serialization between the reconstructed pre-pass engine and current engine, including all replay history; raw JSON hashes can differ because equivalent snapshot object keys have different insertion order.

House content and puzzle suites pass 15/15 after the refresh. Diagnostic evidence: `/tmp/story-proof-compare.log`, `/tmp/story-proof-compare-refreshed.log`, `/tmp/story-proof-before-*.json`, `/tmp/story-proof-current-*.json`, `/tmp/story-proof-refresh.log`, `/tmp/story-house-refresh-tests.log`.
