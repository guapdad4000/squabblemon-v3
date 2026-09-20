# KYLE — Legendary / Smile Bombs

## Card and assets
- KYLE: Fire, 4 Motion, 4 Hands, Legendary. Available through the existing Legendary card pool.
- Original supplied character and bomb PNGs are preserved in art-sources/characters. Both already contain transparency.
- Runtime assets: characters/kyle.webp (768x1024), characters/smile-bomb.webp (384x384), each with a content revision in characterRevisions.json.
- Three ordinary self-power upgrades, at the existing unlock levels. Upgrades do not increase bomb count or damage.

## Agreed ability
On Reveal, plant four Smile Bombs independently in random opponent-side districts. At the start of the next round (after both online players end their turns), each bomb consumes its fuse and hits one random enemy in that district for -1 Hand. Damage follows existing protection, mitigation, and uncounterable rules. An actual destruction awards +2 persistent Hands to the exact KYLE instance that planted it. Hits cannot target bombs. Empty lanes consume the bomb without damage; bombs still explode if their KYLE has left, but there is no surviving KYLE to buff. There is no seventh round, so bombs planted in round six cannot explode.

Bombs are visible non-scoring hazards, not members of the opponent's crew. They do not receive normal crew buffs, district bonuses, movement, or ordinary ability targeting. Their fuse payload lives in the authoritative board and survives JSON persistence and full replay frames. Seeded selection has no browser or wall-clock RNG.

## Presentation
- Bombs show their explosion round (R4, etc.), with accessible text and inspection.
- Crowded online phone lanes fit formations into the available space.
- The hand grid is explicitly constrained so a selected card's long effect description cannot push controls off-screen.
- Card inspection displays the whole ability instead of truncating its kill bonus.

## Verification
- 12 KYLE gameplay tests, including both seats, four independent hits, four kills = +8 Hands, shields, freeze, removed source, multiple KYLEs, all district scoring, save/reload, and round-six behavior.
- 7 existing multiplayer engine tests.
- 9 summon render/replay regressions for KYLE, Ashlee, and Captain Jigga.
- Desktop and phone browser previews: transparent art, Legendary styling, four fuses, explosion removal, no page errors, and bomb inspection at 390px and 320px.
- Two-account browser verification can include KYLE by starting the isolated localhost test host and verifier with ONLINE_E2E_KYLE=1. The test checks authoritative board/score agreement through six rounds, reconnects, retries, results, and rematch.

KYLE tests are part of the production build gate.

## Published
Production: https://squabble.today
Deploy: 6aaf56474750170a4571d03f
28 production release tests passed. The full two-account KYLE browser battle passed through all 12 turns, network-failure recovery, results, and rematch. Live KYLE, Smile Bomb, and Church Auntie bytes match local assets and retain transparency; live entry/client, healthz, and anonymous multiplayer-access checks passed.
