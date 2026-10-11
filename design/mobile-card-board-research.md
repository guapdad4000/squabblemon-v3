# Mobile card-board research

Researched October 10, 2026. This document records primary-source evidence and the resulting Squabblemon design decisions. It does not claim an instrumented session inside the competitor apps. Publisher screenshots were inspected visually; documentation and developer statements were read separately.

## Evidence labels

- **Documented:** stated by the publisher, developer, or platform documentation.
- **Observed:** visible in an identified publisher screenshot; not proof of every current client state or the gesture that produced it.
- **Adopted:** a Squabblemon requirement or an implementation inference, not a competitor specification.

No competitor artwork, branding, sounds, card frames, or proprietary implementation should be copied. The useful references are hierarchy, information density, spatial relationships, and interaction feedback.

## Compare the correct games

“Pokémon online” now means two relevant products. Pokémon TCG Online shut down on June 5, 2023; Pokémon TCG Live is its current full-TCG successor. Pokémon TCG Pocket is a separate smartphone game with streamlined rules. [Pokémon Online sunset information](https://support.pokemon.com/hc/en-us/articles/4406895467668-Pok%C3%A9mon-TCG-Online-Sunset-Information), [Pocket gameplay FAQ](https://support.pokemon.com/hc/en-us/articles/30330309361172-Pok%C3%A9mon-TCG-Pocket-Gameplay-FAQ).

| Game | Field structure | Useful design evidence | Rule that must not transfer |
| --- | --- | --- | --- |
| Marvel Snap | Three locations; normally at most four cards per player at each location | Compact board faces, location totals, inspect for full explanations | Four-card capacity |
| Pokémon TCG Live | One Active Pokémon and normally up to five Benched Pokémon | Strong focal hierarchy, separate hand, public stats outside tiny card text | Active/Bench rules or their default capacity |
| Pokémon TCG Pocket | One Active Pokémon; three Bench positions visible in the inspected official image | Clear portrait composition, larger Active, readable HP, restrained peripheral controls | Pocket's smaller deck or field rules |
| Squabblemon | Three districts; card populations can exceed a fixed four-card layout | Keep every card reachable while presenting decisions clearly | No new card limit, deletion, or gameplay change |

The Snap limit is documented in its [official location-capacity FAQ](https://marvelsnap.helpshift.com/hc/en/3-marvel-snap/faq/94-how-many-cards-can-i-play-in-each-location/). Live's default structure is documented in the [official TCG rulebook](https://assets.pokemon.com/assets/cms2/pdf/trading-card-game/rulebook/swsh12_rulebook_en.pdf); individual game effects can change ordinary rules. Pocket's three positions here are a screenshot observation, not a claim that every mode and effect has an immutable capacity.

## Marvel Snap: a board representation, then inspection

**Observed, historical 2023 image:** Apple's creator interview shows three central locations with opposing cards arranged in compact two-column groups. On-board faces emphasize character art, name, and Power; the full ability paragraph is not competing inside every small card. This is evidence of a distinct board representation, rather than proof that simply scaling a complete collectible card will remain readable. [Apple's June 5, 2023 interview](https://developer.apple.com/news/?id=sosm2p7q), [the article's board image](https://devimages-cdn.apple.com/wwdc-services/articles/images/E8E9A50A-4BB5-4862-B297-6F3184D6DD40/2048.jpeg).

**Documented:** Snap identifies Energy at the top left, Power at the top right, and ability text below. Modified values use green for enhancements and red for negative effects. Squabblemon can adopt a consistent number position and visible change cues, while adding a sign, icon, or explanation so color is not the only signal. [Card information FAQ](https://marvelsnap.helpshift.com/hc/en/3-marvel-snap/faq/21-what-does-the-information-on-cards-mean/), [modified-number FAQ](https://marvelsnap.helpshift.com/hc/en/3-marvel-snap/faq/22-why-do-the-card-power-energy-numbers-show-as-red-green/).

**Documented, March 4, 2025:** Snap added current stats and card zoom to discard/destroy/banish piles. In enlarged views, tapping the description opens keyword clarification. Short primary wording and an accessible deeper explanation can coexist; the board does not need every edge case printed at miniature size. [Official patch notes](https://marvelsnap.com/patch-notes-march-4-2025/).

**Documented, developer account:** engineer Ali Wallick describes the PC launch as rebuilding a large part of the interface for landscape and mouse/keyboard interaction. Responsive design needs a composition for each viewing shape. Stretching a phone composition across a monitor is insufficient. [Wallick's project account](https://aliwallick.com/projects/marvel-snap).

The [current publisher App Store listing](https://apps.apple.com/us/app/marvel-snap-hero-card-game/id1592081003) remains a reference for current promotional presentation; the explicitly dated 2023 image above is not described as a current screenshot.

## Pokémon: preserve the card, emphasize the live state

### TCG Pocket

**Observed:** the current publisher listing's portrait battle image places the opponent above the player. Each Active Pokémon is centered and larger than the player's single-row Bench. Full card faces retain their proportions; large HP values and thin health indicators sit near the upper card corners. The hand occupies a separate overlapping row at the bottom. Deck/discard, Energy, points, and turn actions occupy peripheral zones. A cyan foreground card outline is visible, but the screenshot does not establish which input or state caused it. [Publisher listing](https://apps.apple.com/us/app/pok%C3%A9mon-tcg-pocket/id6479970832), [inspected battle screenshot](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/d4/46/75/d446758d-e710-89b8-33ac-5c59b9210951/EN_iPhone15_1106.png/600x1300bb.webp).

**Documented:** Pokémon's corporate design account describes preserving the experience of physical cards while using digital presentation, including close card viewing and immersive art. It also explains the smartphone-oriented simplification to 20-card decks and shorter battles. This supports separating a quick field read from richer card inspection; it does not require a 3D board or adopting Pocket's rules. [Pokémon's November 28, 2024 design article](https://corporate.pokemon.co.jp/en/topics/detail/t-28/).

### TCG Live

**Observed:** the publisher's phone battle image preserves complete card faces and emphasizes HP in prominent external badges. The five-player Bench uses a compact three-plus-two arrangement instead of squeezing every card into one horizontal strip. The bottom hand uses larger overlapping faces; deck, Prize, and discard information remains peripheral. This shows that card grouping can change with available width while maintaining identity and state. [Publisher listing](https://apps.apple.com/ca/app/pok%C3%A9mon-tcg-live/id1557962344), [inspected battle screenshot](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/9d/94/a0/9d94a042-e70a-214e-134d-d0d7cf0f60cc/PR00027_AppStoreCTA_EN-US_03_1242x2688.jpg/600x1300bb.webp).

**Documented, April 21, 2026:** Live introduced landscape layouts on iPad and Android tablets. **Documented, September 15, 2026:** its team describes card-centered battleboards, landscape layouts reflecting physical play, and camera/layout changes for legibility. These support distinct portrait and landscape geometry and giving the field priority over decoration. The September letter also mentions adjustable audiovisual effects. [Landscape update](https://www.pokemon.com/uk/news/pokemon-tcg-live-landscape-layout-and-deck-editor-updates), [September developer letter](https://community.pokemon.com/en-us/discussion/26006/letter-to-the-community-september-15-2026).

Live documents a large card-inspection view in its deck editor. That source supports an inspection layer but does **not** verify the precise battle tap/hold gesture. [Official enhanced-editor explanation](https://community.pokemon.com/en-us/discussion/24855/get-acquainted-with-the-enhanced-deck-editor-experience-in-pokemon-tcg-live).

## Squabblemon adoption

These are project decisions, not claims that another game uses the same implementation.

| Concern | Adopted behavior | Verification |
| --- | --- | --- |
| Board faces | Present the existing art, name, live Hands/Motion, and meaningful status. Keep full ability text in normal card details. Do not crop the character art to create the compact representation. | Inspect representative tall, wide, dark, and transparent art; open both players' details. |
| Dense districts | A compact grid can show a normal population. Preserve unlimited cards using intentional overflow or expanded inspection; every card remains reachable and included in totals. | Exercise 0, 1, 4, 5, 8, and 12 cards on each side of a lane; no hidden hard cap. |
| District center | Keep district name, both scores, and a short rule summary. Reserve a fixed two-line summary budget and retain the themed district explainer. | Long rules do not move the board; full rules remain available. |
| Hand | Use a stable bottom dock, or a side dock in short wide viewports, with recognizable cards, clear selected state, and deliberate browsing when needed. | Drawing, selecting, inspecting, playing, and turn changes do not shift the dock unexpectedly. |
| Selection and targets | Distinguish selected card, selected lane, legal targets, and blocked targets using shape/outline plus semantic text or icons. | A still screenshot makes selection and permitted action clear without relying solely on glow/color. |
| Transient feedback | Turn instructions, COM text, and effect announcements occupy reserved space or an overlay. | No insertion repeatedly pushes the field downward. |
| Landscape | Allocate width to the three districts and height to card rows; keep actions and the hand independent of field sizing. | Check desktop, iPad portrait/landscape, and short phone landscape separately. |
| Animation | Use event-driven impact, value changes, and local emphasis. Preserve card and target visibility throughout. | Reduced motion keeps the same state information and reachable actions. |

The field prioritizes the question “What can I play, where, and what will it change?” Inspection prioritizes “What exactly does this card or district do?” These purposes should share data and visual identity without duplicating every control or paragraph.

## Current implementation decisions

Source-reviewed October 10, 2026 in [battle-board.css](../artifacts/squabblemon/src/components/battle-board.css), [Battle.tsx](../artifacts/squabblemon/src/components/Battle.tsx), and [CardView.tsx](../artifacts/squabblemon/src/components/CardView.tsx). The following ratios, thresholds, and arrangements are Squabblemon implementation choices. They were **not** measured from, or prescribed by, Snap or Pokémon.

- **Combat tiles:** the opted-in battlefield face uses a 4:5 outer frame. Its existing character image uses `object-fit: contain`; the frame shape does not crop or stretch the art. The canonical complete card remains 63:88 for the hand, collection, and normal inspection presentation. Compact labels prioritize current numbers and identity over collection metadata.
- **Portrait formations:** each player's district side uses two columns, normally a two-by-two arrangement. Small formations are centered within that space; larger populations add rows.
- **Wide landscape formations:** at widths of at least 601 CSS px in landscape orientation, up to four cards use four columns in one row. More than four settled cards use three columns and at least two rows, adding rows for larger populations. This uses available width without introducing Snap's four-card gameplay limit.
- **Combat status:** live Hands already includes modifier and ongoing arithmetic. The compact face keeps that authoritative total and its change color, with one status icon plus an extra-effect count; charge/form labels shorten on the field. Full effect names, charge thresholds, itemized modifiers, and abilities remain in accessible card labels and canonical inspection. Ice and other status artwork stay below the live numbers.
- **Crowded formations:** populations over four retain vertical scrolling and the formation inspector. Every card still exists in the rendered population and contributes to gameplay. Card sizing accounts for both the lane's available width and height.
- **Short viewport hand:** at widths of at least 601 CSS px and heights of at most 580 CSS px, the hand and actions occupy a 166 CSS px side dock. The hand scrolls vertically there. Other layouts retain the bottom dock; selection does not change the card's layout width.

These are source-level descriptions, not standalone proof that every viewport, name, status, or transition is visually readable. Populated browser checks must verify the acceptance criteria below, especially the four-to-five-card transition, short-wide hand, and containment of unusually proportioned art.

## Input, readability, and performance

Apple recommends generous targets and comfortable thumb placement for frequently used game controls, together with safe-area awareness and direct manipulation where appropriate. For this web interface, 44 CSS px is an adopted practical target for primary controls, not a conversion claim about Apple's native point measurements. Small card art can sit inside a larger interaction region; do not make drag the only way to play. [Apple game-controls guidance](https://developer.apple.com/design/human-interface-guidelines/game-controls).

Use readable body text and measured contrast over the final wallpaper and effects. WCAG's normal-text contrast target is 4.5:1; qualifying large text is 3:1. A decorative font or screenshot glow does not substitute for measurement. Do not use color alone to communicate buffs, ownership, selection, or danger. [W3C contrast guidance](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum), [Apple game-design guidance](https://developer.apple.com/design/human-interface-guidelines/designing-for-games/).

Pocket documents display-quality options and a 30 fps cap for troubleshooting. That establishes adjustable rendering cost as a real product pattern, not evidence that all effects should be removed. Keep vital numbers, art identity, and interaction cues when reducing particle counts, blur, or idle motion. [Pocket technical FAQ](https://support.pokemon.com/hc/en-us/articles/30332689777428-Pok%C3%A9mon-TCG-Pocket-Technical-Troubleshooting-FAQ).

## Acceptance and limitations

- Validate narrow phones, common portrait phones, short landscape, both iPad orientations, and desktop with populated boards and long district names/rules.
- Verify keyboard/focus and touch alternatives, detail dismissal, hand browsing, blocked targets, and every card in crowded lanes.
- Check that transient messages and animations do not alter layout; the timer and primary action remain visible.
- Use reduced-motion and low-cost-effect modes without dropping gameplay information.
- Compare frame cost and interaction latency separately from appearance; a prettier capture does not prove performance.

No exact competitor pixel dimensions, complete gesture specifications, screen-reader support, or reduced-motion support were established. The App Store listings' absent accessibility declarations are not proof that an app lacks those capabilities. Publisher imagery may differ from a currently running client. Exact sizing and interaction behavior must be validated in Squabblemon, where the three-district and unbounded-card constraints differ from all three references.
