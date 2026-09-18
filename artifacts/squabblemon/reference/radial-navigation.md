# Illustrated radial navigation

Eight icons were generated individually with the built-in image generation tool, using the user's Squabblemon logo as the style reference. Original PNGs with transparency are saved in `reference/navigation-originals/`; optimized WebP icons are in `public/brand/navigation/`.

## Behavior

The previous sidebar and mobile bar are replaced by a transparent fan at the bottom of the viewport. Desktop shows all eight destinations. At 900px and below, Safehouse, The streets, Fight, Shop, and More form a five-piece fan. More opens the four remaining illustrated destinations and reflects the selected secondary destination. Artwork overlaps and extends below the screen; labels stay above all images. Hover and keyboard focus raise a piece. Selecting it triggers a brief pop and return, with a persistent gold active marker. Reduced-motion preferences from the operating system and game settings disable the animations. No new animation library was added.

The safehouse scene spans the space previously occupied by the sidebar. Bottom actions and scrolling content have clearance for the artwork. Rewards remain visible through bounty badges.

## Files

- `src/components/venue/GameNav.tsx`: navigation and territory dialog; existing wallet retained.
- `src/components/venue/fan-navigation.css`: fan composition, responsive sizes, and movement.
- `src/pages/game/GameApp.tsx`: opts the account shell into the fan layout.
- `scripts/prepare-navigation-art.cjs` (repository root): creates WebPs from saved originals; confirms alpha and trims transparent canvas margins.
- `scripts/check-fan-navigation.cjs` (repository root): browser navigation, label hit targets, menu dismissal, keyboard input, and motion checks.

## Verification

The installed TypeScript compiler passes. Browser checks pass at 1440×1000, 390×844, 320×568, and 844×390: transparent navigation, loaded artwork, at least 44px touch targets, unobscured labels, keyboard navigation, Escape dismissal, active-route feedback, and pop-and-settle behavior. All eight destinations were exercised in the local preview. Operating-system and in-game reduced motion were checked. The landscape main action remains unobscured. Screenshots are saved under the repository's `screenshots/fan-navigation-*` paths.

## Generation prompts

Shared prompt (followed by each subject below):

Create one game navigation inventory icon, a standalone illustrated object with TRUE TRANSPARENT ALPHA background. Match the attached Squabblemon reference: distressed antique gold, olive enamel, ivory highlights, heavy black comic ink contours, hand-painted worn tactile material, bold readable silhouette. Front-facing with a little dimensional perspective. Portrait composition, centered full object with small clear margins. No text, no lettering, no UI, no frame, no background, no glow, no floor shadow. The object will protrude upward from the screen bottom as one piece in a radial fan, so give it a strong distinctive top silhouette and a narrower lower handle/base. Use case: stylized-concept. Reference is style input, not the output subject. Subject: 

### safehouse

a squat brick safehouse entrance with a heavy olive steel door, golden roof edge and a large antique golden key leaning diagonally across it. Warm ivory light from one tiny window. A compact solid recognizable house silhouette.

### streets

an unfolded aged ivory street map, chunky olive and gold route lines, one dimensional gold destination pin and a short olive street signpost rising above the top. No words or letters anywhere.

### fight

a single bold gold leather boxing glove with black olive wrist cuff and gold rivets, fist upright toward viewer, ready to punch. Chunky silhouette, slightly angled.

### collection

three collectible battle cards spread in a fan, thick distressed golden edges and olive backs, the front card bearing a raised gold crowned star emblem. No words, no numbers.

### crew

three chunky golden fighter busts grouped together, the central figure wearing an olive hoodie, the flanking figures baseball cap and beanie, faces simple shadowed sculpted silhouettes. Unified small trophy-like crew object, no lettering.

### bounties

an aged ivory rolled-edge bounty scroll with a gold target crosshair emblem pressed into its center and a large olive wax seal hanging below on a short gold ribbon. A little antique gold chain at top. No faces, no text.

### shop

an open olive canvas duffel bag with distressed gold buckles, filled with chunky antique gold coins and two ivory tickets peeking out, no currency symbols or words. Strong compact readable silhouette.

### profile

an olive enamel fighter dog tag on a short thick gold chain, bearing a raised gold human head-and-shoulders silhouette and topped by a small golden crown. Single solid object, no words.
