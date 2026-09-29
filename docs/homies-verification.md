# Homies and Friendly Fades verification

## Fadebook update

The current username-based UI, transparent artwork, post-match actions, updated regression suites, and native two-account results are documented in [Fadebook verification](fadebook-verification.md). The earlier results below remain historical evidence for the original Homies implementation.

## Contention follow-up

The isolated native load comparison, optimized locking/read behavior, exact sample counts, observed lock waits, and evidence limits are recorded in [Homies contention](homies-contention.md). The follow-up native API suite passed 21 tests without skips, including explicit held-lock and stale-hint regressions. No production load testing or deployment was performed.

## Scope and data safety

Social identity, relationships, blocks, rate limits and invitation receipts are separate PostgreSQL tables. Existing economy JSON, reward mail, match stakes, ranked rules and combat logic are unchanged. Only the additive development migration was applied to the workspace database. No production deployment or production database operation was performed.

The matching native Netlify migration is checked and staged by the existing migration tooling. `invite_only` preserves targeted-room access even when deleting a profile cascades away its invitation receipt; it is backfilled for existing targeted rooms.

## Reproducible checks

From the repository root:

```sh
pnpm run typecheck
env -u DATABASE_URL LOG_LEVEL=silent pnpm exec node scripts/test-api-database.mjs social
env -u DATABASE_URL LOG_LEVEL=silent pnpm exec node scripts/test-payments-database.mjs --social-browser
pnpm --filter @workspace/squabblemon exec playwright test --config e2e/playwright.fighter-id.config.ts
node --test scripts/check-netlify-migrations.test.mjs
node scripts/check-netlify-migrations.mjs
```

The database runners reject caller-supplied database URLs and create/clean owned native PostgreSQL clusters with independent connections. They do **not** use serialized database mocks as evidence of concurrency.

Recorded results on 2026-09-28:

- Workspace typecheck passed.
- Native API suite: 15 passed, no skips.
- Native two-account browser journey: passed, including the third-party denial and ordinary-room regression.
- All 23 distinct profile/social browser cases passed across the full run and focused reruns of corrected fixture assertions and added guard cases. Unchanged passing cases were not rerun unnecessarily.
- Native migration checks: 11 passed; coverage confirms 16 tables across six migrations. Development/native social SQL files match byte-for-byte.
- Frontend and API workflows restarted successfully; application preview and console showed no application errors.

- Native API coverage includes mutual persistence, display-name edits, private identity fields, authorization, limits/cooldowns, duplicate and crossed requests, accept/cancel/block/join races, expiry/replay, targeted room-code bypass, deletion cleanup, ordinary rooms, joined-member reconnect/rematch and ranked regressions.
- The native browser journey uses three separate authenticated browser contexts against real routes: one host, the intended recipient and an unauthorized third party. It adds and accepts a homie, reloads both accounts, changes crew, rotates twice, sends/accepts an invitation, rejects third-party room access, readies both players, enters the battle, reconnects and proves social polling is paused during battle. An ordinary non-homie room remains joinable.
- Production-build browser fixtures replace HTTP data, not components. They render the actual GameApp, CityHeader, Fighter ID, Homies and Friendly Fades route shells. They cover empty and 80-contact lists, long names, retry/reconnect, share/copy denial, missing images, reduced motion, keyboard tabs, account sign-out, busy states and dirty-Style guards.
- The shared-link onboarding check uses the actual sign-in gate, profile/age/terms form and starter reward confirmation. Tutorial combat is explicitly accelerated by a fixture; opening or restoring the link makes no social mutation.

## Visual evidence

Browser reports save screenshots beneath `artifacts/squabblemon/test-results/fighter-id/`. Tests run the actual routes at 320×740, 390×844, 740×360, 768×1024, 1024×768 and 1440×900. The crowd test checks the complete final contact row and hit-tests Invite, Remove and Block. It allows one CSS pixel for fractional layout/integer scroll rounding; controls must still be at least 44px and unobstructed. Friendly Fades checks empty, long-list and selected-opponent/crew states and its final invitation action.

The portrait phone and independently generated landscape tablet, their transparent apertures and missing-image fallback have been inspected in the route shell. Short landscape uses the same generated tablet as a nine-slice frame so the controls retain usable width. Orientation changes keep the same mounted controls and state.

Artwork masters, prompts, provenance, processing and safe bounds are retained in `artifacts/squabblemon/reference/homies/` and `artifacts/squabblemon/public/assets/homies/`. The optimized phone and tablet are approximately 92KB and 100KB, respectively. They are requested only on the relevant social screens.

## Evidence limits

These browser runs use Chromium viewport emulation, not physical iPhones/iPads or a live external OAuth provider. The application preview's real Clerk sign-in gate was also checked. The native browser test uses disposable authenticated test identities guarded by test-only environment checks. It is real API/PostgreSQL evidence, not a claim of live Clerk signup or production verification.