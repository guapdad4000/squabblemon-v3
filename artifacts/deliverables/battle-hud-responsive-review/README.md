# Responsive battle HUD regression fix

The compact offline header flattened guidance into a grid but left the speed pill without a slot and made Skip span a new row. Adding/removing Skip therefore reflowed the controls, and the speed pill stretched. The bottom timer was also hidden by phone and short-landscape CSS. Previous mobile fixtures omitted the real speed callback, hiding that regression.

Playback controls now occupy fixed, reserved slots in their existing Skip/Speed order. Narrow-header status text is bounded and the turn cue cannot wrap; claims receive their actual width. Desktop guidance grows correctly. The bottom timer is visible in every enabled layout, with a compact track on touch phones and a label in narrow mouse-driven windows. PvP has no empty local-speed slot. Tutorial controls cannot stretch; reading panels and replay details retain their own space.

Verification passed:

- Eight viewports: mouse 1440×1000, 1280×720, 844×390, 490×1000, 600×850 and 601×850; touch 320×568 and 390×844.
- Five live phases per viewport: decision, rival thinking, player reveal, effects and round result. Speed and Skip positions/sizes remain stable, controls do not overlap, real Skip returns to the decision, and speed toggling cannot reset the timer. The desktop round recap may expand its own content while controls stay fixed.
- Bottom timer/track visibility, healthy/warning/urgent/paused states, timer disabled and PvP preservation.
- Header/menu/music/focus checks and mobile inspection, trajectory anchoring, swipes and drag-to-play passed in five viewports.
- 64/64 battle UI tests, TypeScript and production/bundle budgets pass. No uncaught browser errors. These are browser-emulation checks, not physical-device or hosted multiplayer tests.

The final viewport run was split after the local preview process stopped; browser.json combines five completed cases with the three remaining completed cases on the same final source.

[Widescreen](1440x1000-mouse-player-ready.png) · [Widescreen resolving](1440x1000-mouse-effects.png) · [Narrow desktop window](490x1000-mouse-player-ready.png) · [Narrow desktop resolving](490x1000-mouse-effects.png) · [Landscape](844x390-mouse-player-ready.png) · [Phone](390x844-touch-player-ready.png) · [Small phone](320x568-touch-player-ready.png)

Run scripts/verify-battle-hud-responsive.cjs against a production battle-mobile fixture preview. TEST_BASE_URL and REVIEW_OUTPUT configure the server and evidence directory; optional TEST_WIDTHS restricts widths for focused reruns.
