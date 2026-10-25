# Squabblemon design and engineering standards

Adopted from the October 24, 2026 creative brief. Apply alongside [Game UI principles](game-ui-principles.md), the [popup design system](popup-design-system.md), and the specific scene's approved direction. These are working requirements; they do not certify that all existing surfaces already satisfy them. The [architecture audit and release roadmap](../docs/audits/architecture-beta-2026-10-24.md) records current gaps.

## The product standard

Squabblemon should feel like a place: the gym, corner store, Safehouse, dossier, street poster and authored fight each have their own identity. Reuse typography roles, controls, materials and behavior without making every experience the same popup. Rich neon, character animation, cinematic impacts and environmental detail are appropriate when they serve the scene. Removing redundant UI does not mean removing the world's personality.

Preserve approved artwork, card readability, existing game rules and complete reward receipts. Use fist emblems, never crowns. Display fonts belong to short titles and expressive numbers; use the established readable text roles for rules, odds, errors and consequences. Do not replace the shared cascade with another global override to solve a local defect.

Every screen must make the player's current decision and primary action obvious. Prefer one useful control over separate controls for every computed case: the existing Single/Multi ticket controls, for example, can quote the affordable batch. Show the exact quantity and cost before purchase. Keep consequential odds, guarantees and retry state discoverable; they are not fluff.

## Feedback and pacing

An input should acknowledge the player promptly. The existing UI guide's roughly 100–250 ms feedback range is a design target, not a measured API latency claim. Never add an arbitrary wait to hide a slow request or make a receipt feel expensive.

Distinguish input feedback, authoritative persistence and cinematic presentation. A reward is saved before its ceremony, and the ceremony presents that saved result. Skip, refresh, buffering, a hidden tab or failed media must not change a grant, charge twice or strand the player. Preserve authored readable beats; remove dead air and accidental flashes using recorded transitions, not guessed timer reductions.

Reduced motion and sound preferences apply across CSS, Framer Motion, video, WebGL and audio. Simplification preserves all information, controls and outcomes. Finite effects must terminate; inactive scenes must stop unnecessary work.

## Performance is measured work

Before optimizing, identify the workload, source revision, viewport, renderer, cache state, network conditions and device or CPU throttle. Compare equivalent before/after runs. Record frame time and input delay separately from network latency, transfer size and memory. A small bundle does not establish a smooth battle; a fast fixture does not establish production performance.

The current enforced transitive JavaScript ceilings are owned by [check-entry-bundle.mjs](../artifacts/squabblemon/scripts/check-entry-bundle.mjs): public entry 475 KiB, GameApp 900 KiB and Home 1,200 KiB. Treat them as ceilings, not targets. Keep its prohibited eager dependencies, the [style invalidation guard](../artifacts/squabblemon/scripts/check-style-invalidation.mjs), and the [battle performance harness](../artifacts/squabblemon/scripts/battle-performance.mjs) intact. Changes to a budget need an explicit rationale and retained baseline; do not loosen a threshold to make a regression pass.

Load optional work on route intent or feature entry, share immutable data, bound preloading and retire unused media. Deferring code moves its cost; it does not eliminate that cost. Profile the eventual interaction as well as startup. Use caching, reduced repeated computation or narrower subscriptions when those address the actual cause. Avoid introducing another frame loop, timer or broad provider update without evidence it is needed.

New media must have an approved source, delivery derivative, dimensions, duration, byte size and provenance. Verify the selected frames at phone and desktop framing. Optimize encoding and loading without substituting rejected frames, hiding art, or claiming pixel identity for lossy output.

## Authority and API contracts

The server owns balances, inventory, eligibility, rewards and match results. The shared engine owns common game rules. The client owns input intent and presentation of confirmed state. A local animation or notification must never independently grant a resource.

Every consequential mutation documents authentication, authorization, validated input, expected response, error recovery, transaction boundary and retry identity. An identical retry returns the original result; reuse of the same key for different intent is rejected. Cross-account responses and local journals must not leak or apply to another signed-in player.

