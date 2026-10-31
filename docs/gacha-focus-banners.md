# Featured banners and permanent Street Pack

Recruit preserves the existing live punching-bag gym, illustrated fight posters, character art, ticket controls and three-hit saved-reward reveal. Inmates, Oz, Wonderland, Red & Blue and Anunaki share one featured-fighter rule. The permanent Street Pack retains its general-pool rarity rules. Prices remain one ticket or 200 Clout per pack, with a full ten costing ten tickets or 1,800 Clout. Every pack contains five gameplay results and one independent cosmetic/resource bonus.

## Featured slot and guarantees

`FEATURED_PACK_RULES` in the shared engine owns the 10% base chance, slot five, limit ten and rule version two. Normal gameplay slots keep the existing rarity weights and first-two-slot same-rarity new-card protection. On a featured banner, its selected roster is excluded from every normal slot and the slot-five normal fallback. Slot five checks a 10% featured chance and selects equally among the listed fighters, independent of rarity and ownership. A natural featured hit can duplicate and converts to matching-rarity Style Shards under existing duplicate rules.

Nine consecutive featured misses force the next pack's fifth slot to be featured. That guaranteed selection prioritizes unowned featured fighters when available. Any natural or guaranteed featured hit resets this family's miss counter. A full ten-pull still guarantees Rare-or-better gameplay, and its replacement uses the last eligible normal slot, preserving every featured result and its receipt. Singles and batches advance the same featured and cosmetic state. The theoretical long-run featured rate, including the forced tenth pack, is approximately 15.35%; 10% is the published base chance. Individual fighter rates are base rates, before the ownership-aware guarantee.

`player_profiles.featured_pack_progress` stores `{ misses, packs }` under each permanent banner family ID. This progress starts at zero for the new rule, carries across monthly or weekly occurrences and does not transfer between families. The existing `pack_pity` column remains independent cosmetic pity. Every saved opening has immutable optional `featured_progress` metadata, including before/after counters, cumulative pack count and exact featured reward indices. Historical v1 receipts remain readable; new featured receipts use a `banner-<family>-v2` suffix. Monthly pull milestones retain their existing rules and count all paid pack families.

## Exclusivity and calendar

The ten Anunaki gameplay cards remain outside ordinary Street Packs and normal cosmetic variant rolls. Seven fighters are exclusive to the Anunaki banner. Yakub, Caucus Mountaineer and Anu remain campaign-roadmap rewards. Existing other themes retain their Street Pack availability, while being excluded from normal slots during their own featured banner so its base featured chance stays exactly 10%.

Weekly themes keep their original Monday UTC anchor and occurrence IDs. Anunaki's initial authored window is fourteen days. After launch, it returns for seven days from the first Monday at 00:00 UTC each calendar month. A monthly occurrence overlapping an authored window is omitted. Calendar IDs use the exact first-day date, and historical occurrences can be reconstructed for receipt recovery. Never edit a deployed window or change existing banner IDs/rotation order. Future authored windows may be appended without invalidating earlier monthly identities.

**Release hold:** the current October 29–November 12, 2026 launch dates are a draft from the earlier local build. Set and verify the actual fourteen-day window before the first authorized deployment. The push remains on hold. After deployment those dates must remain immutable.

The selected poster displays 10%, remaining packs to a featured guarantee, saved progress, the selected banner's end date or next return and full Rates/History access. Anunaki remains browseable while closed, with purchasing disabled. Rates disclose the complete roster, individual base chance, normal rarity rules, duplicate conversion and separate cosmetic pity. Saved history displays the original featured receipt rather than today's family counter.

## Transaction and recovery contract

Authenticated pack opening locks the player's profile. Inside one transaction it validates the exact active occurrence, debits payment, generates rewards, updates inventory and both guarantee systems, writes the opening receipt and grants monthly milestones. Insufficient balance, inactive occurrence or a rejected mutation advances nothing. Concurrent openings serialize through that same lock. An identical retry returns its original receipt even after expiry; reusing the key for a different payment method, count, banner or occurrence returns 409 without another charge. Request journals retain the original purchase intent across refreshes.

Both Drizzle development and native Netlify migration artifacts add the profile and receipt columns. Bootstrap contracts and generated client/validators include those additive fields. Apply migrations before releasing code that reads them.

## Full-deck beta code

`DEVANUNAKI` grants all ten playable characters once per account, with no currency, upgrades or generated summons. It preserves existing upgrades, wallet balances, cosmetic pity and every featured family's progress. It works on a production beta only when the server environment has `ANUNAKI_BETA_CODE_ENABLED=true`. Default is disabled; the switch can retire new claims independently of `NODE_ENV`. Existing saved redemption receipts remain recoverable when disabled. Redemption uses the profile lock and permanent `promo:DEVANUNAKI` claim key.

## Economy follow-up

The 30-pack chosen-fighter reward remains a documented follow-up; no exchange threshold or extra grant has been silently installed. A seeded 1,000-account Anunaki simulation using the authored generator found mean first fighter 6.53 packs (maximum ten), mean selected Nabu 32.73 packs, mean complete seven-fighter roster 65.16 packs (90th percentile 84). Thirty packs yielded 3.63 distinct fighters on average. These are simulation results with a complete normal collection and exhausted cosmetics, not player outcomes or a guarantee of complete ownership by a fixed pack count. The report is `output/anunaki-batch-review/gacha-economy.json` outside the source checkout. Campaign and raid payouts are budgeted separately and monthly milestones/pack bonuses add to earned purchase power.

## Local verification

- Pure rule checks cover exact 999/1000 threshold boundaries, equal roster selection, empty/full ownership, featured exclusion from normal slots, unowned guaranteed selection, duplicate shards, singles/batches, Rare+ preservation and monthly occurrence recovery.
- `env -u DATABASE_URL PATH=/usr/lib/postgresql/17/bin:$PATH node scripts/test-payments-database.mjs --featured-pulls` starts an owned native PostgreSQL cluster, pushes the current schema and runs the gacha/economy/promo suite. The initial completed run passed 70 tests with zero skips, including independent backend lock waits, concurrent retries, expiry recovery and beta-code retirement.
- `UI_ORIGIN=http://127.0.0.1:5196 node artifacts/squabblemon/e2e/verify-weekly-banners.mjs` verifies the actual Shop with controlled local responses; this is browser presentation/transport evidence rather than production transactions.
- Before/after screenshots for all six posters and Rates dialogs at 390×844 and 1440×1000 are under `output/anunaki-batch-review/{before,after}` outside this checkout. Browser counter states are deliberately supplied fixture data, not a real account.

Broader release verification is coordinated after the full expansion source freezes. No commit, push, deployment or production-account transaction was performed by this work.
