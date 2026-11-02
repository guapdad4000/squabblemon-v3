# Kumite and recent-mode design polish

This pass builds on the live Breakthrough implementation and the data audit at `066e6af22de8f3357b2dde7df629447652a483c4`. It changes presentation; match rules, limits, ownership, reward receipts, and transport remain intact.

## Changes

- Breakthrough practice and PvP entry: lacquered wood/gold deck panels, red primary actions, illustrated player identity, compact trophies, shorter copy. Match limits and reconnect guidance remain in an accessible rules disclosure. Small identity portraits use existing battle derivatives.
- Breakthrough arena and shared raid combat: replace fist/lightning emoji with the existing SVG fist and game Motion artwork. Costs retain their exact numerical values.
- Anunaki raid entry: reuse the 35,498-byte Anu figure beside the title; styled difficulty and crew controls, explicit selected/locked states, concise setup, expandable rules and rewards, saved-reward icons.
- Dojo and Precinct raid entry: handwritten headings, readable HP/tier/best stats, warm deck selection, illustrated unlock list in a disclosure, shorter instructions and navigation.
- Dojo practice result/error: new transparent bronze bell with a clenched-fist emblem, themed retry/exit actions, retained no-rewards label. Generated with the built-in image tool; 600×400 WebP, 56,894 bytes. See `kumite-practice-bell-v1.json` for provenance.
- Anunaki event: remove duplicated reward-state copy and decorative filler; consistent check/lock icons; concise headings and small-screen seal spacing; retain all 24 milestones, exact requirements and claim receipts.
- Community crews, trial dialog and personal records: replace emoji fists with consistent SVGs; shorten trial explanations, theme the opponent selector/actions and align the homie emblem.

## Review and regression coverage

- Entry screenshots: Breakthrough practice, PvP lobby, Anunaki raid, Dojo raid, Kumite hub at 320×568, 390×844, 844×390 and 1440×960.
- Event roadmap: locked, ready, collected, duplicate receipt, in-flight profile change, Escape and focus restoration.
- Practice: missing-crew retry, actual six-round local result, runback and exit; no match/reward writes.
- Shared raid combat: populated formations, all-card inspection, rules disclosure, extra Motion/dice choices, lost-response retries, motion lifecycle.
- Kumite hub: signup, withdrawal, failed signup, bracket, history, rules, check-in, keyboard tabs, artwork, reduced motion and shortcut rail.
- Community: trial → real loaner practice, and owned-card version → save, at phone/desktop sizes.
- React review: no new effects or request loops, scoped styles, stable keys, semantic buttons/disclosures, visible focus and decorative artwork labels.

Some older browser fixtures did not match current production markup: the Safehouse shortcut fixture now uses the production navigation wrapper, and flag screenshots capture the page because the wrapper uses `display: contents` on mobile. Emoji/case/base-path assertions were updated without removing their behavioral checks.

Evidence is stored outside the source tree with the release package. Local fixtures and builds are not production/authentication/device proof. This pass does not claim a visual review of every historical screen or every gameplay permutation.
