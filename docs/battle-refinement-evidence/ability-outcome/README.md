# Ability outcome presentation — October 5, 2026

Implemented locally. No commit, push, or deployment.

Character special clips now require a meaningful change in the resolved event's recorded state. Failed abilities instead use a 260ms horizontal card shake, a short blocked cue, and “No effect” guidance while retaining the event's explanation. Reduced motion disables the shake. Failed targets do not receive success recoil/glows.

The shared outcome gate is used by clip selection, Battle rendering, feedback, and all three PlayLoop presentation paths. Failed events never mount BattleAttack/SpecialMove, avoiding their layout measurements, video fetch/decode, canvas allocation, and frame uploads. They do not reserve a fighter's first successful special playback. The presentation still applies every authoritative before/after state normally; game rules are unchanged.

The check ignores note-only and bookkeeping changes and distinguishes consumed defensive protection from actual damage/status changes. Buffs, damage, status changes, movement, draws/summons, copied/delayed abilities, discounts, timed protection, traps, and resource changes can qualify. Partial success retains the special. Events without outcome evidence do not qualify; clip previews still use direct catalog resolution.

## Verification

- Seven outcome tests pass: no targets, silence, Dr. Fade with no eligible fighter, consumed protection, partial success, buffs/damage/protection/discounts, movement/freeze, failed and successful summon rolls, note-only changes, and missing evidence.
- All 15 special-move tests pass. The focused outcome, special-move, feedback, choreography, and timeline test files pass.
- Production build, entry bundle checks, and TypeScript checking pass.
- Ten production-fixture browser scenarios pass at 390px and 1440px: no target, silenced, shield-blocked, successful, and partially successful. Every failure made zero special-video requests and mounted no cinematic. Success and partial success each requested and rendered the video. Both root theme settings and reduced-motion suppression were checked for failures. No browser runtime errors occurred.
- The broader battle suite still has the same three failures recorded earlier: two React useContext failures in Battle.test.tsx and the Rock merge assertion in superCommonCards.test.ts (expected 19, received 23). This is not a clean full-suite result.

Barber's failed ability now uses a 90ms lead-in and 260ms feedback beat instead of reserving the 3600ms video duration. Successful clips keep their duration. This is verified avoided media work and shorter failure presentation, not a measured whole-match FPS claim.

Reproducible browser fixture: `e2e/ability-outcome.fixture.html`; verifier: `scripts/verify-ability-outcome.cjs` (TEST_BASE_URL and REVIEW_OUTPUT supported). `browser.json` records the cases, and the included phone capture shows the failure feedback.
