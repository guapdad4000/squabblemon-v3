# Location details popup review

The solo location inspector uses the game's wood frame, lined paper, ink headings and gold return button. Each of the 30 locations has its own scene artwork, accent and short description immediately below the picture. Issued rules and strategy are displayed as the main content, with current match status and this location's live Hands below. Nothing requires opening a rules toggle.

Solo view contains no other-location navigation, fighter cards or fighter counts. View fighters here opens the formation browser, retaining enlarged cards, district navigation, target/covered markers and nested card inspection. Location details is reachable on phone and desktop.

## Screenshots

- [Phone: Pirate Radio in battle](390-pirate-radio-actual-location.png)
- [Desktop: Pirate Radio in battle](1280-pirate-radio-actual-location.png)
- [Short phone: full rule before scrolling](320-bodega-location.png)
- [Bodega](1280-bodega.png)
- [Blackout Block](1280-blackout-block.png)
- [Community Kitchen](1280-community-kitchen.png)
- [Short landscape](844-construction-site-location.png)

The Pirate Radio battle screenshots show engine-issued rules/status and current scores. Standalone responsive fixtures deliberately override issued rules to verify that the inspector renders the match's version, including after balance changes.

## Validation

- TypeScript: passed.
- Battle UI tests: 64/64 passed.
- Production build and bundle budgets: passed; public entry 210.2 KiB / 475 KiB, GameApp static JavaScript 890.8 KiB / 900 KiB, Home 969.7 KiB / 1200 KiB.
- Location browser: all 30 artwork IDs decoded, unique descriptions, permanent rules, no solo fighter counts/navigation; 320/390/844/1280 layouts plus actual battle popup at 390/1280. Keyboard focus, Escape, scrolling, mode changes and nested inspector passed.
- Existing battle interaction browser: 320/390/430/844/1440 passed, including selected-card trajectory, hand swiping and drag-to-play.
- Responsive HUD browser: eight sizes and 40 phase cases passed, including 601px boundary and 844x390 landscape. Timer, compact speed/Skip controls and PvP fixture checks passed.
- Source diff check: passed.

Browser checks used the final local Vite preview with Chrome viewport/touch emulation. Hosted deployment and physical-device performance were not measured. JSON reports accompany these screenshots.
