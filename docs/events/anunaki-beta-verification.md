# Anunaki beta compatibility verification

Current results, balance findings, calendar rules and remaining acceptance checks: [release readiness](anunaki-release-readiness.md).

Run from the repository root with dependencies already installed. These checks do not contact production or modify player accounts.

## Complete expansion batch

- `env -u DATABASE_URL node scripts/test-anunaki-native.mjs` owns a temporary native PostgreSQL cluster. It exercises authenticated Story endpoints for all 56 new nodes, including 32 legal replay-verified wins, eight solved puzzles, checkpoints, chapter rewards, roadmap claims, retries and raid eligibility. It also covers raid gates, first/weekly payouts, exact retry snapshots, conflicting requests, concurrent completion, and existing multiplayer compatibility. No winner is forced in the Story journey. The separate raid reward test uses a near-win state; the engine suite retains an independent legal six-round starter-deck victory.
- `env -u DATABASE_URL node scripts/test-payments-database.mjs --featured-pulls` verifies the shared 10% featured-slot rules, independent banner counters, transaction contention, expiry/retry recovery and the beta dev code.
- `pnpm --filter @workspace/squabblemon test` runs the game regressions. `node scripts/release-checks.mjs` additionally enforces the new featured-banner and Anunaki critical suites on every build.
- With the local frontend running on port 5198, `cd artifacts/squabblemon && node e2e/verify-anunaki-raid.mjs` checks a populated legal replay, card inspection, district rules and overflow at 320×568, 390×844, 844×390 and 1440×1000. It also plays invested Homeless Guy followed by an ordinary card to prevent stale hidden investment. Browser account responses are controlled fixtures; native persistence is verified separately.

Raid saves deliberately omit unused engine presentation-film histories. The complete legal starter victory is round-tripped through JSON after every action and guarded below 100 kB per state and 1 MB for all retained action snapshots. Exact retry responses remain available. Journey and bounty queries project claim keys rather than loading raid payloads.

The before/after gallery is saved outside the checkout at `output/anunaki-batch-review/index.html` in the parent workspace. It includes all banner/rate views, the original and expanded roadmap, new Story scenes, raid phases, earned covers, and special-move reviews. There was no previous Anunaki Story or raid screen; new scenes are labeled accordingly. The saved previous roadmap component was replayed solely for its baseline screenshots and is not shipped.

`DEVANUNAKI` is once per account and requires the server switch `ANUNAKI_BETA_CODE_ENABLED=true`; the switch defaults off. It grants all ten playable characters, preserves upgrades and both kinds of pull progress, and does not grant generated summons. The selected launch is November 2–16, 2026 at 00:00 UTC (November 1–15 at 4 PM Pacific). First monthly return is December 7–14 UTC. Push remains held; revise the unpublished window if release misses its start.

- `node scripts/test-payments-database.mjs --online-retirement` creates and removes a fresh native PostgreSQL cluster on loopback. Leave `DATABASE_URL` unset. It runs the native reaction-tray lock race and the existing online retirement and profile-recovery tests. Native PostgreSQL binaries must be available on `PATH`; the test observes independent connections and the profile row lock.
- `node scripts/test-anunaki-legacy-reaction-ui.mjs` archives the pre-expansion reaction editor from commit `77f44c8b`, runs it in an isolated loopback Vite fixture, and checks that a mocked HTTP 409 displays the refresh message while preserving the editor draft. Set `BROWSER_PATH` if Chromium is installed in a nonstandard location. This is a browser presentation check, not a browser-to-database test.

- `env -u DATABASE_URL node scripts/test-payments-database.mjs --anunaki-browser` runs two full V2 app battle sessions against owned native PostgreSQL, with automated UI card plays, both viewpoint scores, reload recovery, tablet consumption, radiation, Yakub summons and Anu finishers. Evidence distinguishes automated desktop/phone viewport coverage from human/physical-device testing.

## Shared cinematic raid correction

The presentation contract and later power-up plan are in `shared-raid-cinema.md`. Anu projects native actions into the established shared raid view; it does not execute legacy raid combat or reward rules. Its displayed cost follows native tablet discounts and extra choices. Existing legacy cost and reward behavior remain in their original path.

From `artifacts/squabblemon`, with a local Vite server running, the retained browser checks are:

- `node e2e/verify-boss-cinematic.mjs` — Patrol/Kumite play, centered boss impact anchor, district targeting, expansion/inspection, saved rewards and responsive layout.
- `node e2e/verify-anunaki-raid.mjs` — legal populated Anu replay, native choices/costs, district help, full overflow formation inspection, exact lost-response retry intent, finite action cues and all generated sprites loaded.
- `node e2e/verify-raid-cinema-lifecycle.mjs` — existing raid sprites pause for inspection/offscreen/reduced motion and clean up when unmounted.
- `node e2e/verify-raid-cinema-dense.mjs` — a separately labeled synthetic crowded formation, full roster access, and hidden actor playback stopping; this is not a claim that the synthetic workload was reached by legal play.
- `node e2e/verify-anunaki-drawn-lifecycle.mjs` — all four real Anu action clips, phase-specific stills, NPC animation and the actual `ReactionArt` component. Its report explicitly distinguishes synthetic document-visibility injection from real browser tab backgrounding; headless Chrome kept both test tabs visible.

The media source manifest is `anunaki-drawn-animation-sources.json`, with retained source sheets and prompts under `docs/art-sources/anunaki-drawn-v2`. The encoder is `scripts/encode-anunaki-drawn-frames.py`. Each loop contains distinct drawn cels; alpha-aware extraction excludes neighboring sprites. Runtime exports contain 22 animated WebPs, eight reaction GIF fallbacks and still posters. Both event reaction packs retain their existing unlock/receipt IDs.

Before/after screenshots and animation previews are in `output/raid-cinema-review/index.html` outside the checkout. These checks are local presentation/rule evidence. This correction does not contact production, modify player accounts or release the expansion.
