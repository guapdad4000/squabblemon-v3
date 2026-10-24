# Monthly login cards

The monthly login track is an extra free gameplay-card track beside the unchanged seven-day check-in currencies. There is no purchase requirement. The existing authenticated account claim endpoint collects eligible monthly milestones with the daily reward and other earned account bonuses; viewing the calendar never claims anything.

The server uses UTC calendar months. Distinct saved `login:YYYY-MM-DD` receipts in the current month determine progress. Missed days keep that month's progress; the next UTC month starts at zero. Up to 30 check-ins count, so a 31st check-in still pays the existing weekly reward without creating another monthly card. February ends the track on its 28th or 29th check-in so the final reward is reachable. Existing check-ins in the current month count at rollout, and already-earned, unclaimed card milestones can be collected even after today's weekly reward.

| Check-in | Gameplay card tier |
| --- | --- |
| 1 | Super Common |
| 5 | Common |
| 10 | Uncommon |
| 15 | Rare |
| 20 | Super Rare (`Epic`) |
| 25 | Legendary |
| 30 (28/29 in February) | Mythical |

Each milestone selects within its exact eligible Street Pack tier using `isStreetPackCard`, preserving Story-only and Kumite-exclusive exclusions. An unowned card is preferred whenever one exists in that tier. An exhausted tier uses the existing matching Style Shard duplicate payout; Super Common uses Common shards. No rarity promotion, paid gate, cosmetic substitute, or additional currency schedule is introduced. Every tier must have an eligible authored gameplay card; the regression checks this against the real catalog.

All decisions happen under the existing player-profile row lock. The immutable receipt key is `account:monthly-login:YYYY-MM:Rarity`. The selected catalog ID, name, rarity, new/duplicate result, matching shard currency and amount are written with the inventory/balance update in one transaction. A failure rolls back all receipts and balances. Concurrent claims and bootstrap normalization cannot double-pay or erase cards. Client dates, card IDs, rarity and counts have no authority.

The account GET response adds `monthly` with server month, distinct claimed count, required count, next reset, and all seven milestones. Each collected milestone includes its original saved `reward`, so a lost claim response can recover the exact identity without rerolling. A retry returns no new grants. Daily's empty-retry presentation reads only saved monthly rewards dated to that receipt day; it never repeats a grant or recruitment celebration. The compact roadmap is shared by Daily arrival and Growth Lab. Existing weekly streak/reset behavior, three daily garden tasks, watering cadence, seven-plant harvests and Buddy recruitment remain intact.

Focused coverage lives in `artifacts/api-server/src/lib/accountRewards.test.ts`, `artifacts/squabblemon/src/components/MonthlyLoginTrack.test.tsx`, and the `verify-monthly-login.mjs` / `verify-monthly-daily-arrival.mjs` browser checks. The existing Growth Lab and Daily arrival regressions remain applicable. All browser tests use controlled local responses; database tests exercise real transactions against an owned test database.
