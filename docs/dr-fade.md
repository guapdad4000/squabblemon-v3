# Dr. Fade: the welcome Legendary

## Card
- Engine ID: `drfade`; catalog/artwork ID: `dr-fade`.
- Legendary, Light, 4 Motion, 6 base Hands.
- The First Lesson: strongest enemy in his district loses 2 Hands; weakest non-hazard ally in another district gains 2 Hands.
- Normal cover, Wifey protection, mitigation, silence, freeze and uncounterable rules apply.
- SQUABBLE doubles his base Hands to 12. It does not double the ability.
- Level 2 / 5 / 8 coaching: +1 to the coached ally / +1 to Dr. Fade / an additional -1 to the successfully hit enemy.

## Welcome and progression
The foundation collection contains 21 cards. Only newly created `my-first-crew` decks use the mentor lineup: Dr. Fade takes Hooper's slot in the opening hand, and Wifey remains available for protection. Hooper remains owned.
The tutorial saves Dr. Fade for the round-four SQUABBLE. Legacy saved crews keep their existing teaching path.
Eligible returning accounts receive Dr. Fade when bootstrap runs, under the existing profile lock. This additive grant does not rewrite saved deck slots, spend currency, reset onboarding, or remove unknown catalog IDs.
Chapter One's finale adds 250 Clout and Chapter Two's finale adds 500 Clout, using stable reward claim keys. The first fund can buy a 100-XP Practice Session and the first Move Coaching tier at the Trading Post. No duplicate pull is required. Previously claimed chapter finales retain their existing receipts.

## Artwork and presentation
Artist originals and all 13 segmentation PNGs are preserved in `artifacts/squabblemon/reference/dr-fade/`.
`scripts/build-dr-fade-art.cjs` registers the supplied character, bag and chain at their original positions and exports the static portrait plus three cached WebP layers. Run `node scripts/sync-character-revisions.cjs` after rebuilding.
The layered portrait is used in hands, collection and inspection. Small board portraits use the static export.
The procedural entrance is pointer-transparent, bounded to the battle area, lasts at most one second, and uses a stable event sequence so polling cannot restart it. Reduced motion removes the movement.
Dedicated animation clips can be assigned through the existing special-move catalog when supplied; the layered treatment remains a fallback.

## Verification
- `pnpm --filter @workspace/squabblemon test`
- `pnpm --filter @workspace/api-server test` uses a guarded, owned in-memory database; includes a new-account campaign through HTTP.
- `pnpm --filter @workspace/squabblemon test:player-journey` checks the actual guided UI on phone and desktop with verified engine transcripts.
- `pnpm --filter @workspace/squabblemon test:dr-fade` checks art loading/proportions, desktop/mobile/landscape, reduced motion, Confirm hit testing, and automatic dismissal during repeated renders.
Automated results do not measure human comprehension or establish final PvP balance.
