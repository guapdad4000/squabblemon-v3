# Battle visuals and performance audit

Scope: source inspection of the current working tree, October 2, 2026. This is an optimization inventory, not a measured performance result or an implemented patch. The tree contains extensive existing changes, including battle, video, and Safehouse code; findings describe that working tree, not a proven regression introduced by a single commit.

## Visual diagnosis

The described shape is usually called an impact burst, radial burst, or shockwave. Exact identification of the spiky outline still requires a captured frame. There are several candidates, and changing one indiscriminately could miss the visible culprit:

- `src/components/battle-presentation.css:88`: attack rings have a 3px outer stroke, 5px white inner stroke, 8px fire variant, and 7px Squabble variant. The ripple scales up to 1.5. Thick strokes and glow can dominate small card art.
- `src/components/battle-effects.css:23`: a second shockwave uses a 3px border and grows to 1.9 scale. Every burst also mounts 12 glowing fragments; burn adds slashes and a jagged scorch edge.
- `src/index.css:579`: legacy lane-impact sprite sheet contains illustrated impact artwork. The legacy district ring is 4px, but the newer battle presentation stylesheet hides district pseudo-elements. Verify the actual render path and computed style before changing these older rules.

Proposed visual treatment: normal rings around 1–1.5px, major impacts around 2–2.5px, with a thinner white highlight. These are starting values for visual comparison, not final validated sizes. Keep color, radius, fragments, recoil, timing, and character-specific art. Avoid increasing apparent line weight as the ring expands: test explicit SVG radius animation or non-scaling strokes under the actual browser transform. For a raster burst, edit the asset's outline instead of applying a global filter to the entire effect.

## Prioritized implementation inventory

P1 = first implementation/profile pass. P2 = pursue if traces show material cost. Conditional = needs a visual-equivalence experiment; do not silently trade quality for speed.

| Priority | Opportunity | Concrete approach and quality guard |
| --- | --- | --- |
| P1 | Thinner impact outlines | Tune the active ring and burst, including fire and Squabble overrides. Compare phone/desktop and both themes at impact frames. |
| P1 | Whole-card animated filters | Entry animations animate brightness and broad drop shadows over the card subtree. Recreate the highlight on a small overlay and animate its opacity/transform; preserve card art, glow shape, and recoil. |
| P1 | Repeated impact surfaces | Inspect simultaneous SVG rings, CSS shockwaves, fragments, status feedback, and finishers. Combine identical rendering work while retaining each visible cue; do not just delete effects. |
| P1 | Board-wide layout reads | `BattleAttack` reads every board card on mount and impact, plus a follow-up frame. Use an instance-ID element registry and measure only source, chain predecessor, targets, and changed cards. Preserve pre-move/destruction positions and invalidate on resize/scroll. |
| P1 | Video processing tied to display RAF | `SpecialMove` wakes on RAF and gates draws at 24fps. Schedule from decoded video frames where supported, keep the intended cadence, and cancel/resume cleanly for visibility and pause. Test playback-rate and seek behavior. |
| P1 | Video copy/upload pipeline | `chromaRenderer` currently draws into a 2D staging canvas before uploading to WebGL. Compare direct video texture upload with the current small upload. Direct upload is not automatically faster: full-size video textures may cost more. Match crop, orientation, resampling, alpha, and chroma edge quality. |
| P1 | CPU chroma fallback | The fallback reads and writes pixels every frame. Profile it explicitly. Consider pre-keyed alpha assets with codec fallback, or worker processing where supported, preserving color and edge fidelity. |
| P1 | Effect cleanup | Frozen status mounts an entrance burst whose particles remain after fading. Retain persistent ice/chains but unmount completed transient particles; release any animation layers. Verify freeze reapplication and status changes. |
| P1 | Presentation latency | Standard effect timing is 450ms before + 650ms after, with special clips able to extend it. Measure input-to-feedback separately from frame rate. Overlap only independent decorative tails with subsequent presentation; preserve causal ordering, readable numbers, sounds, and complete finishers. |
| P1 | Mode parity | Solo/story/online presentation paths have differing timing logic. Exercise them separately and centralize shared scheduling where safe. Include replay, skip, cancellation, and round transitions. |
| P1 | Production baseline | Profile the actual production build with visible cards and real effect chains, not just an empty arena or development build. |
| P2 | React update scope | Cards already have memoization. Profile what bypasses it: object identity, changing effect props, match-wide computations, HUD timer updates. Isolate timer/HUD/FX updates and retain identity for unchanged cards. |
| P2 | Derived battle data | District results, intent, previews, and marks depend on match state. Cache by the state slices actually used, only where traces show repeated work. Never use stale power/status computations. |
| P2 | Static particle data | Reuse fragment styles and geometry rather than constructing them each render. Small gain; do after larger paint/layout work. |
| P2 | Paint bounds | Keep effect surfaces close to their visible bounds; test containment and temporary compositor promotion. Do not clip beams, shadows, floating numbers, or overflowed portraits. Avoid permanent `will-change` on every card. |
| P2 | Animated shadow/clip-path work | Ice spread animates inset shadow; burn-away animates polygon clipping and brightness. Compare cached masks/sprites or bounded overlays at matching frame quality. |
| P2 | Asset decode stalls | Warm the current hand, upcoming opponent, and imminent move assets before impact with a bounded queue. Reuse existing warmup utilities; do not preload the whole roster. Test cold and warm caches. |
| P2 | Oversized art | Supply appropriately sized portrait/effect variants for board, hand, and inspector. Preserve high-resolution inspector art and enough pixels for scale peaks and device DPR. |
| P2 | WebGL lifecycle | Verify contexts, textures, videos, listeners, timers, and observers are released after effects and repeated route changes. Pool resources only if measured setup overhead warrants it. |
| P2 | Safehouse idle rendering | `scene.js` schedules continuously; `art-direction.js` renders color, normals/depth, then composite each frame. Cache unchanged work or render on invalidation when all visible motion is settled. Keep all ambient motion; do not freeze a visibly moving scene. |
| P2 | Camera work | Update camera projection/view offset and publish DOM anchor positions only when their inputs change or positions move meaningfully. Preserve smooth tracking during movement and resizing. |
| P2 | Shadow invalidation | Shadows already use manual updates. Audit which moving objects actually affect shadows; avoid invalidating for unrelated room-detail changes. Keep swinging bag and door shadows correct. |
| P2 | Geometry/material sharing | Inventory repeated room objects for instancing/merged static geometry and shared materials/textures. Preserve culling, interaction targets, outlines, and lighting. |
| P2 | Postprocess passes | Investigate caching unchanged normal/depth buffers, batching compatible materials, and reducing redundant submissions. Existing code already reuses world matrices between passes. |
| P2 | Background lifecycle | SceneFrame's iframe is intended to unmount on route exit. Verify this in actual navigation; do not assume the Safehouse keeps rendering behind battles. Check covered overlays separately from hidden browser tabs. |
| P2 | Parallax event work | `LayeredVenue` reads bounds on pointer events and updates style variables every frame. Cache bounds with resize/scroll invalidation; coalesce pointer input. Preserve the existing ambient motion. |
| Conditional | Postprocess buffer resolution | Experiment with independently sized glow/normal buffers only if outlines and lighting remain visually equivalent. No blanket DPR reduction under a no-quality-loss requirement. |
| Conditional | Unified particle renderer | A shared canvas/atlas can reduce DOM/layer cost under large simultaneous bursts, but adds complexity and may blur small art. Only replace the current 12-fragment bursts if stress traces justify it. |
| Conditional | Adaptive scheduling | Adapt invisible/background work and preload concurrency to available time. Visible resolution, effect counts, lighting, and motion remain unchanged unless separately approved. |

