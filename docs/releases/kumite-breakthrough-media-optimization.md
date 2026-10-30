# Kumite Breakthrough media delivery optimization — 2026-10-30

Implemented locally for the search → arena → results flow and the complete 301-card Breakthrough catalog. Approved illustrations, animation frames, timings, card capacity, rules and outcomes remain intact. This is a delivery/playback pass, not a public-launch or online-transport approval.

## Measured changes

| Scope | Before | After | Reduction |
|---|---:|---:|---:|
| 301 base-catalog portraits, aggregate encoded file sizes |103,190,366 B|13,445,364 B|86.97%|
| Fixed 10 s phone workload, required-source payload |11,908,691 B|5,368,355 B|54.92%|
| Same workload with reduced motion |11,908,691 B normal baseline|800,433 B|93.28%|
| All 17 static presentation states, encoded sources |13,909,440 B|767,152 B|94.48%|
| Corresponding single-surface RGBA arithmetic sum |141.06 MiB|2.49 MiB|98.24%|

The catalog total does **not** mean all 301 images are downloaded together. Battle rendering now selects the existing exact-revision portrait derivatives, while originals remain in engine data and gallery/inspection flows. Unknown/custom/future revisions keep their original source. All 301 current base-catalog sources resolve to existing derivatives.

The 10 s sample is the same combo vs voltage CPU match, seed 73031, no player inputs,320×568 and 1706×960 CSS viewports, DPR 0.75, local Vite, existing cache, no CPU/network throttle. Required-source payload sums unique file bytes associated with observed media paths and initial CSS plates where cached CSS omitted resource entries. It is **not actual network transfer** or a cold-cache/device benchmark. Existing browser-cache entries sometimes report 0 body bytes, so those numbers were not treated as free assets. Raw local evidence: output/kumite-media-optimization-20261030/browser-media-comparison.json (not a shipped asset).

Normal-motion frame p95 remained about 16.8–16.9 ms before/after; no FPS gain is claimed. Desktop long-task time in the sample changed 130→102 ms, phone 112→112 ms. Reduced phone recorded no long tasks, but no old reduced-mode baseline was captured. These local runs are not physical-phone or low-end-device proof. RGBA sums are texture-size arithmetic, not measured process/GPU residency.

## Runtime changes

- Removed all 11 blind startup atlas warmups, previously 7,007,290 B /124.37 MiB summed source surfaces. CSS requests an effect when its actual presentation exists; deployment never awaits an image, effect or decode.
- Unit, hand, ghost, hazard, next-card and drag images use revision-safe battlePortraitUrl at the render boundary. Arena header portraits opt into the same compact mode; shared profile/gallery defaults remain unchanged.
- The authored 650 ms fire entry node retires on its own exact animation end. Menu/rematch replays remain; hidden/child/unrelated events cannot retire it incorrectly. This removes the finished decorative node's image reference; it does not promise that the browser immediately evicts its cache.
- An independent document-visibility attribute pauses CSS presentation without confusing completed gameplay with active results. Hidden practice still requires explicit visible resume.
-17 exact, lossless native-cell stills replace entire atlases/animated W sources in reduced mode. Root CSS covers health, status, summons, smoke and loss; the W uses the tested visibility/reduced-motion media helper. All still pixels and alpha match approved source cells/frame 57 for W.
- Normal-motion originals and every authored frame remain. The 1 MiB static-delivery ceiling,512 px axis bound, provenance hashes, exact RGBA and frame geometry are enforced by scripts/check-breakthrough-media.mjs and the registered mediaBudget test. Current 17 stills total 767,152 B and 2,610,176 expanded bytes.

## Encoding decisions and repository footprint

Further 47 matchmaking encoding candidates and 9 atlas candidates were measured. Current matchmaking loops/posters/burst already have a strong size/fidelity tradeoff; candidates offered negligible or 5.3% savings with additional fidelity tradeoffs. Atlas q75 saved 12–18% with visible SSIM changes; q85 was negligible/larger. None were adopted. H.264 remains the primary opaque-video codec; no AV1 negotiation or new codec dependency was introduced. Current selected 6 animations + 6 posters remain 5,826,927 B, already 80.66% below the supplied GIF inputs.

The new stills add 767,152 B to retained assets; they reduce requested/decode work in static presentations rather than deleting animations required by normal mode. Large rejected candidates, redundant backup copies and review samples were moved to /tmp, outside the checkout. review-evidence-retention.json records their paths. Reports, hashes and the small approved-delivery contact sheet remain in output; no rejected candidate is in public delivery.

## Verification

- Full registered Kumite suite: 1,066 tests passed across 45 files, zero failed/cancelled/skipped/todo, 83.337 s.334 scoped source/media/release-input hashes were stable throughout. Independent frontend TypeScript exit 0. See full-check.json.
- Separate frontend+standalone media/matchmaking/CPU/results fixture TypeScript check passed.
- Direct asset check: 17/17 exact-pixel+alpha parity, matching native dimensions and current source hashes, within the 1 MiB budget.
- Browser: fixed phone/desktop CPU workload, no broken compact portraits, no speculative future-effect requests, retired fire node absent; reduced health/full/empty and loss use still URLs with animation none; reduced victory uses W still and no court video sources; normal victory retains W and only gold video; result framing and controls remain intact. Existing strict lifecycle tests cover hidden visibility, reduced preferences, errors, cleanup, inputs, rematches and exact-revision fallbacks.
- Local whitespace checks passed. Public launch remains false. These measurements predate the draft PR; they do not establish live queue integration or production/player parity.

The remaining online-search/admission/settlement validation is independent of this completed media pass. Keep existing release gates; do not substitute these cached local browser samples for real-device and deployed-match evidence.
