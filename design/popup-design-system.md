# Squabblemon popup design system

The Story crew picker is the visual reference: dark underpass, cream dossier paper, red ink, pinned photographs, and green street signs. Popups belong to the same neighborhood while keeping the art and purpose of each scene. Use fists for new emblems; never crowns.

## Implementation contract

- `artifacts/squabblemon/src/components/ui/game-popup.tsx`: reusable presentation primitives. Callers own native `<dialog>` or Radix semantics, focus, queueing, API state and dismissal.
- `src/styles/game-popup.css`: local typography, color, control and accessibility roles. These do not replace global fonts.
- `src/styles/reward-street-file.css`: the Story dossier material, reward slips, stamps and arrow CTA. Works with either native or Radix dialogs; never supplies fixed positioning.
- `src/styles/*-popup.css` or the feature stylesheet: only the specific composition, existing art and responsive layout.
- Development workshop: `/e2e/popup-system.fixture.html`. Four sample families and a live font specimen, using the real primitives. Sample values are explicitly labeled and never grant rewards. It is an E2E entry, not a production route.

Import primitives directly. Do not add another local font stack or copy the same paper/button CSS into a feature. Add a shared role only when a new purpose actually needs it.

## Typography

| Role | Family / weight | Use |
|---|---|---|
| `--popup-font-title` | Hemi Head Italic / 700 | Large dossier outcome or question |
| `--popup-font-feature` / brick title | Blzee / 400 | Compact brick popup titles; one expressive character/feature name via `GamePopupTitle feature` |
| `--popup-font-amount` | Hemi Head / 700 | Exact currency quantities, primary actions, short stamps |
| `--popup-font-body` | Plus Jakarta Sans / 500–700 | Consequences, rules, error recovery, supporting labels |
| `--popup-font-label` | Space Mono / 700 | Dates, case labels, compact metadata |

The supplied Hemi files are weight 700; do not request 400/900 and synthesize missing faces. Blzee is 400. Leave M290 and handwritten accents to their existing authored scenes until they have a defined role. No expressive display font for paragraphs, odds, long button explanations, or card rules. Logos remain artwork.

Use a 28–46px headline with intentional wrapping, 14px body, 12px secondary action, and 10–11px compact labels. Use the responsive composition before shrinking meaningful text. Amounts use tabular numerals and include the real signed quantity. The gallery and browser checks verify actual computed font family and weight after fonts load.

## Four families

| Family | Composition | Primary action | Behavior |
|---|---|---|---|
| Reward | Recognizable reward/character art, stamped dossier, pinned loot slips | Collect for an unclaimed grant; Keep going for an already saved receipt | Only show confirmed amounts after a response. Retry the same claim; never imply another payout after an idempotent recovery. |
| Announcement | One illustration or poster, short headline, one useful detail, direct destination | See event / See lineup | Use only real published changes. Retain in inbox; do not repeat every login. The workshop is a presentation example, not a new event feed. |
| Confirmation | Compact brick wall, explicit consequence, two unmistakable choices | Concrete verb; red sign for a destructive consequence | Focus the safe choice. Keep pending submission guarded, expose errors, and preserve Escape/cancel rules. |
| Recruit | Existing full character composition or cinematic, one feature name, unlock stamp | Meet your crew / Keep going | Preserve authored recruitment films and art. The workshop provides a fallback composition; it does not replace the current recruitment ceremony. |

