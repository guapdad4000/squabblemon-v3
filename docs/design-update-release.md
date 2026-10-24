# Design update release candidate

The pending update makes rewards, progression and pack openings feel like one game: shared street-file/brick popup materials, clear card reveals, a monthly login roadmap and a cinematic gym sequence that carries into the saved haul.

## Player-facing scope

- Neon corner-store Fade Market, a focused three-session Training Club, Tagged/Chrome finishes and shard wallet in the Style Closet, and a permanent guaranteed Neighborhood Recruit sheet. Existing purchase prices, rewards and retry identities are preserved; old item links migrate to the owning counter. See `design/shop-departments.md`.
- Shared reward and confirmation typography/materials; readable store receipts and compact wallet arrivals tied to existing notifications.
- Monthly login roadmap with one exact-tier card milestone for all seven tiers; server UTC month reset, missed-day progress preserved within the month, and a reachable February finale.
- Weekly featured banner rotation, affordable 1–9 pack batches alongside the existing special ten-pull, and separate monthly pull-count bonuses.
- Ranked human-match Clout receipts, including the eligibility rules and daily limit; retry/reconnect cannot pay twice.
- Story poster progress/continue clarity, condensed Growth Lab, and more prominent boss presentation.
- Complete card frames with foil disabled, viewport-scaled haul cards and full-screen nested card inspection.
- New gym artwork, three punch cels, a 900 ms real Three.js bag launch, curated fixed-bottom rarity POV footage, smoke-to-wall handoff and an immediate card reveal with a brief turn.

## Current entrance

The reveal mounts the actual collectible print immediately at full opacity and near full size, with a small alternating slide/turn that settles in 300 ms. The caption is immediately visible. There is no contact pause, deep flight, added impact burst or delayed haul entrance. Controls remain usable immediately; reduced-motion preferences remove the turn. First-time character unlocks show the card immediately too; their banner intro is now an optional replay rather than a three-second gate. No new media, request loop, frame-by-frame React state or permanent animation is added for this entrance.

The issued receipt starts bounded background preparation of the first two printed cards, using the same element frame/fist URLs as the renderer, before continuing the existing portrait queue. This covers the ten-pull ordering rule without changing it. The reveal never waits for this preparation; there is no synchronous decode or new loading gate. During the opaque smoke shot, the real first print also mounts behind it in an inert, aria-hidden dialog. The same tree is promoted to the modal layer when the film ends, avoiding a cold mount on the cut. The gym geometry stays fixed until dismissal.

The former post-smoke still hold (250 ms single/partial; 650 ms ten) is removed. Every pull size now hands off at 5,317 ms. The reveal no longer changes background brightness or replays the impact foreground; buffering retains the last presented video frame.

## Release mechanics

The approved update was prepared for publication on October 24. Its base revision is ac831ed76e376e5f3dfef561c49a40f8fde844b7; a fresh remote check before publication matched that base. Local fixtures and successful builds validate the source candidate, not a completed production deployment.

Include the additive Netlify-native migration `netlify/database/migrations/202610240001_ranked-clout-daily-index/migration.sql` with the API and client changes. It mirrors the development migration for the account/date claim index. Native PostgreSQL rollback/retry/replay and coverage checks pass. There are no destructive schema changes. Existing JSON receipts and optional API fields remain compatible; the client checks partial-pull capability before offering those batches.

The local evidence directory is `/home/falcon/Documents/New project 9/output/design-release-ready/`. Backend details and exact reproduction commands are in `backend-readiness.md`. The current quick-entrance evidence is under `quick-entrance/`; older 960 ms entrance evidence is superseded. Final source and build logs are under `source/`.

## Media delivery

New media delivery is **20,701,530 → 12,691,089 bytes (38.70% smaller overall)**. This second pass saves **3,078,074 bytes (19.52%)** beyond the previous optimized package. Active video is now 8,895,525 bytes; seven illustrations total 2,383,720 bytes and six posters total 1,219,704 bytes. The selected rarity POV plus shared landing requires 2.93–3.80 MB. Dimensions, approved frames, duration, framing, silent video tracks and transparency remain intact; this is lossy encoding, not a pixel-identity claim. Visual comparisons showed no obvious loss in the reviewed frames. Original source media and prior delivery derivatives are preserved in the local optimization archives.

