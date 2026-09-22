# Squabblemon

A playable three-district competitive card battler with seven starter decks, six-round CPU matches, and production character art.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/squabblemon run dev` — run the Squabblemon web game through its managed workflow
- Production deploys are Git-driven: after verification, commit the release and push the current release branch to GitHub `main` to trigger the live deployment. Do not use Replit Publish for this project.
- `pnpm --filter @workspace/squabblemon run typecheck` — typecheck the game
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/squabblemon/src/App.tsx` — playable match flow, card/deck data, and game state
- `artifacts/squabblemon/src/index.css` — Squabblemon visual system and responsive presentation
- `artifacts/squabblemon/public/assets/` — local transparent character and FX art
- `artifacts/squabblemon/reference/` — supplied prototype, rules, sprite map, and art-direction handoff

## Architecture decisions

- The initial release is a self-contained solo browser game with no account or backend requirement.
- Supplied prototype rules and balance values are preserved while the UI is implemented in React/TypeScript.
- Match state is intentionally client-side for fast playtesting; persistence and multiplayer are future production phases.

## Product

- Choose from seven starter archetypes.
- Play six-round matches against a CPU across three contested districts.
- Commit cards using Hype, resolve effects, and risk Clout with SQUABBLE.
- Review concise rules, inspect cards, see match results, and rematch or change decks.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
