# Collection viewport performance

The catalog keeps every button, label, acquisition badge, and inspection target in place. Full card faces mount only within 640px of the scroll viewport, plus focused cards, the active acquisition highlight, and a directly linked card. One observer releases distant faces again after scrolling. Card artwork, finish treatment, and resolution are unchanged.

## Measured real roster: 267 cards

Controlled signed-in API fixtures, real `/game/collection` route, local Vite server, headless Chromium, fresh browser contexts, no CPU/network throttle. Entry was sampled 1.5 seconds after the catalog appeared. The before run restored the saved pre-change Collection module and CSS; other application code was identical.

| At entry | Desktop 1440×960 before → after | Phone 390×844 before → after |
| --- | ---: | ---: |
| Catalog buttons | 267 → 267 | 267 → 267 |
| Mounted full card faces | 267 → 63 | 267 → 21 |
| Grid descendants | 8,816 → 2,696 | 8,816 → 1,436 |
| Requests observed by entry sample | 574 → 371 | 574 → 329 |
| Visible complete card faces | 36 → 36 | 9 → 9 |
| Full scroll height | 6,413px → 6,413px | 15,956px → 15,956px |

Deep scrolling retained 51 desktop / 21 phone faces instead of all 267. Returning to the top retained 64 / 22; the extra face was the still-focused keyboard target. Every visible card had nonzero geometry and loaded artwork, with no sideways overflow or changed grid height.

Reports: [before](screenshots/collection-performance/before-report.json), [after](screenshots/collection-performance/after-report.json). Final real-roster screenshots: [desktop](screenshots/collection-performance/after-desktop.png), [phone](screenshots/collection-performance/after-phone.png).

## Future roster stress: 300 cards

The separate stress fixture appended 33 copies of real card definitions with synthetic catalog IDs inside the intercepted test module. It reused existing artwork and did not modify production card data. This verifies mounting/layout behavior at 300 cards; it does not estimate downloading 33 new unique images.

| Mounted faces | Desktop | Phone |
| --- | ---: | ---: |
| At entry | 63 of 300 | 21 of 300 |
| Deep scroll | 48 of 300 | 21 of 300 |
| Return to top | 64 of 300 | 22 of 300 |

All 300 controls remained present. Scroll heights stayed 7,254px / 17,916px across the journey. [Stress report](screenshots/collection-performance/after-stress-300-report.json), [desktop screenshot](screenshots/collection-performance/after-stress-300-desktop.png), [phone screenshot](screenshots/collection-performance/after-stress-300-phone.png).

## Verification

Both roster sizes passed on desktop and phone: visible faces/loaded images, nonzero geometry, bounded mounting, stable height, deep keyboard inspection and returned focus, scroll/revisit, direct-card link inspection, Escape dismissal, remembered Gang Wall after reload, and zero browser exceptions. Twelve unit tests passed, covering window replacement at 300 cards, unchanged state identity, batched entries, and existing acquisition discovery behavior.

Run from the repository root against a local server with `VITE_E2E_AUTH=true`:

```sh
pnpm --dir artifacts/squabblemon exec node --import tsx --test src/lib/collectionCardViewport.test.ts src/lib/collectionCardDiscovery.test.ts
UI_ORIGIN=http://127.0.0.1:4195 pnpm --dir artifacts/squabblemon exec node --import tsx e2e/verify-collection-performance.ts
UI_ORIGIN=http://127.0.0.1:4195 COLLECTION_STRESS_TOTAL=300 pnpm --dir artifacts/squabblemon exec node --import tsx e2e/verify-collection-performance.ts
```

The before comparison additionally requires `COLLECTION_BEFORE_MODULE` and `COLLECTION_BEFORE_CSS` pointing to saved Vite-compiled pre-change responses. Stress output filenames include the roster size so they cannot overwrite the real-roster report/screenshots.

These are controlled development-server results, not production request counts or physical-device FPS measurements. Lower mounted-face/DOM counts and fewer entry requests are demonstrated; first-load latency, sustained frame rate, image-cache residency, partial-ownership browser behavior, and no-IntersectionObserver fallback have not been separately benchmarked. Source review confirms ownership/locked/undiscovered states, acquisition order/badges, variants, notification IDs, inspector behavior, and tab memory remain intact; unsupported browsers retain full faces. A final rerun recaptured the real 267-card screenshots/reports and passed both viewports with the same metrics. The separately labeled stress screenshots show the synthetic 300-card fixture.
