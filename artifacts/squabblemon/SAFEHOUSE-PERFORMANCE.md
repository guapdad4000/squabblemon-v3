# Safehouse lifecycle performance

The renderer now cancels its animation queue when the document is hidden, stops scheduling once the mail overlay transition settles, and resumes on visibility/overlay return. Unmount cancels the outstanding frame before disposing GPU resources. Texture resolution, quality tiers, effects, camera easing and active animation rates are unchanged.

## Browser evidence

Local Vite server, controlled API fixtures, Playwright Chromium with software WebGL, desktop 1440×960 and phone 390×844. Instrumented requestAnimationFrame callbacks inside the real Safehouse iframe; counted over one second after pause settled.

| Viewport | Before paused callbacks/s | After paused callbacks/s | Before first ready | After first ready |
| --- | ---: | ---: | ---: | ---: |
| Desktop | 61 | 0 | 7640 ms | 7826 ms |
| Phone | 61 | 0 | 5917 ms | 5757 ms |

Each viewport completed three overlay pause/resume cycles, returned to the room camera and produced nonzero draw calls and triangles without page errors. Final screenshots are in `screenshots/safehouse-performance/after-{desktop,phone}.png`. Eight existing static/camera tests passed. The existing navigation journey also passed on desktop and phone: inventory, collections, Fadecade, refresh history and repeated Safehouse returns. An initial concurrent browser run timed out; the sequential rerun passed.

These are single-run software-renderer observations, not device FPS claims. Cold loading did not demonstrate a meaningful improvement. The measured gain is elimination of idle animation callbacks while paused. Document visibility cancellation is implemented; this benchmark exercises the overlay lifecycle rather than real OS backgrounding.

Reproduce with `UI_ORIGIN=http://127.0.0.1:4195 pnpm --dir artifacts/squabblemon exec node e2e/verify-safehouse-performance.mjs` against a dev server with E2E authentication enabled. Results are written to `/tmp/safehouse-performance-after.json`.

## Cold artwork loading pass

The Safehouse board's six PNG textures now use full-resolution lossless WebP variants; the same variants serve the opened bulletin UI. The preview/onboarding screens use the lossless WebP concept art. Original PNGs remain available as source artwork. Seven binary checks verify unchanged dimensions, every alpha value, and every visible RGB channel.

The shared scene loader preloads Three.js only after selecting a live Safehouse, fetching it alongside the scene module rather than waiting for the import graph. Static/reduced-motion previews do not preload the renderer. The fallback poster uses asynchronous decoding and low fetch priority so it does not compete as strongly with the live scene.

### Controlled comparison

Three fresh Chromium contexts for each version, 390×844, device scale 1, medium scene quality for both versions, cache disabled, 4 Mbps download, 100 ms latency, 4× CPU throttling. Software WebGL. The real Safehouse document is embedded in a small test host to isolate its resources from Vite development-module overhead and authentication. This measures scene loading, not production end-to-end login or full application startup.

| Median/identical resource measure | Before | After |
| --- | ---: | ---: |
| First rendered room frame | 13,856 ms | 12,997 ms |
| All scene image loads/decode callbacks completed | 41,683 ms | 33,632 ms |
| Board texture downloads | 14,036,488 bytes | 10,477,744 bytes |
| Total scene resource downloads | 20,023,508 bytes | 15,918,659 bytes |
| Final draw calls / triangles | 613 / 119,840 | 613 / 119,840 |

Complete artwork arrived about 8.1 seconds sooner (19%). Total scene downloads fell by 4,104,849 bytes (3.9 MiB). Each run requested Three.js once. First-frame improvement was approximately 0.9 seconds (6%); these local samples do not establish device FPS or production startup timing.

The first-frame readiness message remains distinct from artwork completion, as before. No texture resolution, camera geometry, animation rate, combat logic or reward behavior changed.

Reproduce: `PERF_LABEL=after UI_ORIGIN=http://127.0.0.1:4195 pnpm --dir artifacts/squabblemon exec node e2e/verify-safehouse-cold-load.mjs`. Results: `/tmp/safehouse-cold-after.json`. Use `PERF_LABEL=before` against the prior source to collect baseline results.

Screenshots: `screenshots/safehouse-performance/cold-{before,after}-phone-{1,2,3}.png`; actual game and bulletin screenshots use `optimized-{room,board}-{desktop,phone}.png`.

Validation at the end of the artwork pass: 15 Safehouse geometry/art tests, client TypeScript, production build and bundle budgets pass. GameApp remains 852.4 KiB / 900 KiB; Home is 937.2 KiB / 1200 KiB before the optional-popup split below.

Full-game browser validation also passed on desktop and phone: live room, all six WebP board resources, bulletin open/close, and return to a rendered room with final screenshots. Explicit static and reduced-motion previews loaded their artwork with zero scene iframes and zero renderer requests. These UI checks use controlled API fixtures on the local game preview.

## Optional Safehouse popup loading

Home now uses a small deferred Growth Lab wrapper. The full lab imports on its CTA's hover, focus, pointer-down, or opening request. Intent prepares code without mounting the lab or its full artwork. Opening mounts it once; later closes keep that instance available, preserving pending claims, receipts and watering animations. `?notice=growth` still opens the lab. A temporary native loading dialog can be closed while the import is pending; completion does not reopen a cancelled popup.

StarterMythic and JohnHenryMythic retain their initial status queries, lightweight shortcuts, eligibility labels and claim controllers. The starter's existing one-time intro/ready presentation remains in its controller. Full roadmap content moves into separate dynamic modules. The character artwork used by visible shortcuts stays immediate; the full John Henry roadmap, starter background and Growth clipboard/can/plant content mount only after the relevant feature has been opened. After the first opening, content remains mounted across closes.

