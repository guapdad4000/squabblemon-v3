# Release safeguards and current player-journey verification

Working checkout: `/home/falcon/.codex/worktrees/v2-performance-parity/New project 9`.
This is local source and isolated browser evidence, not hosted, physical-device, native transaction or live-player proof.

## Completed

- Shared local/Netlify mandatory frontend gate added: explicit critical test files, zero failures/cancellation/skips/todos, real per-file test registration, Story music freshness, emitted entry bundle budgets and CSS/panel invalidation rules.
- Negative gate checks: 17/17 passed (`negative-gates.log`), including failing/skipped/todo/empty/cancelled/missing helpers, stale Story metadata, invalid/missing CSS, rejected bypass flags, changed candidate identity and replacement of stale success evidence.
- Base-path boot regression: 2/2 passed (`boot-assets.log`), actual Vite HTML transforms at `/` and `/squabblemon/`.
- Desktop/phone deck journey: 10/10 passed (`deck-journey-current.log`), including complete deck state, retry, navigation/history, inspect and broken-art checks.
- Complete rookie journey: phone390×844 and desktop1280×900 passed (`rookie-journey.log`, `rookie/rookie-{390,1280}.json`). Each actual app flow follows15 Home lessons, exact failed-save retry,5 rival-reading acknowledgements,3 round recaps, one shared-engine verified match, reload and one reward claim. The same run verifies a late saved-battle receipt and explicit setup navigation before/after arrival.
- Tutorial source: 22/22 passed (`rookie-source.log`), including rendered live Dr. Fade stats, exclusion of historical stat-specific audio from both text selection and direct playback, and existing guided-action/audio lifecycle behavior.

## Real defects corrected

- Static logo/fighter URLs already passed through Vite's base rewrite but also included `%BASE_URL%`, producing doubled `/squabblemon/squabblemon/` URLs under nested deployment. HTML now uses public-root asset paths; inline script substitution remains correct.
- Dr. Fade welcome promised the older 4 Motion/6 Hands/12 base SQUABBLE while the current card is 3/5/10. Copy derives from the live definition. Five obsolete recorded takes are excluded without modifying their original files/transcripts; neutral and expanded narration remains enabled.
- Saved-battle review initialized local receipt state from a potentially stale bootstrap. A later `rookie-tested` response could leave neither receipt branch active and show deck setup. Receipt visibility now combines live tested status with only the player’s explicit navigation choice. The pre-fix controlled browser failed as expected (`rookie-handoff-baseline.log`); both final viewport runs pass while preserving deliberate setup review.
- Dev fixture watcher included retained dist and screenshot/test output trees, exhausting the host watch budget. Scoped ignores avoid generated output; no host limits changed.

## Test maintenance (not runtime defects)

- Updated deck template label and declared new background GET contracts.
- Rookie readiness probes the required trailing slash under the configured Vite base.
- Rookie follows all 15 authored Home lessons and the current deck coach controls, current card identity/stats, planned recruit, match briefing, explicit rival-event/round-recap reading gates and reward handoff.
- Isolated rookie HTTP fixture closes development WebSockets so unrelated shared-worktree HMR cannot reload a live tutorial; the interrupted prior run is preserved separately in `rookie-hmr-interruption.log`. No game WebSocket behavior is claimed.
- Failed-save retry compares the complete identical crew payload; it no longer assumes an obsolete recruit name.

## Final shared production verification

- Frontend TypeScript: exit0, no diagnostics (`frontend-typecheck.log`).
- Shared production build/gate: PASS (`shared-production-build.log`, `shared-production-build.json`) with `NODE_ENV=production`, `VITE_E2E_AUTH=false`, `BASE_PATH=/`, Node22.23.3.
- 209 required tests passed: 35 purchase/retry, 38 gacha lifecycle, 35 reward presentation, 22 rookie guidance, 16 payment boundaries, 63 guard regressions. Zero failures, cancellation, skips or todos. Story music metadata current (4,440B).
- Public entry 211.5/475KiB, GameApp 650.7/900KiB, Home 956.1/1,200KiB. No ceilings changed. 50 emitted stylesheets pass invalidation guards; 5 literal panel combinations, 2 paper variants and 9 CSS rules pass consistency guard.
- One nonblocking Vite advisory: the Story chunk is 575.14kB minified, over its generic 500kB advisory. The project’s enforced static-route limits passed.
- Base Git commit `61e9a86c1bd1ba49e350bd4a488671ab37d26ad2`; working tracked diff SHA256 `4169d75cf3bd084c0641f45d822ac9330e7f4549205e5b2ea81f103d18226544`. The JSON retains full untracked/critical source hashes; before/after identity was stable. Commit alone does not reproduce these working changes.
- Final `git diff --check`: clean. All owned test/browser/server processes closed.

This executes the shared frontend release pipeline used by local and Netlify builds. The full Netlify wrapper’s API/function packaging and hosted deployment were not run by this agent. Native database/browser/physical-device tiers remain distinct evidence; see the parent’s coordinated results.
