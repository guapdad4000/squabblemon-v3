# Battle artwork and targeting refinement

- Brightened the three location scenes and kept their names/scores above the artwork.
- Replaced the fixed middle-of-hand line with an SVG curve measured from the selected card's visible top center to the chosen district's lower edge.
- The line follows card changes, hand scrolling, resizing and brief card layout/hover transitions. It hides when its card is offscreen and stops measuring when layout settles. No permanent animation loop or React render loop was added.
- Responsive venue pictures use the matching authored portrait arena on portrait screens and wide artwork in landscape. Images use contain rather than oversized cover crops; the extra location-wallpaper overlay is removed in portrait to keep the background coherent.
- The approved district view and main board layout are retained.

## Verification

Production build, TypeScript, venue mapping/render regression test, and browser integration checks passed at 320×568, 390×844, 430×932, 844×390 and 1440×1000. No uncaught browser errors.

Browser checks compare actual line endpoint coordinates with the first and third selected cards and destination district, then verify scrolling offscreen, scrolling back, and viewport resizing. Existing district inspection, keyboard focus, selection, touch swipe, drag-to-play, card counts and stable layout checks also pass. Portrait picture source selection and contain sizing are checked. This is browser emulation, not a physical-device or hosted multiplayer test.

- [Third card targeting a district](390-targeting-third-card.png)
- [First card targeting](390-targeting.png)
- [Idle board and bright locations](390-overview-dark.png)
- [Small phone](320-targeting-third-card.png)
- [Large phone](430-targeting-third-card.png)
- [Landscape](844-targeting-third-card.png)
- [Desktop](1440-targeting-third-card.png)
- [Approved district view](390-district.png)
- [Browser results](browser.json)

Local changes only. Not committed, pushed or deployed.
