# Block Party roster and Blockbusters — first playable rules

The current catalog has 298 collectibles, including 10 Blockbusters. This section documents the Block Party fighters and the latest blockbuster balance pass. Character artwork uses transparent cutouts; Blockbuster posters retain their illustrated backgrounds. Artwork provenance is in `artifacts/squabblemon/reference/blockbuster-artwork.json`.

Confirmed names: Ahki, Dr. Umah, ATL Scammer. The poster titled “The Block Spin” supplies the repeat-damage event.

Blockbusters occupy a normal slot in a ten-card deck. They cost Motion, resolve in the chosen lane, then leave the board. They add no scoring body, do not count as character arrivals, and cannot use SQUABBLE. The temporary name remains **Blockbuster**. Collection, packs, deck validation, progression, card inspection, solo and human PvP use the same catalog and engine.

| Event | Motion | Current effect |
| --- | ---: | --- |
| The Shootout | 3 | On Reveal: Hit every enemy here for 3 Hands; your strongest character here takes 1 damage. |
| The Block Spin | 3 | On Reveal: Repeat every Hands reduction already dealt here this round three more times on surviving characters still here. Repeated damage cannot repeat itself. |
| The Sideshow | 2 | On Reveal: Move all characters from both sides out of this district into other legal districts. Each friendly character successfully moved gains +2 Hands. Locked cards stay. |
| The Concert | 2 | On Reveal: Choose: give allies here +3 Hands and enemies +1; or hit enemies here for 3 and allies for 1. |
| The Setup | 1 | On Reveal: Sacrifice your weakest character here. Give your strongest other character here its current Hands plus 4 and Protection. Requires two allies. |
| The Dice Game | 0 | On Reveal: Wager 1–3 Motion (both sides must afford it). Each side rolls three D6; add the highest two. Winner takes the pot, up to 9 Motion, and gives their weakest local character +3 Hands. Ties refund both wagers. |
| The After Party | 2 | On Reveal: Extend this fight to 7 rounds and give every friendly character +2 Hands. Additional After Parties grant neither extension nor buffs. |
| The Kickback | 2 | On Reveal: Move all characters on both sides into this district. Each friendly character successfully moved gains +2 Hands. Locked cards and blocked destinations stay. |
| The Cookout | 3 | On Reveal: Serve three Soul Food cards in occupied friendly districts; each cleanses your weakest character there and grants +2 Hands. Leave one Burnt Plate: at this round end it gives a random friendly character there 1 Burn, then clears. |
| The Baby Shower | 2 | On Reveal: Give every friendly character here +3 Hands, then draw up to two cards from your remaining deck. |

Dice Game wagers only this fight’s Motion. No cash or account currency is wagered.

Random outcomes are deterministic for authoritative replay and are not shown in play previews. Dice results are public only after the committed action. Online views include only the resolved rolls and round limit, not hidden hands. The existing optional `investment` transport field carries a card-specific numeric choice: Homeless Guy 0–4 extra Motion; Dice Game 1–3 wager (omitted/zero means 1); Concert 0 boost or 1 reduction (no additional cost). Bounds are validated by the shared engine.

Verification covers both owners, catalog/artwork integrity, blocked hits, damage replay boundaries, movement locks, sacrifices, repeated Burn, wagers, seven-round reward transcript verification, PvP public state, and phone/desktop controls. Browser fixture: `/e2e/blockbusters.fixture.html`, with `card`, optional `mode=online`, and optional `seat=cpu` query parameters.
