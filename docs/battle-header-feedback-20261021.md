# Battle header and live score feedback

The battle header now separates the current move on the left from combo progress on the right. District items sit immediately beneath each district rule. Normal play no longer repeats the move in a floating caption or puts score arithmetic in the header.

District numbers display the exact presented total at impact, with a signed change beside it and a brief emphasis. They use the existing engine event snapshots; no intermediate totals are invented and no battle rules or timing change. Reduced motion retains the exact numbers and signed changes without the pulse.

The player Motion display remains left of the street-sign action. Skip remains directly available; the PvE speed setting is in the battle menu. Tutorial coaching, deliberate guided reading, replay causality, and final-board inspection retain their detailed views.

## Validation

- Frontend TypeScript passed.
- All 74 tests in `Battle.test.tsx` passed using the direct file invocation below.
- The new browser check passed at 320×568, 390×844, 768×1024, 1024×768, 844×390, and 1280×800 with both normal and reduced motion. It presents a real three-event Buddy ability chain and verifies the before/after totals, signed deltas, combo index, stable layout, item inspection, and PvP header bounds.
- Existing art/layout checks passed at five viewport sizes, including hand and formation scrolling, item ownership/inspection, action placement, and rival resource bounds.
- Production Vite build and entry-bundle budgets passed. The build reused public assets (`copyPublicDir: false`) to avoid copying the large asset tree; it was not a deployment.
- Visual review covered desktop, portrait phone, short landscape, and PvP captures.

These are local browser fixtures and source/build checks, not physical-device or authenticated production-match testing.

## Reproduce

Run from `artifacts/squabblemon`:

```sh
pnpm run typecheck
TSX_DISABLE_CACHE=1 node --import ../../scripts/battle-test-css.mjs --import tsx src/components/Battle.test.tsx
node e2e/verify-header-feedback.mjs
ART_LAYOUT_ONLY=1 node e2e/verify-restored-art.mjs
```

Set `HEADER_REVIEW_CAPTURE` or `ART_REVIEW_CAPTURE` to choose a screenshot directory. The scripts start their own local Vite server: header feedback uses port 4221; restored art uses port 4217 (or `ART_REVIEW_PORT`).

Local visual review: `output/battle-header-feedback-20261021/REVIEW.html` in the primary workspace. The implementation is on `codex/battle-header-feedback-20261021`; this pass has not been pushed.

## Mobile music follow-up

On phone/tablet layouts and touch devices, the single Music control now lives inside the three-dot battle menu, including PvP and tutorial battles. Wide desktop PvP keeps its existing shortcut. The mobile menu anchors to the header edge so the inset PvP button cannot push the clipboard offscreen.

TypeScript, all 74 Battle tests, the production build and bundle budgets passed again. Local browser checks covered PvE and PvP at six sizes (320–1280px), confirming one Music control, menu placement and bounds, volume state through the real music controller, Close/Escape dismissal, and restored keyboard focus. This does not verify audible playback or physical devices.

## Compact PvP follow-up

PvP still had a separate legacy tools row beneath its two nameplates. That made its phone header 158px tall even though the other battle views were 106px. PvP now shares the same reserved header height as PvE: 106px on phones (plus the safe-area inset), 112px on larger screens, and 94px in short landscape. Claims sit between move and combo feedback, and tools use the right edge of that row. Both identities remain visible. The live clock sits beneath the round rather than overlapping its digits.

Music and reactions are in the mobile three-dot menu; desktop retains its Music shortcut. Active-match exit uses the existing Leave battle menu action and confirmation. The direct exit remains available while the arrival poster covers the menu. Reaction-picker Escape closes the picker and returns focus to its menu trigger before another Escape closes the menu.

The online effect presenter can supply an effect while the decision phase remains player-ready or rival-thinking. The header now displays those effects and clears back to guidance when the presenter clears them. Authoritative scores, turn eligibility, server deadlines and surrender semantics are unchanged.

Validation: frontend TypeScript, all 75 Battle tests, production Vite build and bundle budgets pass. Six viewport sizes with normal/reduced motion assert identical PvE/PvP header and battlefield geometry. Eight local PvP flow checks cover portrait/landscape ranked and friend battles, reaction focus, arrival exit, rejected surrender, offline return, reconnect, one-time surrender submission, browser Back and completed-match exit. The room fixture now includes the auth/social providers required by the current Multiplayer screen. The completed friend-room test follows its current Leave this room action.

Full Multiplayer captures at 390×844, 844×390 and 1280×800 include the running timer and populated menu. These use a local engine-created room with intercepted API responses; they are not authenticated production-match or physical-device evidence.

```sh
STORY_TEST_PORT=4231 pnpm exec playwright test -c e2e/playwright.config.ts e2e/pvp-exit.spec.ts --project=chromium-phone --reporter=line
```