Set `data-popup-family` (or the Frame's `family`) for purpose; set `data-popup-tone="destructive"` (or `tone`) only for real destructive consequences. Reward rarity is not the same as a destructive tone.

## Material and hierarchy

Use `GamePopupFrame material="dossier"` for large rewards, and `material="brick"` for small announcements or confirmations. Brick uses the existing `assets/progression/brick-ui-v1.webp`, cream ink, a compact green backing, and Blzee title lettering. Material follows the popup purpose, not screen width; a large reward stays a dossier on a phone. The default `plain` supports existing authored surfaces. Native/Radix wrappers may apply the same classes/data attributes and base-aware artwork variables directly.


1. One headline says what happened or what decision is needed.
2. Art establishes the subject. Keep character proportions; never use decorative cropping to hide a face.
3. One short sentence explains the relevant consequence. Put lore or full rules in their existing inspection flow.
4. Reward slips group glyph, amount, and label. Show every awarded currency/card; do not hide tickets or shards behind a Clout-only total.
5. One large street-sign action leads onward. A quiet 44px secondary control handles later/cancel/review.

Use the authored `assets/selection/underpass.webp` and `dossier.webp` through `getAssetUrl` and `--reward-file-scene` / `--reward-file-folder`. The same artwork is browser-cacheable. Paperclip, pins, ruled lines and slight photo angles are cheap CSS. Keep controls and body copy level. No moving full-screen noise, blurred text, heavy shaders or new autoplay video for a simple receipt.

Native dialog backgrounds use the shared dark scrim. The frame stays visually distinct from the page. Brick confirmations need not reserve a large hero area; reward receipts should not become a stack of generic dashboard cards. Use cream/ink contrast for reading and green/cream for action. A red stamp supplies state as text, not color alone.

## Responsive and interaction rules

- Verify 320×568,390×844, short landscape844×390, and desktop1440px.
- Keep the full frame inside the viewport and safe areas. Vertical scrolling is acceptable when needed; horizontal scrolling of a popup is not.
- Use a side portrait on desktop; a concise hero above the paper on phones. Short landscape may use two columns. Primary controls should stay visible whenever practical.
- All actionable controls have at least 44px targets, visible keyboard focus and disabled/pending feedback.
- Give the dialog a real accessible title and, when useful, a description. Native and Radix wrappers retain their existing semantics; the primitives do not add a nested dialog.
- Restore focus to the opener or the relevant battlefield control after dismissal. For a destructive confirmation, initially focus the safe choice.
- Prevent duplicate submissions with an in-flight guard. A dismissed arrival leaves the actual reward claimable elsewhere.
- Queue arrival notices until the player is at a safe surface; do not interrupt battles, pulls, existing dialogs or active reward ceremonies. The daily arrival follows these checks; this release does not replace all existing presenters with a universal coordinator.

## State and motion

Keep presentation separate from claim authority. An earned preview, a pending claim, a confirmed saved receipt, and a failed confirmation are different states. Labels such as Collected, Recruited, and Saved must reflect actual state. Lost responses recover from authoritative receipts without another charge or a fabricated second reward.

Use short local opacity/transform entrances. No layout shifts in battle, mandatory waiting to dismiss a receipt, or shaking vital text. Reduced motion preserves the same outcome, reward list and controls. Existing Story wallet travel, reward stingers, level-up scenes and recruitment sequences retain their own reduced-motion behavior; the material layer must not replace their lifecycle.

## Migration map

| Surface | First-wave adoption |
|---|---|
| Safehouse daily arrival | Shared dossier material, font roles, full reward slips, visible weekly and monthly calendars, exact card receipts and sign CTA |
| Boss/Kumite raid payout | Shared dossier, pinned boss portrait, actual damage, complete confirmed payout and sign CTA |
| Generic reward receipt | Shared primitives/material/typography; existing loot art, queue and saved receipt semantics |
| Story reward receipt | Shared paper/loot/buttons and font roles; retain Story art, wallet collection and single saved receipt flow |
| Notification inbox | Shared title/body/control roles on its existing dark inbox; no forced reward art |
| PvP surrender | Shared compact brick wall/Blzee title/destructive action; retain server mutation and pending guards |
| Level-up, character recruitment, Kumite films, pack opening | Preserve authored ceremonies; future edits reuse roles where appropriate rather than flattening them into a generic dialog |
| Bulletin board, music, card inspector, Fadecade machine, shop, tutorial | Existing specialized tools/scenes remain. Migrate individual controls deliberately when editing them; no blanket global dialog selector. |

This is a common implementation and design contract, not a claim that every historical popup has been redesigned. The component boundary and workshop provide a consistent starting point for the remaining specialized surfaces.

## Review before adding a popup

Can the player tell why it appeared, what happened, and what one action comes next? Does it use one of the four purposes and the existing font roles? Are all granted items and consequential rules visible? Is the content truthful and the primary action 44px or larger? Does it behave correctly on a small phone, short landscape, keyboard and reduced motion? Does it preserve artwork and existing claims/queues? Test the actual feature flow in addition to the workshop; sample previews prove layout, not server behavior.

Run `pnpm --filter @workspace/squabblemon test:popup-system` against the dev server (`UI_ORIGIN`/`CHROMIUM_EXECUTABLE` supported), plus the actual receipt/daily/boss/confirmation browser suites relevant to the migration.

## Lightweight wallet arrivals

`BagRewardArrival` reads structured positive deltas from the existing NotificationProvider bag notices. It never writes balances or adds a claim endpoint. On Safehouse/store routes it waits for battles, pulls, dialogs, and queued ceremonies to finish, groups unread gains, counts to the current authoritative wallet balance, and sends at most six short transform/opacity glyphs to a visible wallet/bag target. Completing the 3.6-second presentation marks those same notification IDs read. Leaving or being interrupted retains them for the next safe visit; clearing the bell suppresses them. Reduced motion shows exact values without travel. No initial-wallet celebration or negative-spend animation is invented.
