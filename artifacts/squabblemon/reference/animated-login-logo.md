# Animated login logo

Four assets generated individually with the built-in image generation tool from the user-provided logo. Original transparent PNGs and trimmed, optimized WebP copies are in `public/brand/layers/`. The four runtime WebPs total 945,956 bytes. Original PNGs preserve generated alpha and canvas; WebP copies trim transparent padding for predictable layout.

The reusable `AnimatedLogo` component appears on the public welcome page and production sign-in page. The development test-account shortcut still uses its existing minimal screen. Crest enters first, gloves enter from opposite sides, and the banner settles over the front. Idle movement has a pause/resume control; the system reduced-motion preference disables all logo animations. Authentication controls remain available during animation.

## Verification

- TypeScript check passed using the installed compiler directly (the package-manager command attempted a registry lookup unavailable in this sandbox).
- `scripts/check-animated-logo.cjs` passed at 1440 × 1000 and 390 × 844: all four images load, no horizontal overflow or page errors, sign-in navigation works, pause/resume works, and reduced motion removes all logo animations.
- Screenshots: `screenshots/animated-logo-desktop.png` and `screenshots/animated-logo-phone.png`.
- The production sign-in shell was also inspected using a browser-only override of the development auth flag. Its logo loaded, but the external Clerk form did not render locally, so full form layout and authentication were not verified.

## Generation prompts

### crest

Use case: precise-object-edit. Input image is the edit target. Create ONE separate production-ready transparent PNG layer for an animated Squabblemon logo. Preserve the reference's distressed gold metal, deep olive enamel, bold black comic outlines and exact object identity. Genuine transparent alpha background, no glow, no backdrop, no checkerboard rendered into pixels. Isolate ONLY the central shield/crest including its gold crown, SM monogram and bottom gold star. Remove both gloves and entire Squabblemon wordmark banner. Reconstruct shield hidden behind banner so crest is a complete coherent single piece. Center the crest with small transparent margin, full object visible. No other objects.

### glove-left

Use case: precise-object-edit. Input image is the edit target. Create ONE separate production-ready transparent PNG layer for an animated Squabblemon logo. Preserve the reference's distressed gold metal, deep olive enamel, bold black comic outlines and exact object identity. Genuine transparent alpha background, no glow, no backdrop, no checkerboard rendered into pixels. Isolate ONLY the LEFT boxing glove and dark wrist cuff, with a short golden forearm end. Same orientation as reference: knuckles upper left, thumb upper right, wrist lower right. Remove everything else including shield crown banner text and right glove. Complete the obscured cuff. One centered isolated glove filling canvas with 8% clear margin. TRANSPARENT BACKGROUND mandatory; no black or brown backdrop.

### glove-right

Use case: precise-object-edit. Input image is the edit target. Create ONE separate production-ready transparent PNG layer for an animated Squabblemon logo. Preserve the reference's distressed gold metal, deep olive enamel, bold black comic outlines and exact object identity. Genuine transparent alpha background, no glow, no backdrop, no checkerboard rendered into pixels. Isolate ONLY the RIGHT boxing glove and dark wrist cuff, with a short golden forearm end. Same orientation as reference: knuckles upper right, thumb upper left, wrist lower left. Remove everything else including shield crown banner text and left glove. Complete the obscured cuff. One centered isolated glove filling canvas with small clear margin. TRANSPARENT BACKGROUND mandatory; no black or brown backdrop.

### wordmark

Use case: precise-object-edit. Input image is the edit target. Create ONE separate production-ready transparent PNG layer for an animated Squabblemon logo. Preserve the reference's distressed gold metal, deep olive enamel, bold black comic outlines and exact object identity. Genuine transparent alpha background, no glow, no backdrop, no checkerboard rendered into pixels. Isolate ONLY the wide foreground wordmark banner with exact text SQUABBLEMON (S Q U A B B L E M O N), off-white distressed brush lettering on black/deep olive metal plaque with gold outline. Preserve the original silhouette and typography. Remove crest crown star gloves and all background. One wide banner centered on transparent canvas with small margins. Do not add star below. Actual alpha transparency mandatory.
