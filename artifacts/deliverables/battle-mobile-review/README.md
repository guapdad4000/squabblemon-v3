# Mobile battle readability review

Implemented the six approved changes: expanded district view with both teams and all three live scores; compact phone HUD and collapsible district rules; art, power and status priority on overview cards; larger swipeable hand and selected-card details shortcut; formation access even with one fighter; and clearer target outlines with power changes moved above portraits.

Only the selected district mounts in the expanded view. The native dialog traps focus, Escape returns to its opener, and closing a nested fighter inspector returns to the district. Dragging keeps the selected-card details strip out of the way to avoid moving the drop area.

## Verification

Production Vite fixture renders the actual Battle, CardView and CardInspector components with a deterministic 22-fighter board and the real multi-card play resolver. This is a component integration check, not a hosted multiplayer session or a physical-device benchmark.

- Five viewport sizes passed: district switching, both teams visible in expanded view, one-fighter access, district rules, nested inspector, Escape/focus restoration, card selection, target preview and play.
- Portrait phones additionally passed touch swiping without accidental selection and drag-to-play exactly once, finishing with 24 board cards.
- Initial 22 board cards all have nonzero dimensions; crowded phone formations scroll; primary action remains on screen; selected card stats stay inside the hand viewport.
- Light and dark theme screenshots captured; no uncaught browser errors.
- App production build, bundle budgets, TypeScript and five focused battle test files passed. No new FPS claim: earlier battle performance budgets remain unresolved. The earlier full battle suite had three known failures (two Battle test context errors and one Rock power expectation); this pass does not claim a clean full suite.

| Viewport | Smallest overview card width | Expanded card width |
|---|---:|---:|
| 320 × 568 | 46.7px | 134.4px |
| 390 × 844 | 58.3px | 163.8px |
| 430 × 932 | 65.0px | 168.0px |
| 844 × 390 | 75.2px | 220.7px |
| 1440 × 1000 | 61.3px | 220.7px |

Short screens retain an overview of the scores and scrollable formations; the district view provides full-size inspection when there is not enough height for all fighters at once.

## Screenshots

### 320px

- [320-district-rule](320-district-rule.png)
- [320-district](320-district.png)
- [320-drag](320-drag.png)
- [320-full-card](320-full-card.png)
- [320-overview-dark](320-overview-dark.png)
- [320-overview-light](320-overview-light.png)
- [320-targeting](320-targeting.png)

### 390px

- [390-district-rule](390-district-rule.png)
- [390-district](390-district.png)
- [390-drag](390-drag.png)
- [390-full-card](390-full-card.png)
- [390-overview-dark](390-overview-dark.png)
- [390-overview-light](390-overview-light.png)
- [390-targeting](390-targeting.png)

### 430px

- [430-district-rule](430-district-rule.png)
- [430-district](430-district.png)
- [430-drag](430-drag.png)
- [430-full-card](430-full-card.png)
- [430-overview-dark](430-overview-dark.png)
- [430-overview-light](430-overview-light.png)
- [430-targeting](430-targeting.png)

### 844px

- [844-district-rule](844-district-rule.png)
- [844-district](844-district.png)
- [844-overview-dark](844-overview-dark.png)
- [844-overview-light](844-overview-light.png)
- [844-targeting](844-targeting.png)

### 1440px

- [1440-district-rule](1440-district-rule.png)
- [1440-district](1440-district.png)
- [1440-overview-dark](1440-overview-dark.png)
- [1440-overview-light](1440-overview-light.png)
- [1440-targeting](1440-targeting.png)

Changes are local and have not been committed, pushed, or deployed.
