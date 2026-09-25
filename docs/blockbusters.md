# Block Party roster and Blockbusters — first playable rules

The catalog has 202 collectible cards: 182 characters, 10 existing supports, and 10 Blockbusters. This release adds 18 characters and replaces the existing Live Streamer portrait. Supplied character backdrops are preserved. Artwork provenance is in `artifacts/squabblemon/reference/blockbuster-artwork.json`.

Confirmed names: Ahki, Dr. Umah, ATL Scammer. The poster titled “The Block Spin” supplies the repeat-damage event.

Blockbusters occupy a normal slot in a ten-card deck. They cost Motion, resolve in the chosen lane, then leave the board. They add no scoring body, do not count as character arrivals, and cannot use SQUABBLE. The temporary name remains **Blockbuster**. Collection, packs, deck validation, progression, card inspection, solo and human PvP use the same catalog and engine.

| Event | First playable effect |
| --- | --- |
| Shootout | Up to five distinct random characters in its lane lose 1 Hand, including allies. |
| Block Spin | Repeat previous Hands reductions in this lane this round twice, on the same surviving characters still here. Its repeated hits are excluded from the ledger. Temporary buff expiration does not count. |
| Sideshow | Send both crews out to the other open lanes, preferring each crew's weakest lane. Movement locks still apply. |
| Concert | Choose +1 or −1 Hands for everyone in the chosen lane. |
| Setup | Sacrifice the weakest friendly character here and transfer its current Hands to the strongest other friendly character here. Needs two allies. |
| Dice Game | Both sides wager the chosen 1–3 Motion. Each rolls three D6; sum the best two. Winner receives the pot, capped at 9 Motion; ties refund wagers. Both must be able to afford the wager. |
| After Party | Set the match length to seven rounds. Cannot stack. |
| Kickback | Bring both crews into the chosen lane, respecting movement/lane locks. |
| Cookout | Summon two normal Soul Food cards into random friendly lanes (cleanse and +1 Hand to the weakest friendly character there). Summon one persistent Burnt Plate in another seeded random friendly lane. Each round it gives a random friendly character there 1 Burn before Burn resolves. |
| Baby Shower | Friendly characters here gain +1 Hand; draw one card if the deck has any left. |

Shootout's five targets, Concert's two modes, Dice Game's best-two scoring, and Baby Shower's effect are initial design choices for playtesting. Character stats and abilities are likewise an initial balance pass. No cash or account currency is wagered; Dice Game spends only this fight's Motion.

Random outcomes are deterministic for authoritative replay and are not shown in play previews. Dice results are public only after the committed action. Online views include only the resolved rolls and round limit, not hidden hands. The existing optional `investment` transport field carries a card-specific numeric choice: Homeless Guy 0–4 extra Motion; Dice Game 1–3 wager (omitted/zero means 1); Concert 0 boost or 1 reduction (no additional cost). Bounds are validated by the shared engine.

Verification covers both owners, catalog/artwork integrity, blocked hits, damage replay boundaries, movement locks, sacrifices, repeated Burn, wagers, seven-round reward transcript verification, PvP public state, and phone/desktop controls. Browser fixture: `/e2e/blockbusters.fixture.html`, with `card`, optional `mode=online`, and optional `seat=cpu` query parameters.
