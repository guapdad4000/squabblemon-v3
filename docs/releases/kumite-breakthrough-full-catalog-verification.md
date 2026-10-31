# Breakthrough full-catalog implementation verification

This is the historical October 29 verification of the original 301-card candidate. The subsequent Anunaki integration has 311 canonical cards, 301 reviewed Breakthrough adapters and 10 unsupported Anunaki cards. See `kumite-breakthrough-all-cards-launch-gate.md` for current coverage and blockers; the evidence below does not certify the added cards.

At that candidate revision, the local mode implemented every collectible: 278 characters, 13 supports and 10 blockbusters. All 15 canonical starter crews validated and finished CPU simulations. This completed that revision's missing-card implementation scope; public launch remained closed.

Source lives in the isolated `codex/kumite-breakthrough-integration` checkout, based on `77f44c8b597a908202d5f65b8ecc293e4b47f5d6`. The original dirty audition checkout is preserved. Ruleset: `breakthrough-v9-full-catalog`. No commit, push or deployment occurred in this pass.

## Gameplay and input

All previously missing families have concrete handlers, source-aware interactions and real-time timing. Supports/blockbusters use action admission rather than zero-Hand fighters. Manual investment/concert/wager choices are explicit and revalidated atomically. Generated tokens/resources, copied kits, echoes, deferred entrances, bodyguards, shields, refunds, transforms and recruited ownership have focused reducer tests.

Fixes discovered during integration include redirected follow-ups hitting the wrong target; high-Hand interceptors executed through a weaker target's threshold; shared shields missing Burn provenance after source removal; delayed statuses expiring immediately; returned cards rearming identity-scoped effects; Scammer failing to restore its printed kit; uncollectible tokens accepted from a tampered hand; Mary losing suspended status/form state; and summoned damage crediting its summoner.

The final mobile UI check found and fixed a separate placement issue: when a card is selected, tapping an occupied lane's fighter/resource now plays the selected card into that lane. With no card selected, inspection remains available. This does not change native drag or wait on animation.

## Local evidence

The authoritative build record is `output/kumite-breakthrough-full-catalog-20261029/release-build.json`; **1,267 required tests passed**, including **987 Breakthrough checks**, with zero failures, skips or todos. It includes the entire required test inventory, production Vite build, Story delivery and existing JavaScript/CSS budgets. Shared-library, frontend and API TypeScript checks pass separately. All 17 rule-module hashes participate in release evidence invalidation.

The complete registered suite exercises every collectible through legal immediate deployment, invalid-input purity, Last Stand and JSON checkpoint continuation, alongside authored unit and integration cases. This is broad local behavior evidence, not an automatically complete manual acceptance ledger for every interaction.

Observed browser geometry at 320×568, 390×844, 768×1024, 844×390 and 1280×720 had zero horizontal overflow and zero broken visible images. A real 320×568 investment popup kept all five choices on screen with approximately 59px option heights. Tapping an opposing fighter selected its lane, explicitly investing1 extra Motion deployed Homeless Guy immediately with6 Hands, and the live wallet matched the3-Motion total cost. The clock kept running while choosing. No console errors were observed in the final smoke test. Temporary QA profiles/tabs were separate; the browser viewport was reset. These are desktop browser viewport checks, not physical-phone evidence.

Approved mode media is unchanged: 54 files, 16,348,370 bytes, byte-identical to the approved audition source. No new raster media was generated for this card pass.

## Measured optimization

The full catalog exposed a dense global-pulse cost. A per-roster identity index and a direct unchanged-definition path avoid repeated 301-entry searches and object allocation. Same-ID replacement, mutation, reordering, misses and runtime overlays are covered by five regressions. The cache is weakly held and never enters serialized match state.

Under the same local Node workload, an 80-fighter + 8-resource pulse p95 dropped from 58.9ms to 10.6ms (1000 samples). A final formatted-candidate check under concurrent release work measured 14.9ms p95, 18.0ms max and zero samples over the 50ms reducer step. Four complete CPU-match state hashes match exactly before and after. Dense 40 and ordinary 80 cases also improved. This measures the reducer, not browser painting or physical mobile frame time; workload, process heap and source hashes are in `reducer-performance.json`.

## Release boundary

`BREAKTHROUGH_PUBLIC_LAUNCH_APPROVED=false`; the full eight-check acceptance ledger remains null. Hub/public routes and default room admission stay closed. Internal CPU practice grants no account rewards. No live transport, persistent room store, two-account latency/reconnect proof, authoritative trophy/roadmap progression or deployment readiness is implied by these checks.

Current policy and remaining promotion requirements are in `kumite-breakthrough-all-cards-launch-gate.md`. Exact catalog, media, browser, reducer, bundle and build evidence lives together under `output/kumite-breakthrough-full-catalog-20261029/`.
