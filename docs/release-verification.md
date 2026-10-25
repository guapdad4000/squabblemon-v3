# Required release verification

The shared required inventory is [release-checks.mjs](../scripts/release-checks.mjs). Both `pnpm --filter @workspace/squabblemon build` and the Netlify build run it. It executes the critical source suites and current Story music metadata check before Vite, then checks the emitted JavaScript budgets and CSS/panel invalidation rules. The existing limits are unchanged. Directly invoking Vite is a development action, not a release verification result.

The critical suites cover exact purchase quotes and retry journals, counter/account recovery, gacha films and reveal lifecycle, actual reward receipts, weekly/monthly presentation, current tutorial card promises and audio cues, payment configuration/geography boundaries, and negative tests for the guards themselves. Required test files must exist and register test cases. Failures, cancellation, skips, todos, empty files and missing completion reports fail the gate, including conditions for which Node itself can return exit zero. There is no filtering or skip flag on the release command.

Every check is bounded, so a hang fails the gate instead of stalling a local or Netlify build. Each required test has a 2-minute limit (`--test-timeout`), each test process 10 minutes and each command (including Vite) 15 minutes; an exceeded process limit is killed and reported as `<check> timed out`. The per-test limit matters on Node 24, which waits indefinitely on a never-settling test where Node 22 cancels it once the event loop drains. The limits sit well above the slowest observed suite (about 21 s) and Vite build (about 40 s) on a 2-core host; raise them deliberately with that rationale rather than removing them.

## Commands and evidence

From the repository root:

```sh
pnpm verify:release
pnpm test:release-gates
pnpm verify:release:inventory
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/squabblemon build
```

`pnpm build` retains the workspace typechecks and builds; the frontend build uses the same required gate. `pnpm build:release` invokes the complete Netlify sequence locally, including its existing typechecks, engine/Story/API checks, function packaging and migration coverage/staging. It requires explicit `APP_ENV=staging` or `production`, the matching Clerk publishable-key type and an exact HTTPS `PUBLIC_ORIGIN`; it builds files and never deploys or queries the live database. Netlify supplies its context and validates the actual deploy origin as before.

The source gate writes `.cache/release-gates/source.json`; the frontend build writes `.cache/release-gates/build.json`. Override the evidence location with `node scripts/release-checks.mjs [--build] --evidence /absolute/path/result.json`. Each record identifies the base Git commit, tracked diff, untracked source hashes, critical input hashes, Node version, named checks and actual test counts. A changed source identity during execution fails verification. A failed rerun replaces any previous passed record at that evidence path, preventing stale success from being mistaken for the new attempt.

An uncommitted candidate is described as a working tree based on the recorded commit; the commit alone does not reproduce it. Preserve the tested source and evidence, then rerun the gate after the final release commit when claiming evidence for that exact SHA. These records do not certify physical devices, hosted deployment, real payments or player win rates.

## Additional required tiers

The machine-readable [heavy-check inventory](../scripts/release-check-inventory.json) is shown by `pnpm verify:release:inventory`. Its triggers, commands, server prerequisites and evidence limits are part of the release decision. These tiers are separate because Netlify cannot provide every local database/browser/device environment. They are not implicitly passed by a successful fast build.

| Changed boundary | Required additional checks |
| --- | --- |
| Money or shared wallet | Native payments and all affected reward/collection suites; shared-wallet browser recovery across counters and accounts |
| Pack purchase, banner or collection | Native `--flex-pulls`; purchase recovery and gacha film/reveal/handoff browser checks |
| Daily/monthly account grants | Native `--monthly-login`; daily/monthly arrival and shared-receipt browsers |
| Ranked settlement or room compatibility | Native `--ranked-clout` and `--online-retirement`; real two-client version/reconnect journey |
| Social, inbox grants or event/feedback delivery | Explicit native social, mail and full event-feedback modes; the embedded scan cannot replace them |
| SQL or schema | Native migration execution/replay (`--migrations-only`), in addition to the automatic migration coverage guard in the complete release sequence |
| Onboarding, coached battle or deck navigation | Desktop/phone deck journey and verified first-fight save/retry/reward journey |
| Shared rendering or CSS | Production battle performance harness with existing budgets; responsive/keyboard/reduced-motion checks for affected surfaces |

Native suites require an unprivileged user and PostgreSQL tools, with `DATABASE_URL` unset so the runner owns a fresh loopback cluster. PGlite and mocked HTTP cannot replace native locking/rollback evidence. Browser runners use isolated local fixtures with complete assets; their URL and browser-executable overrides are documented in the inventory. Run only one GPU/browser performance workload at a time.

Record the actual command, candidate identity, environment, result and artifact path for every applicable tier. An unavailable prerequisite, unexpected skipped test, failed assertion or unexecuted applicable tier remains a release blocker; do not relabel it “passed.” Preserve separate open items for authenticated staging, interrupted networks, two real clients, keyboard/screen-reader use and physical phones/tablets. Only a matching ready hosted revision establishes deployment.