## Already present: preserve and verify

- Memoized board cards and CardView comparisons.
- Coalesced ResizeObserver follow-up measurements in BattleAttack.
- GPU chroma keying with a small staging upload and CPU fallback.
- Safehouse shader preparation, manually invalidated shadows, reused world matrices for its normal pass, and bounded DPR.
- Route-scoped iframe lifecycle, hidden-tab checks, and visibility-aware parallax.
- Existing battle performance harness and asset warmup code.

These reduce the value of generic advice to add memoization, GPU processing, caching, or DPR limits. Their effectiveness needs measurement, not duplicate implementations.

## Verification and acceptance

1. Capture a normal card landing and major ability frame to identify the exact spiky asset/stroke. Inspect computed rules so disabled legacy effects are not mistaken for active costs.
2. Establish production baselines for desktop and phone viewports: idle battle, normal play, multi-target chain, frozen/locked full board, destroy/move, finisher, replay, and repeated rounds. Verify visible nonzero board cards after transitions.
3. Measure frame-time percentiles, missed frames, main-thread long-task time, input-to-first-feedback, full presentation duration, React commits/time, layout/paint, video frame processing, and memory/context growth. A 60Hz frame has approximately 16.7ms; use percentile distributions rather than average FPS alone.
4. Measure Safehouse separately: settled room, camera movement, mail/door, punching bag, day/night, resizing, leaving and returning. Capture GPU draw calls and pass costs, not draw calls alone as proof of smoothness.
5. Compare each change against the same seeded/scripted workload and build, with cold/warm runs and multiple repetitions. CPU throttling supplements real-device checks; it does not emulate a phone GPU.
6. Keep visual comparison captures at entry, maximum impact, fade, freeze, destruction, and finisher frames, at both themes and several viewport/DPR combinations. No missing effects, truncated videos, clipped glows, blurry portraits, altered rules, or lost readability.
7. Confirm gains on the launched artifact. Typechecks/builds and unit tests are correctness checks, not performance proof.

Recommended sequence: capture/baseline → outline refinement → layout and filter work → video scheduling/pipeline → update isolation and asset decoding → measured 3D improvements → cross-mode/device regression pass.

The initial audit above made no runtime changes. A subsequent implementation and its measured results are recorded in [battle-refinement-evidence/README.md](battle-refinement-evidence/README.md). That pass does not mark every conditional item in this inventory complete.
