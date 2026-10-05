# Squabblehouse cutout correction

Correct assets: `squabblehouse-cashier.webp` (register and receipt cashier) and `a-side-of-hands.webp` (gloved fist and waffles).

Removed the cashier's opaque black background and the waffle illustration's brown background. Saved alpha-bearing WebP assets with updated SHA-256 cache revisions. Centered A Side of Hands above its card caption with a rule scoped to that card. The card details layout is unchanged.

Screenshots cover desktop (1280 x 1000) and mobile (390 x 844) collection, inspector, hand and board rendering. `transparency.png` shows both finished assets over a checkerboard.

Validation:
- Production CardView fixture build passed.
- Browser checks passed: both assets load at their new revisions, all three render sizes are visible, no page errors.
- Targeted Cashier / A Side of Hands alpha and revision test passed.
- App type check passed after building local engine and API client declarations.
- The existing unchanged-source comparison requires original supplied PNGs absent from this checkout; it could not run.

Original WebP files are preserved under `originals/`. Changes are local to this task's attached worktree based on origin/main (4c23a76a); no commit or push was requested for this correction.
