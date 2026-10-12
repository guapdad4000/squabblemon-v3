# Controlled reliability patch experiment

Each full screen uses eight affected recipes from the existing 46-deck plan, six fixed opponents, tiers 0–3, both owner seats, and greedy/seeded legal policies. Exact recipes live in ../card-audit-deck-tier-list-20261012/plan.json.

The first draw set uses seed reliability-fresh-oct12-73 and rotation 7. Independent confirmation uses reliability-independent-oct12-109 and rotation 13. Logical-side action counters pair policy random choices across variants; action counts can diverge after changed decisions.

Individual variants only simulate recipes containing their changed card: Auntie 96, promise 192, Merch 96, Nerd 384. Full baseline and combined runs each contain 768 matches. Confirmation shards partition the same case list, not four repetitions.

Reported score = wins + half draws, divided by matches. Results are diagnostic bot samples. Tier/seat variants share recipes and draws; they are not independent human observations. Do not treat the percentages as live PvP win rates, statistically precise population estimates, or a refreshed full-league ranking.

The baseline-source directory preserves the edited card/rule files before this turn. The temporary variant helper restores only those saved files between isolated runs. No committed or unrelated gameplay changes are reverted. Candidate source plus the scoped diff will be saved alongside final results.

The first broad regression run found three missing pre-existing patch banners in the temporary public-assets overlay (two assertions failed). The actual tracked HEAD assets were restored to that validation overlay; no placeholder files or relaxed assertions were used. Final regressions run after this repair.

Final review moved the saved-plate trigger from successful reveal resolution to actual placement/summon arrival, plus the existing movement hook. This covers canceled and self-moving entrances. The original final-candidate results are retained in pre-arrival-fix; corrected candidates are freshly simulated in the top-level buffs JSON files. Game engine baseline was captured before adding that arrival hook.
