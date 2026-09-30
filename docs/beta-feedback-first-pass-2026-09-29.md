# First beta-feedback pass — 2026-09-29

Scope: B03, B10, B11, B15, B16, B17 and B18 from [the feedback plan](beta-feedback-plan-2026-09-29.md). No push, deployment, gameplay/balance changes, Chapter One timer changes, crew-selection work, later teaching-copy/diagram pass or performance work.

## Delivered

| Feedback | Change |
| --- | --- |
| B03 | Final-board inspection no longer renders the large end-of-match broadcast. “Match complete” remains visible, with a small review marker in the guidance line rather than over the board/header. Cards and scores remain inspectable; View result returns to the result screen. Skip is hidden and the disabled footer no longer incorrectly says “Resolving…”. |
| B10 | Mechanic-lesson portraits have a bounded, separate column. Guidance portraits cannot paint across their text. Desktop coach tips use their measured height to keep their controls inside the viewport. |
| B11, B15 | Guided Play rival plays/abilities and intermediate round recaps wait for Continue. Other tutorial notes retain readable timing independently of reduced motion, with the existing event history preserved. Competing attack captions yield while reading; their video/audio/effect component stays mounted. Ordinary and online battle pacing is unchanged. |
| B16 | Finished matches save promptly through a single-flight, success-cached, retryable completion gate. Late saves and account refreshes cannot dismiss result/board/card inspection or move the visible onboarding lesson. Stale responses after restart/unmount cannot advance a newer session. Leaving results and advancing through the handoff/reward screens requires explicit input. |
| B17 | Lesson Complete and the post-fight handoff own their vertical scrolling inside the actual game shell. Expanded content and continuation controls remain reachable on short screens, with wheel, keyboard and touch input. |
| B18 | Persistent labels describe actual presentation states, including your turn, plays/reveals, resolving effects, round results and match completion. Round-start guidance explains drawing without inventing a separate draw/standby phase. The online caller was checked: waiting uses the rival-thinking presentation, not player-ready. |

## Verification

- **88 focused Node tests passed** for presentation/completion behavior and affected battle/rookie behavior. The **54 Battle tests passed again after the final UI changes**.
- **36 focused Chromium browser cases passed across targeted runs**, covering:
  - Two complete fresh-account, four-round Guided Play journeys, using real controls and the shared server-side transcript verifier.
  - Two complete six-round saved-practice journeys with a delayed completion receipt, open card/board inspection, one completion submission and explicit exit.
  - Real Plug post-play coach feedback, the actual first-sighting mechanic dialogs, the rival Cornball reading pause and three intermediate round acknowledgments.
  - A stale bootstrap refetch while a final-board card inspector is open; no handoff or reward advancement until the player chooses it.
  - Reading/portrait/status/final-board layouts at 320×568, 390×844, 768×600 and 1366×768.
  - Keyboard coaching; wheel/keyboard review scrolling; trusted Chromium touch swipes and taps at 390×650 and 740×360.
- After the final-board cleanup, all **8 affected final-board browser cases passed again**. Both keyboard-coaching cases also passed after the coach-position change.
- Full app typecheck and whitespace checks passed. The managed web workflow was restarted and the final preview was visually checked.

The browser journeys use disposable test-account API responses, not real Clerk signup or production account writes. Touch coverage is Chromium emulation, not proof on physical iOS/Safari hardware.

### Reproduction limits

The exact previously reported Plug-specific mechanic popup and premature lesson jump were not independently reproduced before the changes. The current journey plays Plug, but its first-sighting mechanic dialogs name Wifey. Tests distinguish Plug's actual coach feedback from those dialogs rather than falsely identifying them as a Plug popup. The revised review behavior is verified against delayed saves and a real query refetch.

The older `result-overlay-regression.spec.ts` still targets removed result-art markup. It was left unchanged and excluded from the new focused beta-feedback configuration; its cleanup remains separate. This report is not a claim that the entire release suite was run.

## Repeatable checks

```sh
pnpm --filter @workspace/squabblemon run typecheck
cd artifacts/squabblemon
PW_TEST_SCREENSHOT_NO_FONTS_READY=1 pnpm exec playwright test \
  --config e2e/playwright.beta-feedback.config.ts \
  --output=test-results/beta-feedback-verification
```

Evidence is under `artifacts/squabblemon/test-results/beta-guided-final/`, `test-results/b18/final-board-label/` and the `touch-proof-*.png` screenshots. The final managed-preview screenshot is `screenshots/beta-final-board-review.jpg`.