Keep OpenAPI, generated clients/validators and actual request/response behavior aligned. A hand-written endpoint needs an explicit typed contract and coverage until it is incorporated. Names that match the player journey help navigation, but cannot replace documented errors, invariants or compatibility rules.

Use additive, compatible changes for rolling client/API releases. A saved request retains its original count, payment method and banner occurrence even if balances, schedules or capabilities change. Verify competing writes and rollback with independent database connections when the change affects money or progression; a mocked request alone cannot establish transaction safety.

## Modularity and verification

Separate pure rules, transport/persistence, orchestration and rendering when there is a real ownership boundary. Extract from proven behavior rather than rewriting a large feature solely to reduce line count. A useful module owns a lifecycle and has a small, stable interface.

Modularity reduces the affected test surface; it does not remove integration risk. Run focused checks for the change and the boundaries it touches. Wallet, auth, shared engine, bootstrap, global styles, migration and navigation changes require broader regression coverage than isolated copy or layout changes. Preserve tested retry and lifecycle behavior during extraction.

Local and deployment build paths must enforce the same required checks. Keep a maintained inventory of critical tests and a separate, explicit tier for expensive browser/device/database checks. A test file existing in the repository is not evidence that the release gate executes it. Avoid redundant tests that only repeat implementation details.

## Current gameplay evidence

Use the [current deck evidence index](../docs/balance/README.md) for recommendations and balance decisions. A report is current only while its rules version, card balance version, roster, harness policy, runtime resolution and source fingerprint match the audited game. Re-run the freshness check before using its ranks; regenerate the complete matrix and coverage probes after a relevant change. Preserve older raw reports as historical evidence.

Publish named ten-card rosters with simulation rankings, both seat and policy splits, paid-choice coverage and the gaps the run did not exercise. Separate base PvP from upgraded PvE, training bands and human results. No fixed-policy simulation establishes player win rates, a card's universal strength, or a deployment result. A source change invalidates the old recommendation even when an old pinned test still passes.

## Usability across real contexts

Verify the actual route shell at 320×568, 390×844, short landscape 844×390, tablet and desktop. There must be a deliberate vertical scroll owner, reachable actions, preserved artwork and no unintended horizontal overflow. Intentional rails and large populated battlefields remain usable.

All important controls need visible focus and practical touch targets; the project's primary-control target is 44 CSS px. Dialogs need an accessible name, correct initial focus, contained keyboard focus, unavailable background interaction, supported dismissal and focus return. Visual material primitives do not supply these behaviors by themselves. Use state text, icons or shape in addition to color.

Check the saved in-game preferences as well as OS settings. Test text enlargement, keyboard-only navigation, screen-reader announcements and reduced motion in the real flow. Automated geometry and semantic checks are useful evidence, not a blanket accessibility-compliance claim.

## The collaboration and release protocol

1. State the player problem and identify the approved reference, exact surface and behaviors to preserve.
2. Inspect the current implementation, reproduce the issue and record the relevant baseline. Distinguish a proposed feature from something already delivered.
3. Make the smallest coherent change that solves the whole player problem. Keep exact rewards, rules, account boundaries and recovery behavior intact.
4. Review the result in its real context. Record what changed, which checks ran, their revision and environment, and remaining uncertainty.
5. Update the relevant design/contract document when a reusable decision changes. Reference shared standards instead of copying them into more competing documents.
6. Publish only the authorized, tested scope. Confirm the remote commit. Call it deployed only after the hosting environment reports the matching ready revision; call a player journey validated only after that journey actually ran there.

Use evidence states: **source inspected**, **local check passed**, **isolated database/browser check passed**, **physical device checked**, and **deployed revision checked**. Do not compress these into an invented completion percentage. Real player feedback should record the journey, device, visible symptom, expected behavior and reproducibility; prioritize blockers and recurring friction before additional decoration.
