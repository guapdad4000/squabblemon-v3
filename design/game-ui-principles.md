# Game UI principles

Apply these principles to Squabblemon game screens and future UI work. They adopt the concrete guidance in the user's October 10, 2026 design brief and the evidence in [Mobile card-board research](mobile-card-board-research.md). Reference examples, suggested sizes, and claimed improvement percentages are not universal specifications or verified results.

## Start with the current decision

Give each screen one clear visual entry point. Group the subject, name, primary stats, and relevant action together. Align repeated information consistently. Make the number or state that determines the player's next decision the strongest element.

Keep information related to the current activity. Remove duplicated labels, repeated-purpose components, redundant buttons, and explanations already conveyed by an interaction. Use icons for familiar concepts, with accessible names and enough context for unfamiliar ones.

Put secondary lore, edge cases, and extended explanations in inspection. Keep essential rules visible when understanding them is the screen's purpose: district detail popups present their explanation directly, and the battle retains a concise district summary. Progressive disclosure must not hide the primary content.

## Preserve the game and the artwork

UI changes preserve existing gameplay, card populations, stats, timings that affect rules, and normal detail flows. Squabblemon's crowded districts must remain fully reachable; never introduce a four-card cap because a reference game has one.

Keep existing character art and its intended proportions. Compact card presentations may reorganize labels and numbers, but must not crop away art to make it fit. Preserve identity, current values, and important status. Full card details remain available for both sides, including special-mode opponents.

Use references to learn hierarchy, feedback, and composition. Create Squabblemon assets and components rather than copying another game's art, branding, frames, or audio.

## Compose for the viewport

Design portrait, short landscape, tablet, and desktop compositions intentionally. Allocate a stable space to header/status, field, hand, and actions. Transient messages belong in a reserved region or overlay; they must not repeatedly push the board down.

Keep the hand dock predictable. Hand selection may rise or enlarge visually without changing the field's geometry. Cards and primary controls must remain reachable at the bottom, inside safe areas. Crowded fields need deliberate overflow behavior, not clipping or invisible cards.

Reserve two lines for on-board district rule summaries and keep the themed explainer available. Favor shorter wording over shrinking text. Related counters and scores should have stable positions and consistent alignment.

## Make state unmistakable

Differentiate hover/focus, selected card, selected district, legal target, blocked target, and resolving action. Combine outlines, shapes, icons, labels, and value changes so meaning survives a still screenshot and is not conveyed by color alone.

Give primary actions clear size, contrast, and press feedback. Use generous interaction regions; 44 CSS px is a practical primary-control target for this web UI. Support keyboard focus and a touch interaction that does not require precise dragging. Restore focus after inspection or popup dismissal.

Use expressive display type for short titles and numbers. Use readable body type for rules and dialogue. Measure contrast against actual backgrounds: normal text targets 4.5:1 and qualifying large text 3:1. Decorative skew, rotation, tracking, and glow must not weaken gameplay readability.

## Add purposeful game feel

Use bold, themeable accents, angled panels, strong silhouettes, and crisp contrast. Restrained stripes, glints, geometric particles, and portrait idle motion can make a screen feel alive without competing with play.

Most focus, press, selection, and impact feedback should respond within roughly 100–250 ms. Use short staggered entrances, local color inversion, modest scale punches, and panel wipes where they clarify a transition. Animate transforms and opacity without changing layout. Do not stack every available effect on every interaction.

Prefer local impact flashes to repeated full-screen white flashes. Avoid shaking or blurring text, cards, or targets while the player needs to read or act. Reduced motion replaces shakes, parallax, and large travel with clear static or brief state cues; it preserves all information and controls.

Health modes can use a smoothly changing fill, a delayed damage trail, signed impact numbers, and distinct healing feedback. Keep the numeric value truthful during animation. Position effects near the actual impact and use more than color to indicate loss or recovery.

## Dialogue, menus, and showcases

Group portrait, speaker name, and dialogue. Optional typewriter pacing, punctuation pauses, subtle blinks, and emphasized keywords add personality. Allow immediate completion and skipping. Reserve wave/shake effects for short emotional emphasis; never apply them to whole paragraphs or vital instructions.

Menus can use chevrons, diamonds, focused icons, and restrained connector motion when these fit the theme. Focused descriptions should explain the current option without duplicating information everywhere. Flexible panel borders should scale without distorted corners.

Deck selectors and showcases may use shallow 2.5D depth, a larger brighter center item, mild parallax, and responsive carousel motion. Dense battlefields must keep every relevant card sharp and readable; showcase blur and perspective are not a default board treatment.

## Keep polish affordable and verify it

Prefer lightweight components, event-driven effects, and reusable timing/style tokens. Pause offscreen idle work and honor effect preferences. Do not rerender every card for an unrelated timer or decorative tick. Heavy shaders and full 3D are optional, not prerequisites for a cinematic interface.

Before calling a design pass complete, verify:

1. The player's current decision, primary state, and action are obvious.
2. Artwork, live numbers, selected state, and important statuses remain readable.
3. There are no redundant controls, unnecessary paragraphs, or repeated-purpose components.
4. Messages, draw changes, animations, and inspection do not cause unexpected layout shifts or cropped cards.
5. Populated phone, tablet, and desktop views, keyboard/touch flows, reduced motion, and measured performance remain usable.
