# Combined HUD and performance release

Integrates the stable Battle HUD with the completed Safehouse, Collection and Battle performance passes on top of main at 197c8675.

## Release behavior

- Desktop HUD uses one control row with a fixed status region. Mobile and iPad keep bounded rows; commentary, recaps, reading, replay and effects cannot keep pushing the battlefield down.
- Safehouse popup code loads on intent/open, retains opened content and offers retry without reloading the game. Lossless full-resolution WebP board textures and renderer preparation also ship from the same performance pass.
- Collection keeps all catalog buttons and inspection targets while mounting nearby card faces; 267-card and synthetic 300-card phone journeys both mount 21 faces at entry.
- Battle removes unnecessary draw cleanup and card-list presence commits, preserving draw duration, hand springs, impact timing and artwork.

## Combined source validation

- 1,831 application tests, five bundle checks and eight balance-patch checks passed: 1,844 total.
- All 15 Safehouse geometry and lossless-art checks passed.
- Frontend TypeScript passed after regenerating newer main's shared-library declarations.
- The complete Netlify release build and its gates passed in staging mode, with DATABASE_URL unset and no authentication test mode in the release output.
- All 20 HUD/reading browser checks and 16 district reminder/detail checks passed.
- Desktop and phone battle journeys passed: one commit per draw, exact 800 ms motion, spring gap closure, selection and existing impact anchors/timing.
- Real 267-card and synthetic 300-card Collection journeys passed on desktop and phone, including bounded mounting, stable scroll geometry, keyboard inspection, deep scrolling, direct links and tab memory.
- Real Home deferred-popup journeys passed on desktop and phone, including loading, intent, retained reopening, cancellation, focus, automatic entry and failed-chunk retry.
- Each of the three compiled production popup modules passed export preservation, an injected entry failure, fresh-query retry, retained reopening and a single document navigation.
- Browser Back/Forward, catalog scroll and tab restoration passed.

Bundle budgets: public entry 211.3 KiB / 475 KiB; GameApp 852.6 KiB / 900 KiB; Home 922.2 KiB / 1,200 KiB.

The paired performance benchmarks in BATTLE-PERFORMANCE.md, COLLECTION-PERFORMANCE.md and SAFEHOUSE-PERFORMANCE.md were recorded by the originating agent before HUD integration. The combined release reruns functional and visual journeys, not those paired timing profiles. Normal battle still has an unresolved long-task budget failure in the prior repeated measurements; reduced motion passed. No budget was relaxed and no device FPS guarantee is made.

The combined-run logs are beside this report. Current screenshots and reports are in battle-performance, collection-performance and safehouse-performance; the HUD viewport review is in ../battle-hud-stability.
