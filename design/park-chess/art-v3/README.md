# Chess team facing and rival pawn color

The player white/blue miniatures face the top of the board toward the rival. The black/red pawn wears a red hoodie and cap; the other rival figures retain their forward-facing poses. All six roles remain in the original six-column, two-row atlas order, with true transparent surroundings, unchanged fist insignia and 362px square cells.

`pieces-v2.png` is the built-in imagegen edit master. `PROMPTS.md` records the exact edit prompt and input roles. `art-manifest.json` records dimensions, alpha bounds, sizes and SHA-256 for the master and production `pieces-v2.webp`. Sharp encoded the generated master as WebP at quality92, alphaQuality100 and effort6, without recoloring, turning, cropping or compositing it.

The versioned runtime filename prevents the previous immutable atlas URL from masking the correction. The shared chess board, tutorials, guide and cabinet preview consume the new atlas.

Validation passes on the actual App at 320, 390, 768 and 1440px: all 32 match pieces, six guide roles, three Academy picker portraits and preset boards, and four cabinet sprites load the versioned asset. Transparent alpha bounds project entirely within the board squares and cabinet aperture, with zero measured silhouette clipping or cabinet overlap. All 12 existing browser regressions pass, as do frontend TypeScript, production build and entry/GameApp/Home bundle budgets.
