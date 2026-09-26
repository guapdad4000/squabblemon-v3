# Next 25-card review after the buff batch

Reviewed against the implementation in [the 25-card buff notes](CARD_BUFFS_25.md), including the updated card registry and the [1,536-game batch comparison](../scripts/results/buff25/README.md). These 25 are different from the 25 cards just changed.

**Six cards warrant targeted testing, eight remain on watch, eleven should be held. No additional gameplay changes are applied here.** This is a design and interaction review, not individual live win-rate evidence. The existing batch simulations do not isolate each of these cards. Suggested experiments below are not final balance specifications.

| Card | Printed Motion / Hands | Decision | Reason | Next check or experiment |
| --- | --- | --- | --- | --- |
| Failed Rapper | 2 / 1 | Test next | 2/1 invests in a later +2 deployment. Mural has a larger body with a different-element condition; costs and recipient conditions need a controlled comparison. | Try allowing a movement arrival to collect the Verse, retaining one payout and excluding the Rapper himself. |
| Dance Circle Captain | 3 / 3 | Test next | Requires two different members of a three-card dancer group to move to the same district in one round. The new Busker helps the deck but does not relax this bottleneck. | Test any different ally following the first dancer, with the existing once-per-round +2 cap and no automatic movement. |
| Ahki | 2 / 2 | Test next | Gives +1 immediately, but the extra +2 requires departure and return. Nail Tech offers a stronger body, immediate +2, and mitigation for the same cost; elements/training still differ. | Measure return completion first. If rare, add a bounded benefit on the first departure instead of raising the eventual return reward. |
| Chess Regular | 3 / 3 | Test next | No Fork unless enemies already occupy two districts. An early deployment can be entirely blank. | Test storing the first visible mark until a second enemy district becomes available, preserving expiry and one actual fork. |
| BBL Demon | 4 / 4 | Test next | At 4/4, the opponent controls the delayed +2 or -2 result and can avoid any placement before expiry. Other four-cost attackers offer immediate larger swings. | Test a longer visible Drama window before adding damage or paying both branches. |
| Rent-a-Cop | 2 / 2 | Test next | A single -2 warning only matters if an enemy moves through the district. It has no payoff in stationary matchups, though movement denial has value. | Compare against movement and stationary opponents separately; test a deployment-based warning condition if non-movement dead draws dominate. |
| Hooper | 5 / 5 | Watch | The 5-cost challenge has delayed value, but already settles in the final round and rewards a fleeing target. | Track survival and challenge resolution before increasing either reward. |
| Block Party Titan | 6 / 7 | Watch | Pulling two allies concentrates power and can abandon other districts. His 6/7 body and movement synergies make a raw buff risky. | Test rally outcomes by districts won, not only total Hands. |
| Regular guy named LeBron James | 4 / 4 | Watch | Cleanse, a ward, and 3 revenge damage are real value. Chair now profits from blocked hits too, improving his supporting shell. | Retest him alongside Chair and Church before adding more protection rewards. |
| YN Gokarter | 2 / 2 | Watch | A third distinct district needs another movement enabler; completing the lap already gives +3 at two cost. | Measure route completion alongside Bboy and the improved Busker. |
| OG Skater | 3 / 3 | Watch | The following deployment needs a legal route and space. It can reposition an ally after its entrance, which simple Hands accounting misses. | Measure useful route arrivals and failures due to capacity. |
| Divorced Dad | 3 / 3 | Watch | The forced later return can disrupt a good position, but the initial relocation and protection are meaningful. | Test return timing and blocked-return clarity before granting more Hands. |
| Redneck Evil | 5 / 5 | Watch | 5-cost Burn plus splash needs enemies to survive and a second target. Fire has powerful existing payoffs, so its comparison deck matters. | Compare in a coherent Burn list; retain a single splash and avoid increasing Fire across the board. |
| Ice Cream Truck | 3 / 2 | Watch | Three districts can yield three +2 treats, but the Truck needs outside movement support and later arrivals. | Measure treat redemption with movement support before changing the ceiling. |
| DMV Worker | 2 / 2 | Hold | A two-cost delayed entrance can disrupt a critical turn. Its value is timing, not direct Hands. | Keep one ticket and the no-repeat-delay rule. |
| Techbro Rich | 4 / 5 | Hold | A 4/5 body can advance two Motion, with explicit repayment. Final-round debt timing already gives him a distinct use. | Do not remove the debt without measuring the resulting resource acceleration. |
| Break | 2 / 2 | Hold | A two-cost move plus a pre-entrance Weaken trap is already a strong utility package. | Preserve the one-use floor mark. |
| Bboy | 2 / 2 | Hold | Two movement hops and up to +2 on a two-cost body activate multiple allied movement effects. | Avoid adding more rewards while Busker and movement support are being improved. |
| BBL Nice | 3 / 2 | Hold | Shares up to two Hands per round across a chosen pair, including round-end growth. Several new buffs create more opportunities for sharing. | Retest new combinations before increasing its shared-gain cap. |
| Mural Apprentice | 2 / 2 | Hold | A 2/2 grants +2 to the next different-element arrival. Straightforward setup with a reasonable body and payoff. | Keep one paint marker per district. |
| Honest Thot | 1 / 2 | Hold | A one-cost 1/2 body prepares +2 for an Air arrival. The cost already rewards a simple route plan. | No automatic Air buff based on policy-sensitive deck scores. |
| Incel | 2 / 3 | Hold | A 2/3 can reach seven Hands over two solitary round ends. Isolation is a meaningful constraint. | Keep the two-payment cap. |
| Electrician Foreman | 4 / 4 | Hold | Two workers can receive +3 each and refund one Motion, on top of the 4/4 Foreman. Jobs already recruit through play or movement. | Electric was flat in this batch comparison; no evidence for raising the completed reward. |
| Performative Male | 3 / 3 | Hold | A normal ally buff, heal, or cleanse can fulfill the promise for +2 to the target and +1 to its source. Improved support cards help activation. | Test support pairings instead of restoring hand-bond growth. |
| The Flight Plug | 3 / 3 | Hold | One successful Air move grants +2 and protection on top of a 3/3 source. Movement support is readily available. | Preserve the one-use pass and assess route choices rather than adding a blanket stat increase. |

The next implementation shortlist should come from matched one-card substitutions and actual trigger/completion rates in coherent decks. Do not automatically turn the watch and hold groups into buffs to meet a count of 50.