Reproducible manifests and audit are in `design/media/gacha-2026-10-24/`. Provenance metadata is outside public delivery. The four active sound effects and two Clout images were already appropriately small and remain byte-for-byte unchanged.

## Verification scope

Fresh publication checks on October 24 pass: 137 focused frontend source tests, 75 API/engine/journal tests in isolated native-PostgreSQL runs, 22 migration guard tests, migration coverage, frontend/API/engine typechecks and the production frontend build with bundle/style guards. Exact commands and logs are in the primary workspace under `output/design-final-push/`. Some journal/source tests overlap between suites; do not sum these counts as unique coverage.

- Follow-up Market QA removes the stretched shared chalk texture and uses container-sized shelves. Eight widths from 320–1920 px pass with all products reachable; phone shelves show two complete cubbies and the smaller Closet sticker sits above the shelf tabs; three mouse/touch interaction contexts and Gym/Safehouse native-event probes pass. Actual Recruit right-click inspection remains available. Game viewport X containment preserves intentional rails and vertical scrolling. Evidence: `output/fade-market-responsive-v3/` and `output/game-surface-policy/` in the primary local workspace. Legacy ticket recovery and late pack-response account/request guards are covered by `output/shop-counter-relocation/purchase-recovery/`.

- The shop-department pass adds desktop/phone Training and permanent Recruit checks, four finish-counter viewports, three Market viewports and delayed-response/account-switch checks. Frontend typecheck, production build, bundle budgets and CSS/panel guards pass. New corner-store art is 256,546 bytes; its prompt and provenance are in `design/media/fade-market-corner-v2/generation.json`. Detailed local-only evidence is linked from `design/shop-departments.md`.

- Current focused frontend groups pass: 50 cinematic/reward, 47 broader design/monthly/boss/forms, 31 shop relocation/recovery, 4 warmup lifecycle, 4 gym battery and 1 loading check (137 total). Earlier browser evidence remains scoped as described below.
- 75 API/engine/journal checks in native runs and 22 migration guard tests pass; the API and engine typechecks and PostgreSQL migration replay checks pass.
- Earlier four reveal fixture and two Shop integration cases cover responsive layout/inspection, 60-card reachability, quick Next replay, saved receipts, refresh recovery and the card-first styled unlock. They predate the latest handoff change.
- The current no-routing, normal-cache desktop and phone handoff cases both pass. The actual first-card tree is inert and prepared under the smoke, retains DOM identity through modal promotion, and appears fully printed on the first recorded reveal frame. Last presented smoke frame to modal measured 25.2 ms desktop / 45.6 ms phone; the earlier desktop baseline was 332.4 ms with a 286.9 ms separate still hold. No brightness flash, empty shell, or early card leak was observed. Evidence: `/home/falcon/Documents/New project 9/output/gacha-handoff-fix/README.md`.
- The 28 focused timing/film/battery checks pass, including no post-film hold and last-frame retention on buffering. Three maintained cinematic browser runners were updated for the new timeline and syntax-checked; their broader historical suites were not rerun this pass.
- Browser evidence uses locally issued deterministic receipts, actual media and Chromium's software renderer. It is not live purchase, production, physical-device or adverse-network proof. Normal-cache baseline testing confirmed that the staged painting was not solely a side effect of the earlier routed fixture; preparing the actual print tree fixed it in the current captures.
- Final frontend typecheck and production build pass. Entry JavaScript is 211.5 KiB / 475 KiB; GameApp 650.6 KiB / 900 KiB; Home 956.1 KiB / 1200 KiB. The CSS invalidation guard and panel source guard pass. The existing 575.14 kB Story chunk still emits Vite's advisory size warning.
- `git diff --check` passes. Only the approved design/API/media scope is included in publication; unrelated work in the primary checkout remains untouched. Publication does not itself confirm production deployment.
