# Squabblemon prismatic brand kit

The supplied gold wordmark is the primary logo. The gold impact lockup is the entry/sign-in hero; the SM monogram is the app icon. The fist-impact mark replaces the old crown crest in the field guide, loading recovery, and safehouse props. Logos, materials and borders now share `public/brand/prismatic/`.

## Contents

- `logos/`: primary gold wordmark, gold impact lockup, rainbow wordmark.
- `marks/`: gold/rainbow SM and impact emblems; black and distressed white impact marks.
- `vectors/`: distinct white, black, near-black and two-tone source vectors. Black artwork is intentional, not an empty export.
- `materials/`: gold and rainbow shard foil. These are opaque material tiles, not cutouts.
- `frames/`: transparent generated nine-slice border, background-extracted rail, four corner caps and four edge strips.
- `manifest.json`: all 36 upload names, checksums, canonical outputs, and the two exact duplicate relationships. 34 unique source masters are retained in the local brand kit.
- `catalog.html`: portable catalog with light/dark transparency preview and flexible frame demonstrations.

The original artwork is preserved. Production WebP exports crop low-alpha canvas dust with an 8px safety gutter, retaining all meaningful spikes and art edges. Original high-resolution PNG/SVG sources live in `Downloads/Squabblemon Brand Kit/masters/`. Nothing was discarded merely because its filename or silhouette looked similar.

## Reuse

Use `getAssetUrl('brand/prismatic/logos/squabblemon-wordmark-gold.webp')` for the wordmark. Do not fit the artwork with `cover` or hardcoded old logo proportions.

Import `components/prism-frame.css`, then apply `prism-frame` to a panel with sufficient content padding. Set `--prism-frame-size` (default 34px) and optional `--prism-frame-outset`. The frame slices at 20%, repeats its rails, has no center fill, and cannot intercept clicks. Separate corner/edge files are also provided for compositions needing independently placed pieces.

Prismatic cards use the frame plus the rainbow foil material under the transparent character artwork. Pointer, touch and keyboard reflection controls remain intact. The other card finishes keep their own materials. System and in-game reduced-motion settings stop the logo sheen and animated card reflections.

## Generation and import

Two assets were produced using the **built-in imagegen** tool: a new border using the supplied logo/rail as material references, and background extraction on the white-backed rail. Exact prompts: `prismatic-brand-prompts.json`. Generated PNG masters are in the local kit's `generated/frames/`; game exports are in `public/brand/prismatic/frames/`.

From the Squabblemon artifact directory, `node scripts/import-prism-brand.mjs /path/to/Downloads` rebuilds the curated exports and catalog. It accepts either the initial uploads or the organized master kit in that directory. `node scripts/export-prism-icons.mjs` rebuilds the app icons and social image from those exports.
