# Authored story environments

Installed from `Squabblemon-Environments-Complete.zip`: 38 wide backgrounds and 16 transparent props. Optimized WebP assets total approximately 14.2 MiB; originals remain in Downloads. File hashes and source mapping are recorded in `artifacts/squabblemon/reference/story-environments.json`.

All 147 scene nodes across Season Two, the original Sherlock trilogy, and the ten expansion chapters have explicit location assignments in `lib/squabblemon-engine/src/storyEnvironments.ts`. Chapter maps and battle backdrops use the matching location too. All 38 backgrounds are used. Season One retains its authored environments. Node IDs, rewards, prerequisites, and encounters are unchanged.

Backgrounds are flattened illustrations, not independently separated depth layers. The existing slow camera motion animates the scene, while a separate supplied prop adds restrained foreground movement. Props are decorative and cannot intercept input; phone layouts omit them to leave room for dialogue. Reduced-motion settings stop both scene and prop motion.

The story route now stretches through the game shell so absolute scene overlays cannot collapse into a short strip. Authored environments omit the legacy projector-beam JPEG, whose visible checkerboard interfered with the new artwork.

Validation: 16 content/asset tests; library and frontend typechecks; browser checks at 1440×900, 768×1024, 390×844, and 375×667 for correct background, viewport fill, reachable dialogue controls, loaded props, reduced motion, and runtime errors. Production build and entry-bundle budget validation.
