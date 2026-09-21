# The Wiz, Wonderland, and Around the Block wave

## Release scope

21 collectible characters, 29 supplied illustrations, and 8 alternate art variants.
Gameplay identities are shared by both illustrations; alternate art costs 180 shards.
All new characters use the existing Street Packs acquisition and training systems.

The source of truth for names, rarities, Motion, Hands, and exact ability text is
`lib/squabblemon-engine/src/fairytaleWave.ts`.

| Group | Characters |
| --- | --- |
| The Wiz | Dorothy, Scarecrow, Tin Man, Lion, Oz |
| Wonderland | Alice, Cheshire, Queen of Hearts |
| Around the Block | Sherlock, Watson, Undercova Brotha, The Feds, DMV Worker, P. Tang, Bonnet Girl, Corrupt Pastor, Powerhouse, Revolutionary Ronald, Trap Vamp, Squabble House Worker — Male, Squabble House Worker — Female |

Alternate illustrations: Dorothy, Scarecrow, Tin Man, Lion, Alice, Cheshire,
Sherlock, and Watson. Oz has one illustration. The repeated mention of The Feds
is represented by one character.

## Battle rules

- A returned character keeps its instance identity and used once-per-match counters.
  Its board statuses, buffs, damage debt, and copied ability reset. Returning does
  not consume a normal deck draw.
- Dorothy's discount targets the returned instance, has a minimum of 1 Motion,
  and follows the game's existing non-stacking discount policy.
- Alice returns once and never returns after the final round.
- Cheshire is limited to one return trigger per owner per round and one friendly
  Grin per district.
- Stakeout and Take a Number are visible district marks through the following
  round. A failed or unaffordable deployment does not consume a mark.
- Protection and interception apply to the whole hostile package. P. Tang cannot
  push through a blocked hit. The Queen requires a successful execution to summon.
- Watson restores actual damage only. Donations and confiscation cannot generate
  recovery credit. Retaliation uses the actual recipient after interception.
- Powerhouse banks only actual Motion refunds while in hand, up to 3. Round income
  and deployment discounts do not charge it.
- Reactive damage abilities set their trigger counters before retaliation, bounding
  chains. Oz cannot repeat copying abilities.
- Both human seats, solo replay validation, and the browser share the same engine.

## Artwork provenance

`scripts/fairytale-art-sources.json` maps every asset to the supplied PNG.
`scripts/prepare-fairytale-art.cjs` applies the authorized local cleanup:
border-connected white/checker background removal, audited interior background
regions, transparent padding, and WebP encoding. It does not overwrite originals
or redraw the characters.

## Verification

- 26 focused roster, cost, movement, damage, protection, refund, replay, and
  authoritative multiplayer tests in `fairytaleWave.test.ts`.
- Production build gate includes the new rules alongside existing character,
  multiplayer, elemental leader, and collection regressions.
- `e2e/verify-fairytale-wave.mjs` checks solo and PvP at 1280×900, 390×844,
  320×740, and 844×390, plus all 29 gallery portraits and 8 alternate selections.
- Browser screenshots and generated artwork contact sheets remain local under
  the ignored `screenshots/` directory.
