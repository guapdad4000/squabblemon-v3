# Loading and reward broadcast verification

## Scope

Disposable mounted React fixtures exercise the real LoadingScreen,
RewardReveal, DeferredRewardStinger, RewardStinger and active PlayLoop against
explicit mocked APIs. No production player data was written and nothing was
published. These checks are not physical-device validation.

## Current passing evidence

- **Loading: 4/4.** One scene survives startup/account/profile changes and
  remounts; visits rotate without immediate repeats and reach all three scenes.
  Reduced motion, Data Saver and slow connections use posters. Quick loads
  request no video; prolonged waits expose pause/play.
- **Media and receipt presentation: 8/8.** Chromium decoded all **22 short
  exports plus 3 loading loops** and matching posters; duration, dimensions,
  MIME and compatible reachable pools were checked. Root first-paint and
  mounted loader select the same scene. Confirmed mission/promo/Story receipt
  fixtures, a failed action, FIFO, duplicate/remount suppression, Escape,
  dedicated Clout/battle/level opt-outs, selected-only requests, responsive
  frames, network/motion bypass, autoplay rejection, errors, stalls and unmount
  cleanup passed. Cold optional code rejection, timeout and immediate Skip
  passed; late imports request no video or repeat completion. Hiding playback
  clears its source, pauses it and ignores subsequent media events.
- **Battle completion: 6/6 across focused runs.** Story's mounted 1x stinger and
  explicit Training Circuit's mounted 1.5x stinger passed. Both submit before
  confirmation, present no stinger while the response is held, then show one
  outcome-compatible cut on confirmation. Skip reveals results and final-board
  review/reopening does not replay it. Completion count is exactly one and all
  six end-turn moves replay to a complete round-six match through the shared
  engine verifier. Story failure/retry, delayed Training saving, and ordinary
  practice exclusions passed. A separate Story fast-forward journey with motion
  and network eligibility enabled submitted and verified all six moves without
  requesting a clip. Delayed
  confirmation does not hold results or start a late cinematic.
- **Typecheck, 18 broadcast/receipt unit tests and staging build passed.**
  Unchanged bundle limits: public entry **210.1/475 KiB**, GameApp static JS
  **898.3/900 KiB**, Home static JS **976.0/1200 KiB**.
- Optimized loops, clips and posters total **7,725,763 bytes**. All individual
  delivery targets were met. Source mapping, edit points, omitted/deferred
  material and flash-safety notes are in `broadcast-media-manifest.md` and its
  JSON companion. Originals remain source material, not runtime requests.

## Visual evidence and selection constraints

Mounted phone portrait/landscape, tablet and desktop captures for every loading
scene and the reward frame are in `e2e/artifacts/broadcast`; their responsive
contact sheet was visually inspected for framing, safe controls and readable
status. The root first-paint
and mounted root loader also have captures. The source/export audit additionally
contains contact sheets for the action cuts.

The final restarted app preview rendered without browser errors; the only
warning was Clerk's expected development-key notice.

Anime has the selection bias; immediate-repeat prevention takes precedence in
narrow compatible pools. Pools containing only one safe anime take can therefore
alternate to live action more often than the nominal weighting. No duplicate
edits were manufactured and opening/face-off material remains audit-only.

## Harness corrections

Readiness requires the expected round plus presentation/engine player-ready and
enabled End Turn, servicing lesson/reading holds without skipping the last
positive transition. The terminal test waits for actual completion submission,
not an archive button that automatic results have already unmounted. Speed is
asserted before turn six; pending-save caption assertions target the visible
caption rather than matching both it and the receipt dialog's status.

## Broader regression status

Story reward recovery, battle-speed choreography and desktop/phone progression
checks passed. See `broadcast-regressions.md` for the retained guided-journey
stall and phone Story-result CTA overflow. Neither is represented as passing,
and this task did not alter ResultScreen or tutorialGuidance to mask them.
Ranked screenshot baselines were not updated. The last Rookie practice helper
amendment was typechecked but not rerun; the earlier frozen run passed.

## Reproduction

With the managed preview running, from `artifacts/squabblemon`:

```sh
pnpm exec playwright test --config e2e/playwright.loading.config.ts --trace off
pnpm exec playwright test --config e2e/playwright.broadcast.config.ts --trace off
pnpm typecheck
pnpm test:broadcast
PORT=4179 BASE_PATH=/ APP_ENV=staging PUBLIC_ORIGIN=https://squabble.today pnpm build
```