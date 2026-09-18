# Location art and floating nodes

Live gallery: [All 19 locations](https://squabble.today/location-art/).

Production deployment: [6aacc2339c49062abd2aa668](https://app.netlify.com/projects/squabblemon-triple-lane/deploys/6aacc2339c49062abd2aa668).

## Art direction

Each location is a painted urban landmark with its own lighting and architecture. Warm storefronts, neon clubs, apartment courtyards, a subway platform, and city rooftops keep the world recognizable at a glance. Irregular ink silhouettes, feathered edges, soft shadows, and a slow vertical drift make the lane markers feel suspended above the arena. Names, scores, rules, statuses, and selection remain live HTML above the art.

All 16 current locations have unique art. THE TOWN, GROUP CHAT, and SERVER ROOM also have original images for classic saved matches. No location shares a generic image. Unknown future identifiers use THE TOWN as a visual fallback.

## Integration

- Shared registry: `artifacts/squabblemon/src/locationArtwork.ts`.
- Shared components: `artifacts/squabblemon/src/components/LocationArtwork.tsx`.
- Solo and multiplayer use the same floating node artwork. Solo battle also blends the three issued locations into a faint ambient wallpaper over the existing venue.
- Location identity comes from the match, so replay frames keep their original artwork. Gameplay rules and identifiers are unchanged by this feature.
- Art does not intercept input. Existing lane buttons, card gestures, and play controls remain responsible for interaction.
- Reduced motion disables drifting. Short landscape layouts also use static scenes.
- Node assets are 600 x 400 WebP. Wallpaper assets are 1200 x 800 WebP, with alpha preserved. Responsive wallpaper sources reuse the smaller files on small screens.
- The standalone gallery allows viewing and downloading each full artwork. Its CSS is a copy of the component stylesheet; copy it again when changing the visual treatment.

## Files and prompts

The 38 game assets are saved under `E:/Apps/code/minimax/Squabblemon/artifacts/squabblemon/public/assets/locations/`: `{location-id}-node.webp` and `{location-id}.webp`.

Generated with the built-in image generation tool, one image per location. The prompt template and every scene description are in `artifacts/deliverables/location-art-prompts.json`; Bodega's initial prompt is recorded separately. Original generated PNG paths are in `artifacts/deliverables/location-art-sources.json`. The original files remain in the generated-images directory; every consumed image is copied into this project as WebP.

## Verification

- All 19 locations have both required assets; all 38 images decoded successfully.
- All 38 production URLs return 200 and match local SHA-256 hashes.
- The published HTML matches the release build; API health returns 200.
- Battle and gallery inspected at desktop size, 390 x 844, 320 x 740, and 844 x 390. Long rules remain visible, there is no horizontal page overflow, and the existing controls remain usable.
- Played Rastamon into the illustrated Barbershop lane in the local battle fixture; the card appeared once and scores updated.
- Multiplayer scene nodes inspected in the actual component with a local two-player room fixture.
- Live gallery contains all 19 wallpaper controls and opens its wallpaper dialog without console errors.
- All 26 battle component tests pass. One existing custom-deck test fixture was updated from seven cards to the repository's current ten-card format; production game rules were not edited for this task.
- TypeScript checks and the production build pass. Public entry JavaScript is 190.0 KiB against a 475 KiB budget.

Audits: `screenshots/location-art-audit.json` and `screenshots/location-art-production-audit.json`. Browser checks used resized desktop viewports; physical phone testing was not performed.
