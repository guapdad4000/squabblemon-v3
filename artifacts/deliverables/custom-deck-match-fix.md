# Custom deck match-start fix

Published September 17, 2026 to https://squabble.today in deployment [6aac9df01856ee6b8b63e922](https://app.netlify.com/projects/squabblemon-triple-lane/deploys/6aac9df01856ee6b8b63e922).

## Cause and change

The crew builder uses 36-character UUIDs for custom decks. Saving a deck accepts IDs up to 80 characters, but the generated match-start validator only accepted 32. Valid saved crews therefore failed before deck lookup with HTTP 400 on `playerDeckId`.

Updated the OpenAPI source and generated Zod limit to 80. Deck IDs are preserved exactly; existing saved crews need no migration. Rival recipe limits and ownership validation remain unchanged.

## Verification

- Reproduced the failure with a UUID regression test before the fix.
- Schema checks now cover every supported saved-deck ID length (3–80), UUIDs, practice and story requests, and rejection above 80 characters.
- Isolated HTTP/database check exercises real deck saving, custom UUID and 80-character match starts, original short IDs, unknown-deck rejection, practice completion/retry, story win/unlock, and reward idempotency.
- Production type checks, API packaging smoke checks, client build, and entry budget passed.
- Live health returns 200; anonymous bootstrap remains 401; published HTML matches the build.
- Live browser: the existing custom **bruce** deck saved unchanged and entered Round 1 with its correct hand. No match was completed and no rewards were claimed during this check.
- The Big Zoey video URL in the supplied console log currently serves byte ranges successfully (206). The repeated ObjectMultiplex warnings originated in a browser extension; they were separate from the game validation error.

Tests: `artifacts/api-server/src/lib/matchDeckIds.test.ts` and `artifacts/api-server/src/lib/activityRoutes.test.ts`.
