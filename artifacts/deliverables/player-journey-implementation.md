# Player journey: first playable slice

Implemented the first-session construction loop from the research roadmap. New accounts proceed from the existing guided tutorial to a 17-card foundation collection, an editable personal deck, an explained swap, a verified practice match, and a recap before claiming their welcome reward.

The card table supports naming, player-chosen cover art, all-owned-card search, replacement in place, undo, explicit draw ordering, incomplete draft saves, and save-before-test. Three optional suggestions explain existing card effects; retaining the original lineup is allowed. The original seven recipes remain optional learning examples and opponent fixtures.

Saved custom decks now enter server-verified practice and story matches. The issued snapshot supplies the actual roster and upgrade state to the browser and transcript verifier. New onboarding grants union with existing ownership under the profile lock, and the welcome reward requires a completed personal practice match. The existing onboarding enum is retained; `foundation-v1` identifies the new path. No database schema migration is introduced.

## Validation

- Frontend and API TypeScript checks pass.
- Production frontend build and public-entry bundle budget pass.
- 46 gameplay, workshop, transcript, training, and analytics tests pass.
- 23 battle component tests pass, including custom story initialization.
- Two authorization tests pass for owned recipes and legal mixed saved decks.
- Phone (390px) and desktop (1280px) browser journeys pass with a contract-preserving mocked account API and real shared-engine transcript verification. Each exercises the tutorial, Nail Tech swap and effect, save/reload, save failure/retry, practice completion, factual recap, reward continuation, and personal deck selection.
- Two database integration tests are present but skipped: no `DATABASE_URL` is configured. They cover concurrent foundation grants/bootstrap normalization and the one-time welcome reward gate. Actual database transactions remain unverified in this environment.

## Review

- [Desktop card table](E:/Apps/code/minimax/Squabblemon/screenshots/player-workshop-1280.png)
- [Phone card table](E:/Apps/code/minimax/Squabblemon/screenshots/player-workshop-390.png)
- [Research roadmap](E:/Apps/code/minimax/Squabblemon/artifacts/deliverables/player-journey-roadmap.md)

The reusable browser check is `artifacts/squabblemon/e2e/verify-player-journey.ts`. It expects an E2E-auth development server at port 4182 with base path `/squabblemon`; `JOURNEY_ORIGIN` overrides that URL. It uses the installed Edge browser in headless mode.

## Remaining roadmap

Targeted card-choice milestones, revised Collection Road rewards, standardized practice/competitive card strength, midgame challenge progression, draft, and multiplayer remain subsequent phases. Current card costs, effects, draw rules, and earned upgrade behavior are preserved. This is a local implementation, not a production deployment.
