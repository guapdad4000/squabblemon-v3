# Squabblemon

This is the source repository for the current Squabblemon card game. The older prototype handoff is preserved in [`handoff/`](handoff/); the current playable app is in [`artifacts/squabblemon/`](artifacts/squabblemon/) and its API is in [`artifacts/api-server/`](artifacts/api-server/).

## Season One story

The local campaign contains eight playable chapters, 62 story nodes and 51 card battles. Chapter Two uses the revised screenplay. Chapters Three through Seven adapt the MiniMax September 17 drafts to the established Chapter One canon. Chapter Eight completes the Crown story. The original MiniMax scripts are preserved under [`artifacts/squabblemon/scripts/story/sources/minimax-2026-09-17/`](artifacts/squabblemon/scripts/story/sources/minimax-2026-09-17/). Read the [story index](artifacts/squabblemon/scripts/story/README.md) and [story bible](artifacts/squabblemon/scripts/story/STORY_BIBLE.md) before changing the campaign.

The story engine is [`lib/squabblemon-engine/src/story.ts`](lib/squabblemon-engine/src/story.ts) plus [`seasonChapters.ts`](lib/squabblemon-engine/src/seasonChapters.ts). The game route is `/game/story`; `/story-studio` previews dialogue without saving progress or starting battles.

## Repository and deployment

Payment setup, approval gates, webhook limitations, and restricted operator procedures are documented in [Corner Store payments operations](docs/corner-store-payments.md).

- GitHub source: [`guapdad4000/squabblemon-v3`](https://github.com/guapdad4000/squabblemon-v3), branch `main`.
- Netlify project: [`squabblemon-triple-lane`](https://app.netlify.com/projects/squabblemon-triple-lane), project ID `572e48d3-6f4d-427f-9a9b-df5e195ea47c`.
- Live site: [`squabble.today`](https://squabble.today).

Use main in this repository as the shared source of truth. Netlify automatically deploys pushes to main; publishing may finish after the push returns. This was verified during the September 19 reconciliation: production deployment 6aaf6ef71331010009ef358e references GitHub commit 24b03b39976ff4c06de4c1df370780006f19305b. Some earlier releases were manual CLI deploys from a separate dirty checkout and had no commit reference. Their changes have now been reconciled into this repository. Commit and push changes here before publishing, and verify the published commit afterward. Do not deploy stale alternate checkouts.

The checked release build is defined in [`netlify.toml`](netlify.toml). Its `node scripts/build-netlify.mjs` command typechecks the app and API, builds and smoke-tests the Netlify API function, builds the Vite site into `artifacts/squabblemon/dist/public`, and enforces the public entry budget. Netlify publishes that directory, serves the function at `/api/*`, and sends game routes through the SPA fallback.

Production build variables, Clerk keys and database credentials belong in Netlify environment settings, not this repository. The build requires a live `VITE_CLERK_PUBLISHABLE_KEY` and an HTTPS `PUBLIC_ORIGIN`; the function requires live Clerk keys and uses the attached Netlify Database unless an explicit `DATABASE_URL` is supplied. Test authentication is forced off. For an authorized manual recovery deploy, link this repository with `netlify link --id 572e48d3-6f4d-427f-9a9b-df5e195ea47c --filter @workspace/squabblemon`, then run `pnpm --package=npm --package=netlify-cli dlx netlify deploy --prod --context production --filter @workspace/squabblemon --skip-functions-cache` from the repository root.

## Local development

Use Node 24 and pnpm. Install from the repository root, then start the app and API with the required local environment. The API needs a PostgreSQL `DATABASE_URL` and Clerk configuration for normal signed-in play. See [`artifacts/squabblemon/PUBLISHING.md`](artifacts/squabblemon/PUBLISHING.md) for the public-origin requirement.

The historical prototype notes remain in [`HANDOFF.md`](HANDOFF.md) and [`handoff/PROTOTYPE_README_2026-09-07.md`](handoff/PROTOTYPE_README_2026-09-07.md). The separate [`guapdad4000/SquabbleMon`](https://github.com/guapdad4000/SquabbleMon) repository contains an earlier overworld game, not this deployable card-game monorepo.
