# Level number emphasis

The reached level now has its own large cream numeral and gold LEVEL label beside the fighter, instead of sitting in the tiny eyebrow text. The Good Money headline, champion artwork, fists, CTA and milestone copy remain. Short desktop layouts place the number in the open upper-right corner. Three-digit levels scale within the same space. The dialog heading includes the reached level for screen readers, and reduced motion keeps the number static.

Production build, bundle budgets and TypeScript passed. Ten browser cases passed, including 390×844, the supplied 496×1014 screenshot size, 320×568, landscape, tablet, desktop, short desktop, levels 9/100 and reduced motion. Checks confirm that the number stays onscreen, clears the headline and controls, the celebration still waits for result dismissal, and Continue/Escape complete the handoff. No uncaught browser errors. Verification uses browser emulation rather than physical hardware.

- [Phone](phone.png)
- [Supplied screenshot dimensions](reference.png)
- [Small phone](small-phone.png)
- [Landscape](landscape.png)
- [Tablet](tablet.png)
- [Desktop](desktop.png)
- [Short desktop](short-desktop.png)
- [Level 100](three-digits.png)
- [Level 100 on a small phone](small-three-digits.png)
- [Reduced motion](reduced.png)
- [Browser results](verification.json)

Run `node scripts/verify-level-number.cjs` from `artifacts/squabblemon` against the production level-up fixture preview. `UI_ORIGIN` defaults to port 4207; `REVIEW_DIR` controls screenshot output.
