# Performance second pass: remove repeated work

This is a separate main-based draft, not a stack on performance PRs #14 or #15.
It contains five new optimizations. It does not change artwork, sound, effects,
combat rules, recommendations, rewards, polling intervals, database locks,
scheduled patch delivery, schema, security, billing, or production configuration.
No deployment or merge is included.

## Five changes

1. **Community archive reads only the data it returns.**
   `communityDeckArchive` previously called the complete community feed four
   times and discarded submissions, submission flags, and totals. Both feed and
   archive now use the same ranked-picks query helper; the archive invokes just
   its four top-three queries. SQL, parameters, voter-specific flags, tie
   ordering, filtering of empty weeks, and the existing relationship between
   archive labels and preceding-week picks remain unchanged. Nothing is cached.

2. **Story serialization indexes chapters within each request.**
   `buildStoryCampaign` creates each chapter's serialized nodes once, reuses
   those arrays for chapter and season summaries, and passes the already-known
   chapter into node availability checks. It uses the serialized optional flag
   rather than searching the original chapter again. Every request still reads
   its own supplied progress and builds a fresh response.

3. **Auto-build selects the best card without sorting every candidate.**
   Each open deck slot now scores each remaining card once and keeps the best
   candidate. The score, descending-score/ascending-locale tie comparator, pool
   order, final cost ordering, hero handling, and partial-deck policy are
   unchanged. It does not change which deck is recommended or retain player data.

4. **Gang Wall reuses four public catalog groupings.**
   Lazy immutable group containers are retained for elements, crews, bonds, and
   combos. The reward road retains its existing combo-based art/paint fallback.
   Card order and references remain the same. Only authored catalog structure is
   retained; ownership, progress, rewards, selected cards, and busy/error state
   are still read live. No private state or network response enters this cache.

5. **Venue pointer effects share a geometry sample within a display frame.**
   Pointer events keep their original order and target/interpolation math, but
   reuse one bounding rectangle until the next animation frame. Scroll, resize,
   window/visual-viewport changes, visibility, intersection and preference
   changes invalidate it. All listeners are removed on unmount. Hidden,
   offscreen and reduced-motion behavior remains in place.

## Controlled before/after measurements

These are operation counts in deterministic fixtures, not measured browser FPS,
production response latency, bandwidth, or hosting-credit savings.

| Fixture | Before | After |
| --- | ---: | ---: |
| Community archive SELECT statements | 16 | 4 |
| Story campaign array-predicate visits, 35 chapters / 233 nodes | 45,584 | 2,509 |
| Full-collection Music auto-build score evaluations | 36,390 | 2,664 |
| Full-collection Fitness auto-build score evaluations | 36,834 | 2,664 |
| Full-collection Hooper auto-build score evaluations | 36,672 | 2,664 |
| Gang Wall catalog-property reads across 50 tab visits | 288,960 | 27,993 |
| Next 50 Gang Wall visits, after all four groupings exist | 288,960 | 0 |
| Geometry reads for 120 pointer events across ten frames | 120 | 10 |

### Parity evidence

- Archive tests execute real SQL against an owned disposable PGlite database.
  They compare the complete response and the exact four retained SQL statements
  against an independently frozen original feed, including two viewers, vote
  ties, empty weeks, Monday rollover and year rollover.
- Campaign tests compare the complete JSON, including field and array order, to
  a frozen original implementation. Cases cover empty/full, required/optional,
  uncleared, shuffled/mixed, duplicate and orphan progress, plus fresh-request
  isolation.
- Auto-build tests compare exact ordered decks for all 301 catalog heroes and
  every canonical focus plus no focus (3,311 cases), and 1,200 partial, small,
  duplicate, unknown and differently ordered input cases. Existing workshop
  tests also remain in the focused command.
- Gang Wall tests compare every group, card order, note and road fallback, prove
  the four-container bound, and render changed ownership/reward/busy states.
- Venue tests mount the real React component with controlled browser inputs.
  Ten displayed CSS transform pairs match the original math exactly. Additional
  cases cover inside/outside/touch transitions, idle movement, geometry
  invalidation, hidden/offscreen/reduced-motion pause/resume and cleanup.

## Repeat checks

From the workspace root with the existing Node 24 and pnpm toolchain:

```sh
pnpm --filter @workspace/squabblemon test:work-reuse
pnpm test:campaign:db
pnpm run typecheck:libs
pnpm --filter @workspace/squabblemon typecheck
pnpm --filter @workspace/api-server typecheck
PORT=5173 BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/squabblemon build
pnpm --filter @workspace/api-server build
node scripts/build-netlify-function.mjs
node scripts/check-netlify-function.mjs
```

The existing full guarded database runner discovers the new archive and story
tests automatically. Leave `DATABASE_URL` unset for its owned disposable
database. Never point performance tests or fixture seeding at production.
The exhaustive client parity command takes approximately one minute.

## Verification boundaries

- The focused client command passes 23 tests. The focused disposable-database
  run passes 11 tests, including the new archive/campaign cases and existing
  community-deck/player-notes coverage, with zero skips.
- The broader battle command reports 254 passing and three failing tests: two
  require media/reference fixtures absent from the sparse checkout; the
  unchanged Earth-card-count assertion expects 33 while the catalog contains 34.
  These are the same three documented failures from the prior performance pass.
- Extended campaign route/solver testing reports 36 passing and five failing
  tests, all at the existing solver's per-node 10-second budget. Required and
  optional unlocks, immutable rewards, concurrent catch-up and both story
  transaction suites pass. The HTTP marathon fails at
  `red-tapes-red-side-open`; restoring both optimized API services to the
  verified main baseline reproduces that exact failure without changing the
  solver budget. Three other failed solver cases also reproduce on baseline.
  The fifth, Published Exhibition, passes in isolated baseline and optimized
  reruns at approximately 7.7 seconds each, indicating load sensitivity.
  A complete campaign marathon is therefore not a passed gate.
- This pass uses the verified sparse cloud checkout. App/API and shared-library
  typechecks, frontend bundle budgets, API/function builds and bundled release
  smoke checks are separate from a complete authenticated release playthrough.
- The local pnpm wrapper attempted an unnecessary dependency sync before running
  scripts. Checks were executed with the already-installed Node binaries
  directly, preserving the same TypeScript, Vite and test command arguments.
- Disposable database checks use the established ownership token and local
  target guards. The temporary local runner allows more startup time and invokes
  the Node tsx loader directly because the CLI IPC socket is unavailable. It
  does not weaken the committed safety guards or contact a live database.
- Aggregate workspace typechecking still reports the existing errors in
  `scripts/src/rivalry-online-audit.ts` and
  `scripts/src/rivalry-online-model.test.ts`; those files are untouched.
- Actual browser/mobile pointer feel, authenticated navigation and real-device
  rendering remain unverified. React/fake-browser fixtures are not screenshots
  or browser profiling. Complete preview/device QA before merge or deployment.
- No art derivatives, original media, cache headers or unversioned media caching
  are included. Responsive art requires source assets and high-DPR visual review.
- The only dependency additions are the same pinned test renderer and typings
  used by PR #15, with matching lock entries. Runtime production changes do not
  overlap either earlier performance PR. The frozen lockfile passed all 553
  supply-chain policy entries; a completely fresh dependency install was not
  performed.
