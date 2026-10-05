# Mobile battle redesign — review revision

The approved expanded district view is preserved. The main portrait battle screen has been rebuilt after the previous visual layout was rejected.

- Consistent fighter scale across single-card and crowded districts.
- District names, inspection access and scores grouped in the center of the board.
- Six floating formation buttons and the separate top district navigation removed from portrait mobile.
- Compact turn guidance; tutorial guidance, replay and effect explanations retain their existing behavior.
- Stable hand and battlefield height across card selection and dragging.
- Integrated Details action, restrained selection treatment, quieter scenery and a consistent primary action button.

## Verified

Production fixture uses actual Battle, CardView, CardInspector and the real multi-card engine resolver. Checks passed at 320×568, 390×844, 430×932, 844×390 and 1440×1000. District switching, rules, nested inspection, Escape/focus restoration, target previews and card play passed. Portrait phones also passed real touch swipes and drag-to-play, with no accidental selection or duplicate play. New assertions verify equal overview card widths across sparse/crowded districts and no battlefield resize on selection. No uncaught browser errors.

Production build, bundle checks, TypeScript and git diff whitespace checks passed. This is browser emulation, not physical-device or hosted multiplayer testing. No new frame-rate claim. Changes have not been committed, pushed or deployed. This revision is ready for visual review, not recorded as user-approved.

## Screenshots

- [390px selected card](390-targeting.png)
- [390px idle board](390-overview-dark.png)
- [Approved district view](390-district.png)
- [320px selected card](320-targeting.png)
- [430px selected card](430-targeting.png)
- [Landscape](844-overview-dark.png)
- [Desktop](1440-overview-dark.png)
- [Interaction results](browser.json)
