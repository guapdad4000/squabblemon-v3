# Underrepresented-card creative pass

This pass changes nine cards. The roster has 202 cards, and 110 are absent from the 22 prepared balance decks. That is **not** a measure of live player usage: candidates were chosen for narrow timing, expensive setups, or conditional effects, not an observed pick-rate ranking. Existing card IDs, upgrades, and the six-round Motion economy remain unchanged.

| Card | Change |
| --- | --- |
| Inmate Kingpin | **1 Motion / 3 Hands**, as requested (previously 4/4). Run the Yard's once-per-Kingpin, three-distinct-carrier Contraband rules are unchanged. |
| YN ATV Lord | **3 Motion / 4 Hands** (previously 4/4). A successful two-character ride now protects the passenger **and** gives it +1 Hand. A blocked ride awards neither. |
| Dr. Umah | **3 Motion / 3 Hands** (previously 4/3). Completing the two-different-element Group Project grants Dr. Umah +1 Hand if still active, in addition to its existing contributor rewards. |
| Laundromat Regular | Spin Cycle's one saved successful move now cleanses the ally and grants it +1 Hand. |
| DMV Worker | Posting a queue ticket also grants the worker +1 Hand; the ticket still delays at most one qualifying enemy entrance. |
| Dance Circle Captain | The next different follower of a dancer's move gains Protection alongside its existing +2 Hands, once per round. |
| Ahki | The remembered ally gains Protection on its first later return, alongside its existing +1 Hand; departure and return rewards remain once each. |
| Chess Regular | A completed Fork gives Chess +1 Hand only if at least one marked enemy actually loses Hands, including a lethal hit; blocked hits do not qualify. |
| Rent-a-Cop | A warning that actually damages an enemy grants the cop +1 Hand if still active, including on a lethal hit. A blocked warning does not pay; the warning is still one-use. |

Printed card text and runtime handlers agree. The original 25-card pass and earlier roster reports are historical and have not been retroactively rewritten.

## Verification and limits

- Focused rules cover both player seats, blocked and lethal damage, movement and successful payoffs, one-use warning consumption, JSON round-trips, and the exact printed budgets. The full web-game test suite and workspace typecheck were run for this pass.
- An exploratory paired bot sample compared the previous code at HEAD with this pass: five hand-built ten-card archetypes against Fire and control decks, two district seeds, both seats, tiers 0 and 3, for **16 games per archetype per version**. Kingpin's cellblock shell scored 2.5/16 before and 4/16 after. ATV appeared in 6 plays before and 12 after the cheaper cost, while its Earth shell scored 9/16 before and 8/16 after. The water, air, and service shells had unchanged scores in this tiny sample. These numbers are a smoke check, **not** evidence of live pick rates or statistically reliable matchup gains; the bot and custom deck construction limit their interpretation.