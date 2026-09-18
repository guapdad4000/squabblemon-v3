# Squabblemon

This is the source repository for the current Squabblemon card game. The older prototype handoff is preserved in [`handoff/`](handoff/); the current playable app is in [`artifacts/squabblemon/`](artifacts/squabblemon/) and its API is in [`artifacts/api-server/`](artifacts/api-server/).

## Season One story

The local campaign contains eight playable chapters, 62 story nodes and 52 card battles. Chapter Two uses the revised screenplay. Chapters Three through Seven adapt the MiniMax September 17 drafts to the established Chapter One canon. Chapter Eight completes the Crown story. The original MiniMax scripts are preserved under [`artifacts/squabblemon/scripts/story/sources/minimax-2026-09-17/`](artifacts/squabblemon/scripts/story/sources/minimax-2026-09-17/). Read the [story index](artifacts/squabblemon/scripts/story/README.md) and [story bible](artifacts/squabblemon/scripts/story/STORY_BIBLE.md) before changing the campaign.

The story engine is [`lib/squabblemon-engine/src/story.ts`](lib/squabblemon-engine/src/story.ts) plus [`seasonChapters.ts`](lib/squabblemon-engine/src/seasonChapters.ts). The game route is `/game/story`; `/story-studio` previews dialogue without saving progress or starting battles.

## Repository and deployment

- GitHub source: [`guapdad4000/squabblemon-v3`](https://github.com/guapdad4000/squabblemon-v3), branch `main`.
- Netlify project: [`squabblemon-triple-lane`](https://app.netlify.com/projects/squabblemon-triple-lane), project ID `572e48d3-6f4d-427f-9a9b-df5e195ea47c`.
- Live site: [`squabble.today`](https://squabble.today).

The current Netlify production release was uploaded with the Netlify CLI. Its deploy record has `deploy_source: cli` and no Git commit reference. **A GitHub push does not currently update the live site.** To make pushes deploy automatically, connect this GitHub repository to the existing Netlify project and select `main` as the production branch. Verify the build and production environment before enabling automatic publishing.

For the existing manual release flow, work from this repository root, use the linked Netlify project, run the checked build in [`netlify.toml`](netlify.toml), and publish the resulting site and function through Netlify CLI. The build command is `node scripts/build-netlify.mjs`. It typechecks the app and API, builds the Netlify API function, then builds the Vite site into `artifacts/squabblemon/dist/public`. `netlify.toml` supplies the publish and functions directories. The function serves `/api/*`; the SPA fallback serves the game routes.

Production build variables, Clerk keys and database credentials belong in Netlify environment settings, not this repository. The build requires a real `VITE_CLERK_PUBLISHABLE_KEY` and an HTTPS `PUBLIC_ORIGIN`; it forces test authentication off. The local disposable test account and in-memory database are not part of a release.

## Local development

Use Node 24 and pnpm. Install from the repository root, then start the app and API with the required local environment. The API needs a PostgreSQL `DATABASE_URL` and Clerk configuration for normal signed-in play. See [`artifacts/squabblemon/PUBLISHING.md`](artifacts/squabblemon/PUBLISHING.md) for the public-origin requirement.

The historical prototype notes remain in [`HANDOFF.md`](HANDOFF.md) and [`handoff/PROTOTYPE_README_2026-09-07.md`](handoff/PROTOTYPE_README_2026-09-07.md). The separate [`guapdad4000/SquabbleMon`](https://github.com/guapdad4000/SquabbleMon) repository contains an earlier overworld game, not this deployable card-game monorepo.
