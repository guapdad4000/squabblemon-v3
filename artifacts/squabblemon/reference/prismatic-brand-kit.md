# Squabblemon brand kit

The standard gold wordmark is the primary logo. The supplied standard gold impact lockup is the landing/sign-in hero and social preview; the standard gold fist-impact emblem is the favicon and installed app icon. Standard gold branding also appears in loading, the field guide, card information sheets, safehouse props, and the pack-opening gym. Logos, materials and borders now share `public/brand/prismatic/`.

## Contents

- `logos/`: standard gold wordmark and impact lockup, plus holographic gold and rainbow alternatives, solid monochrome wordmarks, and wide impact lockups in black, white and white outline.
- `marks/`: standard gold impact emblem; holographic gold/rainbow SM and impact emblems; black and distressed white impact marks; solid black SM and outlined black impact variants.
- `vectors/`: distinct white, black, near-black and two-tone source vectors, including the wide impact lockup in black and white. Black artwork is intentional, not an empty export.
- `sheets/`: the supplied black brand sheet and the updated standard gold punching-bag wrap.
- `materials/`: gold and rainbow shard foil. These are opaque material tiles, not cutouts.
- `frames/`: transparent generated nine-slice border, background-extracted rail, four corner caps and four edge strips.
- `manifest.json`: all 51 upload names, checksums, canonical outputs, and the three exact duplicate relationships. 48 unique source masters are retained in the local brand kit.
- `catalog.html`: portable catalog with light/dark transparency preview and flexible frame demonstrations. Black marks start on light swatches so they are visible immediately.

The original artwork is preserved. Production WebP exports crop low-alpha canvas dust with an 8px safety gutter, retaining all meaningful spikes and art edges. Original high-resolution PNG, JPEG and SVG sources live in `Downloads/Squabblemon Brand Kit/masters/`. Nothing was discarded merely because its filename or silhouette looked similar.

The second batch adds 11 unique masters from 12 supplied files. `8e9111dc-4420-4aef-817e-1ae2a7c46e5c.png` is byte-identical to `image-gen-3(20260926-053602).png`; both names resolve to the retained solid black wordmark through the manifest. The SVGs remain native vectors, and the high-resolution PNG originals remain at their supplied resolution. The wide lockups and solid wordmarks are additional treatments.

## Reuse

Use `getAssetUrl('brand/prismatic/logos/squabblemon-wordmark-standard-gold.webp')` for the wordmark. Do not fit the artwork with `cover` or hardcoded old logo proportions.

Import `components/prism-frame.css`, then apply `prism-frame` to a panel with sufficient content padding. Set `--prism-frame-size` (default 34px) and optional `--prism-frame-outset`. The frame slices at 20%, repeats its rails, has no center fill, and cannot intercept clicks. Separate corner/edge files are also provided for compositions needing independently placed pieces.

Prismatic cards use a clean gold foil-textured edge plus the rainbow foil material under the transparent character artwork. The decorative corner frame is retained in the asset kit for optional reuse, but is not applied to cards. Pointer, touch and keyboard reflection controls remain intact. The other card finishes keep their own materials. System and in-game reduced-motion settings stop the logo sheen and animated card reflections.

## Generation and import

Four assets were produced using the **built-in imagegen** tool: the optional foil border, background extraction on the white-backed rail, background extraction on the standard gold JPEG wordmark, and a new central logo on the existing punching-bag wrap. Exact prompts: `prismatic-brand-prompts.json`. Generated PNG masters are in the local kit's `generated/`; web exports are in `public/brand/prismatic/`. Supplied PNG marks already had transparency and were only cropped/resized for web use.

From the Squabblemon artifact directory, `node scripts/import-prism-brand.mjs /path/to/Downloads` rebuilds the curated exports and catalog. It accepts either the initial uploads or the organized master kit in that directory. `node scripts/export-prism-icons.mjs` rebuilds the app icons and social image from those exports.

Standard gold icon filenames and the social-preview image use new URLs to refresh caches. Conventional icon, `favicon.ico`, `logo.svg` and crest URLs are also updated for compatibility. `logo.svg` contains the raster wordmark internally so it works as an embedded image. Holographic artwork remains available for collector finishes; it is no longer the default site identity.
