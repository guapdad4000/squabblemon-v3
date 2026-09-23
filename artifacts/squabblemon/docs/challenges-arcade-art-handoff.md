# Challenges arcade art handoff

## Supplied artwork integration

The September 23 Fadecade artwork replaces the original CSS cabinet, fighter,
cloud, and road stand-ins. See [`docs/fadecade-art.md`](../../../docs/fadecade-art.md)
for the prepared asset inventory, source-to-output crops, sprite geometry, and
transparent screen apertures. The reproducible preparation script is
`scripts/prepare-fadecade-art.mjs`; the runtime manifest sits alongside the
optimized assets.

The specifications below are the original commissioning brief, not a claim
that the supplied artwork is missing. Use the new manifest's measured geometry
when replacing these assets.

## Straight to the Back cabinet

The cabinet is the primary Challenges landmark: a 16:9 screen inside a
painted, physical wood/metal shell. The temporary CSS screen currently uses
simple sky, road, cloud, and mascot shapes so final art can replace each layer
without changing the component contract.

* **Screen:** 1600 × 900, safe text zone is the left 38%; keep the road and
  fighter clear of copy.
* **Marquee:** 2048 × 420, title must remain legible at 320px viewport width.
* **Room layers:** supply separate 2400 × 1600 room background, foreground
  cabinet-bank silhouettes, flagship cabinet shell, three secondary cabinet
  shells, and poster sheets. Keep alpha around every cabinet so the responsive
  layout can overlap and stagger them without a baked rectangle.
* **Cabinet live-text safe areas:** flagship marquee center 70%, screen left
  38%, and control-deck center 48% must stay clear. Secondary marquees need a
  centered 60% clear strip for real Training, Bounties, and Events labels.
* **Road tiles:** 1200 × 1200 top-down tiles, vertically seamless on both
  edges. Supply straight asphalt, intersection, boss landmark, and shoulder
  variants. The app renders only a bounded window around the current stop and
  reuses these pieces for an endless run.
* **Fighter:** transparent WebP/PNG sprite sheet at 512 × 512 per frame:
  4-frame idle and 8-frame downward walk. The head, shoulders, arm swing, and
  both feet must remain readable at 72 CSS pixels.
* **Fight cloud:** 8-frame, 768 × 768 alpha-transparent loop with no matte or
  colored key background. Keep the center 35% calm enough for the accessible
  current-stop label layered above it.
* **States:** `walk` follows a confirmed victory and clears the cloud before
  travel; `fight` marks the active persisted encounter. Provide static first
  frames for reduced-motion and image-load fallback.
* **Accessibility:** all controls retain visible labels and keyboard focus;
  decorative art is empty-alt. Do not communicate a stop or result by color
  alone.

Final assets should be delivered as compressed WebP/AVIF plus transparent WebP
or PNG where alpha is required, with a low-bandwidth fallback poster. Keep each
layer below 500 KB where practical and include 1×/2× exports. The original
release used CSS stand-ins. The Fadecade rework uses the user-supplied cabinet,
logo, environment, road, runner, fight, and defeat art instead.