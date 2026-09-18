# FX + Sprite Handoff

## New character art wired into the current prototype

The build at `current-playtest/` uses local transparent art for 20 roster members and automatically falls back to the legacy sprite URL for characters whose new production sprite has not been generated yet.

### Local character set

Rastamon, Officer Oink, Snitch, Techbro Rich, Bikelife YN, Boss Babe, Ganger Blue, Ganger Red, Wifey, Cracked Head, Live Streamer, Gamer, Gamer Unemployed, Plug, Scammer, All Jokes Roaster, Closet Nerd, Hooper, Baby Momma, Snow Bunny.

The authoritative path mapping is `current-playtest/assets/character-sprite-map.json`.

## Battle FX source set

- **Impact / attack:** boxing gloves, impact burst, slash arc, explosion
- **Heal / sustain:** coffee cup, steam, heal burst
- **Scam / disruption:** credit card, receipts, card flick, fraud / hack burst
- **Poison / status:** bottles, liquid splashes, toxic droplets, shatter / spill sequences
- **Clout / economy:** money stack, bills, coins, camera flash / money explosion
- **Report / silence / reveal:** clipboard, paper slap, report stamp, document swirl
- **Generic status:** buff up, debuff down, Protect, Freeze, Burn, Poison, Stun, Sleep, Speed Up, Cleanse
- **Move:** dust kick-up, slash arc, explosion, splash, ring ripple, impact star

The complete visual reference sheet is `assets/transparent/NEW_ASSETS_ADDED/squabblemon_battle_fx_asset_sheet.png`.

## Animated orbs

- the Yellow Liquid Orb GIF in `assets/transparent/`: Hype / flow / liquid-energy state, wired into the Hype HUD.
- the Flame Orb GIF in `assets/transparent/`: danger / escalation / SQUABBLE state, wired into the SQUABBLE control.

## Transparent master art

The complete processed asset library is under `assets/transparent/`. White and near-white edge-connected backgrounds were removed while preserving white clothing and highlights wherever possible.

## Recommended next production pass

Generate the remaining 16 roster characters in the locked unified art style, then replace their remote fallback URLs with local transparent files. After that, split the Battle FX sheet into individual frame sequences / atlases and trigger them from effect IDs in `game.js`.
