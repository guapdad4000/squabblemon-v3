# Nothing to Lose

Permanent starter milestone, separate from login rewards. Unlock Season 1, Chapter 5 (`old-heads-know`) by finishing Chapter 4's required nodes. Claim Homeless Guy (`homeless-guy`, Mythical), 1,000 Clout, and 3 Street Pack tickets. No timer, streak, payment, or account-age restriction. Existing players qualify retroactively.

The claim reads authoritative story-node records through the same campaign builder used by Story. Numeric profile chapter counters and request-body reward values cannot grant eligibility. A profile row lock and unique `starter-mythic:nothing-to-lose:v1` receipt serialize concurrent claims, currency grants, and login rewards. The existing JSON claim ledger needs no SQL migration. GET `/api/player/rewards/starter-mythic`; POST the same path plus `/claim`. Both require authentication.

Existing owners get 25 Style Shards in place of the card, matching finite story duplicate compensation, plus all Clout and tickets. The later Homeless Guy story reward already uses the ownership-aware story transaction and pays 25 Shards when owned. Card ownership, discovery, and collection progress are updated together.

Safehouse: chibi shortcut directly beneath Bounties, disappears after collection. Introduction appears once on the Safehouse after onboarding; eligibility gets its own one-time popup there. Presentation history is per player in local storage with an in-memory fallback; entitlement is always server-owned. Neither popup interrupts an existing dialog. Bounties: permanent banner below posters, retained as a completed milestone. Full Experiments & mastery content remains behind a small Mastery strip with the real unclaimed experiment count. Existing `?view=mastery` links continue to work.

Native modal dialog provides focus containment and Escape dismissal. Close restores focus when its opener still exists. Labels are live text, separate from generated artwork. Short-phone layout is compact and scrollable. Failed requests never retire a reward or optimistically credit currency; retry recovers an already-saved claim.

## Art

Generated with the built-in imagegen tool, using the existing Homeless Guy character artwork as identity reference for the chibi and banner. Originals are preserved under the tool's generated_images directory. Runtime WebP assets:

- `artifacts/squabblemon/public/assets/starter-mythic/chibi.webp` — 640×640, real alpha transparency.
- `artifacts/squabblemon/public/assets/starter-mythic/background.webp` — 1440×960.
- `artifacts/squabblemon/public/assets/starter-mythic/banner.webp` — 1600×533.

Generation prompt set:

1. **Chibi:** Generate one game UI character icon. Use the attached image ONLY as character identity reference: Homeless Guy, a dark-skinned adult man with spiky dark dreadlocks, short goatee, confident intense eyes, torn beige one-shoulder shirt, ragged beige trousers and worn shoes. Make a charming powerful chibi version, large expressive head, small body, seated on a milk crate throne, sly knowing half smile, hands resting on knees. Bold black ink contours, cel shaded anime street comic art, warm gold highlights and small gold star accents. Full figure fully inside square canvas, legible at 96px. Genuinely transparent background with alpha; no checkerboard, no text, no border, no background scenery. This is a permanent free Mythical reward icon for Squabblemon.
2. **Background:** Create a landscape 3:2 background illustration for a Squabblemon street-comic game reward popup titled Nothing to Lose (DO NOT render any words). Empty neighborhood corner at golden hour, brick wall on left, little milk crate throne near left edge, neatly folded worn blanket and scuffed backpack beside it, warm sunlight spilling from alley right, distant stoops and overhead wires. Bold expressive black ink contours, angular cel shading, screenprint grain, cream/charcoal/amber palette, cinematic gold beams, premium warm hopeful atmosphere. No characters, no text, no UI, no watermark. Middle and lower right stay dark and quiet to support readable overlaid interface. Authored finished comic environment, not photorealistic.
3. **Banner:** Generate a wide landscape 3:1 promotional banner illustration for Squabblemon's permanent free Mythical reward, Nothing to Lose. Attached image is character identity reference only. Homeless Guy, adult dark-skinned man, spiky dreadlocks, goatee, powerful physique, ragged beige one-shoulder shirt and beige trousers. He sits confidently on a milk crate at the FAR RIGHT third, elbows on knees, sly half smile, fully recognizable. Golden-hour neighborhood stoop, scuffed backpack nearby, warm amber sunlight forms a regal halo behind him. LEFT TWO THIRDS are dark quiet charcoal brick and subdued graffiti textures for web text overlay. Bold black ink, angular cel-shading, screenprint grain, cream and gold accents, swagger and warmth. No lettering, no words, no UI, no watermark. Finished premium game campaign illustration.

## Validation

- `pnpm run test:campaign:db starter-mythic`: 5 database/API tests against an owned ephemeral PGlite database. Early/forged claims, chapter boundary, simultaneous/repeated claims, duplicate compensation, login independence, authenticated HTTP flow.
- `node artifacts/squabblemon/e2e/verify-starter-mythic.mjs`: 6 browser scenarios using mocked API responses and real components. Desktop, phone, short phone, shortcut placement, Mastery access, focus restoration, centering, image loading, claims/cache updates, intro/ready presentation history, request failures/retry, and claimed retirement.
- Library, API, and client TypeScript checks; client production build.
