# Battle artwork refinement — October 20, 2026

Summon inspection now reads the live token instead of its summoner's collectible record. It shows creator, current lane Hands, duration and current ability/status text, without collectible ownership, rarity or crafting controls. The existing inspector dismissal and focus handling remains shared.

Illustrated district effects have independent, invisible 44px tap targets outside the district play target. Only the original artwork, a soft glow and an overlaid expiry/count/Contraband-progress value are drawn. Tapping opens and highlights that exact item in district details, including ownership. Accessible labels also retain ownership. These optional fields are projected from current engine marks and preserve opponent-seat ownership mapping.

Phone formations use larger individual combat cards and retain unlimited crews. On short phones and landscape screens the battlefield scrolls instead of clipping every card. The hand and turn controls remain anchored. The existing background compositions and proportions are unchanged.

## Confirmed event effects

`battleArtwork.ts` reads before/after event snapshots to produce small presentation cues for Buddy planting, Buddy sprouting into its actual recipient, Royal Guard creation, Contraband transfers (including the third-carrier payout), and actual Packed Lunch healing. Failed/absorbed damage does not trigger a heal. Cues never mutate the match.

PvP adds an optional, explicit public cue projection, without transmitting full replay snapshots, hidden hands or private match marks. Client ownership is remapped for the viewer; delayed cues can still display after the source has left the field. Existing sequence-based presentation controls replay timing.

The overlay measures geometry once per event, animates transform and opacity for 480ms, cannot intercept input, and stays inside the battlefield. Reduced motion uses a static cue. Browser effect tests use real engine resolution in an isolated fixture, not a live account.

## Artwork audit

Nine current summon artworks (eight identities plus the blue Steward variant) and all ten illustrated item kinds decode successfully. The registry is checked against every current `SUMMON_TEMPLATES` entry. Summoned collectible characters continue to use their own portraits.

Grin's original was recovered from `artifacts/deliverables/full-balance-review-2026-09-26/art-revisions-and-summons/masters/grin.png` in the original workspace. The source manifest explicitly identifies it as the current summon that previously reused Cheshire's art. It is imported as lossless `public/assets/characters/grin.webp` (1254×1254, alpha, revision `0333dc05482d08a8`). Pixel comparison found zero alpha or visible RGB mismatches. Cheshire's collectible portrait is unchanged.

The `evil-mushroom.png` concept was excluded: its source manifest identifies a proposed summon. The current DeMario Mushroom keeps its own established art. Buddy Bud and Card Guard remain the original art recovered in the preceding commit; Contraband and Packed Lunch assets remain unchanged.

## Verification

- 113 targeted tests: 74 Battle, 22 multiplayer, 7 artwork/event projection, 7 character assets and 3 summon presentation checks.
- Engine declarations, frontend and API typechecks passed.
- Production build passed. Public entry 212.9/475 KiB; GameApp 897.6/900 KiB; Home 972.1/1200 KiB. The build skipped copying unchanged public media.
- Browser checks at 320×568, 390×844, 768×1024, 844×390 and 1280×800: correct art, owner/district filtering, direct item details, summon inspector, no horizontal page overflow, and access to the last card in formations with more than twelve fighters.
- Five effect kinds checked under both motion preferences, including no burst during windup and a non-interactive overlay. Visual captures reviewed for phone layout, source art, inspector identity and effect placement.

Local review and evidence: `output/console-reliability-20261020/refinement/REVIEW.html` in the original workspace. These are local browser-emulation checks, not authenticated production or physical iPad evidence. No deploy or remote push is included in this refinement.

## Mobile art and number-type correction

The local artwork fixture omitted the production font links, so earlier captures displayed fallback numerals. It now loads the same Clash Display, Plus Jakarta Sans and companion fonts as the application. The production number family is unchanged. Browser checks explicitly load Clash Display's digits and verify the stat family instead of accepting a silent fallback.

Phone hand cards are 116px wide, or 100px on screens at most 620px tall, replacing the former 64px short-phone presentation. A contained portrait occupies the area above a compact, two-line name strip; the dark gradient is restricted to that strip. Selection keeps the same width, horizontal scrolling reaches the entire hand, and the full name and move remain available in the selection preview and normal inspector. Short battlefields retain independent scrolling.

The revised browser pass covers all five viewports above. Phone checks use a five-card hand including Racially Ambiguous Transplant; verify portrait/name separation and dimensions; and tap the final card to check its full-name preview, selected bounds and deselection. Item checks verify transparent backgrounds, zero borders/shadows, contained art with glow, and 44px targets before exercising item details. Frontend typecheck and production build/bundle checks passed again, with the same rounded JavaScript totals. No game rules or reward logic changed in this correction.
