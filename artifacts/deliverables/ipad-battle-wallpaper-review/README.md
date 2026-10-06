# iPad battlefield wallpaper sizing

Tablet-shaped battle arenas use a centered, uniformly scaled fill instead of letterboxing the authored 9:16 or 16:9 image. The existing picture still chooses the venue's portrait or landscape artwork. Centered cover applies only at 601–1400px width, at least 600px height, and an aspect ratio up to 8:5. Phone and wide desktop fitting remain contained.

No images, filters, animation loops, timers, card sizes, or gameplay logic were added or changed. Cover makes the minimum crop needed to fill each tablet canvas without stretching the artwork.

## Screenshots

- [768x1024 portrait](768x1024-tablet-overview.png)
- [1024x768 landscape](1024x768-tablet-overview.png)
- [820x1180 portrait](820x1180-tablet-overview.png)
- [1180x820 landscape](1180x820-tablet-overview.png)
- [834x1194 portrait](834x1194-tablet-overview.png)
- [1194x834 landscape](1194x834-tablet-overview.png)
- [1024x1366 portrait](1024x1366-tablet-overview.png)
- [1366x1024 landscape](1366x1024-tablet-overview.png)
- [Selected card after rotation](1024x768-tablet-rotated-selection.png)
- [Phone regression](390x844-regression.png)
- [Desktop regression](1440x900-regression.png)

## Verification

The Chrome browser check passed all five venue images across eight tablet sizes (40 cases), decoded the expected orientation-specific source, and confirmed complete wallpaper coverage with uniform scaling. Four portrait–landscape–portrait round trips preserved the selected card, selected district, fighters, scores and countdown state. Phone 390x844, narrow desktop 490x1000 and wide desktop 1440x900 retained their existing fitting. All tested cards had nonzero dimensions, and timer tracks, compact speed controls, hand cards and main actions stayed visible/reachable. No runtime errors were reported.

Production build, bundle budgets and source diff checks passed. Browser verification used viewport/touch emulation, not physical iPads or hosted deployment. Existing formation card sizing was left unchanged.