NotificationProvider's existing account-rewards query still runs on Home for the Growth notification indicator. The cold Home verifier expects that lightweight observer; this change does not claim to eliminate all account-status requests or change their polling intervals.

`createDeferredModule` shares concurrent imports, keeps successful results, and releases failures for retry. The popup loader passes the full module namespace to preserve its public component export names through production bundling. A recognized failed same-origin feature entry can retry with a fresh URL query, avoiding the browser's cached failed entry without reloading the active page. Unrecognized errors and failures in shared dependencies remain caught and show retry/close UI; they are not claimed to recover through the feature-entry workaround.

Styles retain their established global cascade. Growth's `account-rewards.css` and the roadmap glyphs' `game-ornaments.css` already load through `gameStyles.ts`; this pass defers component code and artwork rather than introducing a deferred CSS preload requirement.

Six focused loader/URL-retry tests and source syntax checks passed during implementation.

### Controlled local popup verification

Playwright Chromium against the local Vite preview with controlled API responses passed the following journeys. These are client UI and resource-loading checks, not live account grants or production deployment measurements.

- Real Home at 1440×960 and 390×844 requested zero full popup modules and zero full popup artwork before intent/open. The existing notification observer made one account-status request. Hover imported feature code without mounting its body/art. All three popups opened, closed and reopened with retained DOM content, no repeated import and restored trigger focus.
- Home's `?notice=growth` opened the lab. Starter intro/ready presentation occurred at the existing eligibility states; intro history prevented repeat presentation and a collected reward retired its shortcut. Slow Growth imports handed focus from loading to the full dialog correctly. Cancelling loading left the page usable, and late completion did not reopen the popup. A failed Growth entry recovered through a fresh-query retry without a page error.
- The wrapped Growth journey passed desktop, phone, 320-pixel phone and landscape layouts: check-in, partial/full can progress, watering, seven saved plants, harvest reward, reload, close/reopen, and watering failure/retry. The fixture recorded no premature plant or duplicate saved reward.
- Starter passed desktop/phone banner and Home shortcut states, locked eligibility, ready claim, duplicate protection, one-time intro/ready presentation, API loading retry, claim failure and recovery of an already saved claim.
- John Henry passed all eight roadmap chapters, desktop ready and phone locked/duplicate/collected states, centering and decoded images, one POST under repeated claim input, saved balances/character or duplicate shards, retained reopening, API loading retry, failed claim retry and already-saved claim recovery.

Evidence: `/tmp/popup-loading-browser.log`, `/tmp/deferred-growth-browser.log`, `/tmp/starter-deferred-browser.log` and `/tmp/john-henry-deferred-browser.log`. Home screenshots and JSON reports are under `screenshots/safehouse-performance/`, including `popup-{growth,starter,john}-{desktop,phone}.png`. Starter's focused screenshots are under `/tmp/starter-mythic-*.png`.

### Compiled production popup proof

The isolated production fixture build and verifier passed for all three real feature modules. The emitted namespaces preserved `BuddyGrowthLab` (plus `BuddyPlant`), `StarterMythicDialogContent` and `JohnHenryDialogContent`. For each feature, an injected entry-fetch failure produced one Vite preload-error event, the visible retry control requested the same compiled entry with a fresh query, full decoded content appeared, and later reopening made no further module request. Each case used exactly two feature requests and one document navigation, with no page error or automatic reload. Native close completion is awaited before the verifier reopens through an actual UI click.

The fixture uses the normal production plugins/minifier and no authentication transform. Its original public artwork is supplied by controlled test routing; this is compiled client/module behavior, not a deployed account or production API claim. Evidence: `/tmp/deferred-popup-production-rerun.log` and `screenshots/safehouse-performance/production-popup-verification.json`; screenshots use `production-retry-{BuddyGrowthLab,StarterMythicDialogContent,JohnHenryDialogContent}.png`.

### Integration validation and bundle impact

The full integration run passed 1,831 application tests, five bundle checks and eight balance-patch checks (1,844 total), plus all 15 Safehouse geometry/art checks, frontend TypeScript and the normal production build. Collection catalog scroll/tab restoration with browser Back/Forward and repeated live Safehouse navigation on desktop/phone also passed.

Normal production bundle budgets passed: public entry 211.3 KiB / 475 KiB, GameApp static graph 852.4 KiB / 900 KiB, and Home static graph 922.0 KiB / 1,200 KiB. Home previously measured 937.2 KiB before this optional-popup split, a reduction of 15.2 KiB in its startup graph. The three emitted optional feature chunks are 12,844 bytes (Growth), 4,020 bytes (Starter) and 3,664 bytes (John Henry); the ordinary production build preserves their named component exports too. These figures describe JavaScript splitting, not artwork transfer savings, login time or device FPS.

The resource, reward UI and navigation proofs above use controlled local responses. No production API claims or live account grants were exercised. This pass establishes deferred code/art request behavior and retained/recoverable popup interaction; it does not assert a new end-to-end startup timing or device FPS improvement.

### Separate follow-up findings: account changes during pending claims

These are source-level observations of existing code, not reproduced account-switch failures or regressions introduced by the deferred content extraction. They were left outside this performance pass:

- JohnHenryMythic assigns `activePlayer` during render, but its profile-change effect cleanup clears that ref without assigning the new profile in the effect setup. A same-instance profile change needs a dedicated claim-response ownership test.
- Both mythic controllers reset open/receipt/error state on profile change, but do not reset busy state there. An old in-flight claim whose finalizer declines to update the new profile may leave busy state behind; controller/provider remount behavior must be established before changing this logic.
- BuddyGrowthLab invokes `save()` before its mounted check after claim/water responses. A route/account unmount while a request is pending needs an explicit test proving an old response cannot replace the current bootstrap cache.
