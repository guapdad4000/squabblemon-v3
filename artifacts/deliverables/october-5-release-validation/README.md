# October 5 integrated release validation

This release combines today’s approved battle/mobile presentation, organized offline header, emphasized level numeral with “THEM STREETS TALKIN...”, Squabblehouse Cashier and A Side of Hands cutouts, deck/social menu continuity and anonymous shadow player portraits on main at 4c23a76a.

Newer tutorial reading cues, PvP plates, district legality, character kits, premultiplied chroma rendering and scene-quality controls are preserved. Failed or fizzled abilities use a short shake and skip special media. Successful creative setups and buffs to frozen cards remain successful even without an immediate score change. Preview targets include actual visible board mutations.

Final verification:

- TypeScript passes.
- Battle regression suite: 263/263 passes.
- Deck selection/workshop, chunk recovery and story-portrait checks: 22/22 passes.
- Requested cutout transparency/revision check: 1/1 passes. This is the targeted check; original-source comparison tests need supplied PNGs absent from this checkout.
- Production build and all bundle budgets pass: public entry 210.2 KiB/475; GameApp 890.8 KiB/900; Home 969.6 KiB/1200.
- Header checks pass five viewports in light/dark themes, music/menu/focus behavior, timer states and PvP preservation.
- Battle interaction checks pass five viewports: visible nonzero board cards, district/card inspection, selected-card trajectory origins, resizing/scrolling, touch swipes and one-card touch placement.
- Level checks pass ten responsive/digit/reduced-motion cases and result-dismissal/continuation flow.
- Failed/silenced/shielded moves request no video; successful/partial moves still render video at phone/desktop sizes.
- Localized impacts retain thin star outlines; native and fallback video callbacks replay, stop uploads while hidden, and resume. No uncaught browser errors.

Screenshots in battle-final, battle-header-review, battle-mobile-review and level-number-review have been refreshed from the integrated production fixtures. The other battle review folders and performance reports preserve today’s earlier design/measurement history; they are not measurements of this merged release. Browser checks are emulation, not physical-device or hosted multiplayer proof.
