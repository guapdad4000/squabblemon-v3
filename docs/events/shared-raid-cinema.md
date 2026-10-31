# Shared cinematic boss raids

Punch-On Patrol, Kumite and Anu use the same raid battlefield. Anu retains its own server rules, chapter gates, saved actions and reward receipts; a typed presentation adapter supplies those rules to the shared view. A visual change should reach all three modes without copying a second hand, formation viewer or action bar.

## Screen order

1. **The boss owns the top of the screen.** A wide illustrated arena and title plate surround a large, centered animated character. Boss name, current phase, remaining HP and the next real threat stay readable around the actor. The actor does not occupy a separate sidebar.
2. **The opposition stands between the boss and the crew.** Animated enemy actors belong to their district. Names and live Hands stay attached to them, and inspection opens the complete card. Token summons retain their own card art and rules.
3. **The battlefield remains playable.** Three districts show the actual player/opponent formation, current score and relevant lane rule. Crowded formations use the shared expandable formation presentation; no unit is removed or capped for layout reasons.
4. **The hand and turn action anchor the bottom.** Motion, legal play cost, Squabble, lane selection, investment where supported and the end-turn action remain reachable. Details and help use the established inspection/dialog patterns.

The arena palette, background, lettering, boss identity, phase label and enemy art vary by mode. The hierarchy, lifecycle, card inspection and controls are shared. Prefer slashes, painted light, lettered labels and the arena itself to nested bordered rectangles. All emblems use fists.

## Animation contract

The Anu boss has drawn idle, windup, strike and recoil cels. The eight earned Yakub/Anu chat emoji animations use four separately drawn cels per emotion, matching the existing store character-reaction pattern. Moving or scaling one still image does not satisfy this asset contract.

Store generated source sheets and their prompts alongside the media evidence. Publish compact alpha WebP animations plus still posters; retain GIF fallbacks for reactions. Keep ownership and reaction IDs stable when replacing their asset paths. Existing raid sprites retain their established assets and action phases.

Moving assets observe the shared playback lifecycle: use a still poster when reduced motion is requested, the document is hidden, the actor is offscreen or the raid is paused. Do not add a timer or video decoder per card. Only the visible actor band needs moving media; the formation inspector can use posters.

## Mechanics and future dynamics

This presentation upgrade keeps the three modes' existing authoritative actions and rewards. HP, projected strike, lane totals, charge and phase labels must describe values that the engine actually uses. The dormant Overdrive calculation helpers are not active raid bonuses and must not be advertised as playable powers.

Future Kumite pickups and raid power-ups should enter through the same action boundary. Define the earn condition, target, duration, stacking limit and resolution order in the raid engine; serialize the resulting state in the saved action receipt; then expose its real charge/availability to the shared cinematic stage. Add one readable pickup or charge beat in the arena rather than another permanent control panel. Verify retries, resume, round transitions and reward limits before enabling a new power.

## Acceptance evidence

Capture the same populated Patrol, Kumite and Anu states before and after at desktop and phone sizes. Check boss dominance, live enemy actors, uncropped HP/threat labels, the three districts, card inspection, overflow formations and hand/turn access. Exercise Anu's native action adapter, including investment reset, district help, round resolution, result/resume and retry copy. Keep existing raid combat tests passing.

For each new animation, inspect a contact sheet and its runtime clip. Confirm actual face/pose changes, alpha edges, frame count, byte size and a still fallback. Browser evidence should verify the moving/poster switch for pause, reduced motion, hidden document and offscreen actors. Fixture screenshots prove local presentation; they do not prove a production deployment or live-account rewards.

The local review gallery is `output/raid-cinema-review/index.html` in the parent workspace. Push and deployment remain on hold.
