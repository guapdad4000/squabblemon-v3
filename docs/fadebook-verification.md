# Fadebook verification

Verified on 2026-09-28. This replaces the old code-entry/device-frame presentation, not the existing social relationships, invitations, room access rules, or combat.

## Scope

- Homies navigation opens the light Fadebook screen, using the supplied gold artwork with a transparent background.
- Editable unique usernames, bounded username search, recognizable portraits/names, Homies / Requests / Find Players sections, and share/copy fallback.
- Existing incoming/outgoing requests, accept/decline/cancel, remove/block/unblock, and Friendly Fade invitations remain available.
- Human PvP results offer Add Homie, Accept request, Request sent, or Homies as appropriate. Bots, self, and blocked players do not expose an add action.
- Old opaque links remain valid and never automatically send a request. Activity labels describe recorded activity, not live presence.
- No feed, messaging system, extensive profile editor, or new page/entrance animations.

## Passed checks

- Workspace/library typechecks; the final client-only freshness adjustment also passed its frontend typecheck.
- Isolated native PostgreSQL social API suite: **27 passed**, including handle normalization, collisions/reserved names, bounded legacy allocation, search visibility, opponent authorization, and existing request/invitation race behavior.
- Native migration checks: **15 passed**. Development and native username SQL files match; the development schema has the unique index and validated format/reserved-name constraints.
- Request-URL privacy helper: **2 passed**; social and room identifiers are not logged in routine request paths.
- New Fadebook and post-match browser cases: **17 passed**.
- Adapted existing Homies/guard browser cases: **10 passed**, retaining keyboard, retry, mutation, onboarding, and responsive coverage.
- Final focused browser pass: **3 passed**. It includes the delayed old-search regression, the already-covered newer incoming lookup case, and a top-of-page visual capture. These overlap the earlier pass and are not three additional independent interaction cases.
- Isolated native PostgreSQL browser journey: **passed**. Two real API-backed accounts find each other by username, send/accept a request, choose a crew, invite/join, enter battle, and reconnect. Third-party access denial, battle-time social polling pause, and an ordinary-room join remain covered.
- Real Settings-shell wheel/scroll/hit testing at narrow phone, tablet, desktop, and short-landscape sizes. Screenshots were inspected, including 320/390/768/1280 widths; controls were clicked after actual scrolling.
- Transparent asset alpha was inspected on cream, optimized, then fetched from the running app and decoded as a 1024×512 PNG with alpha. The app preview rendered without application console errors.

## Reproduction

From the repository root:

```sh
pnpm run typecheck
env -u DATABASE_URL LOG_LEVEL=silent pnpm exec node scripts/test-api-database.mjs social
node --test scripts/check-netlify-migrations.test.mjs
node scripts/check-netlify-migrations.mjs
pnpm --filter @workspace/api-server exec tsx --test src/lib/requestLogUrl.test.ts
```

Set `REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed Chromium executable when using the isolated Fadebook config; it avoids depending on an unavailable default headless-shell revision.

```sh
pnpm --filter @workspace/squabblemon exec playwright test \
  --config e2e/fadebook.playwright.config.ts --project=chromium-desktop --reporter=line

CHROMIUM_EXECUTABLE="$REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE" \
  env -u DATABASE_URL LOG_LEVEL=silent \
  pnpm exec node scripts/test-payments-database.mjs --social-browser
```

Database runners create and clean owned native PostgreSQL databases. Never substitute a shared development or production database.

## Evidence limits and release boundary

The component/browser suites use deterministic API mocks; the separate native journey verifies actual API/database persistence and room behavior. These are not physical iPhone/Android tests, a real external Clerk signup, or proof of operating-system share-sheet behavior.

Only the additive username migration was applied to the confirmed matching **development** database. Production was not queried or changed, and the app was not published. The next normal release must include the matching username migration together with the API and frontend changes.