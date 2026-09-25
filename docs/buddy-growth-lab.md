# Buddy’s Growth Lab

The Safehouse plant stand opens a curved camera view and Buddy’s paper invitation. Entering opens the garden clipboard. The former floating daily check-in badge is replaced by this room destination.

## Daily loop

- Collect the existing daily check-in (including any first-login, new-player, or level bonuses).
- Finish one verified fade and win one verified fade, using the existing daily mission progress. These tasks still keep their separate bounty rewards.
- Each task fills one third of the watering can. A full can automatically waters all three rows and grows one plant, at most once per UTC date.
- Every seven plants pays 350 Clout, one pack ticket, and 25 Style Shards. The next watering starts another garden. Earned plants and harvests survive missed days; login streak rules remain unchanged.

`POST /api/player/rewards/account/growth/water` checks login receipts and unexpired mission progress under the same player lock as other rewards. Daily plant receipts and numbered harvest receipts use the existing immutable account claim ledger; no migration is required. Repeated requests cannot grant another plant or harvest. Cosmetic animation begins only after confirmation and respects reduced motion. Closing or navigating during animation does not undo the saved reward.

## Art

The supplied Buddy greeting is the paper invitation; Buddy with his clipboard is the clipboard hero. The supplied watering-can cutout frames a live water fill. The plant sheet is clipped in SVG coordinates so plants fan out behind the paper without covering tasks. WebP files are optimized versions of the supplied transparent PNGs in `public/assets/buddy-growth/`.

## Verification

- `pnpm --filter @workspace/api-server test` uses the guarded, isolated database runner. The account reward tests cover task eligibility, expired daily progress, concurrency, retries, two complete gardens, and missed days.
- With the local preview running, `pnpm --filter @workspace/squabblemon test:growth-lab` checks desktop, phone, small phone, landscape, reduced motion, claim/fill/pour/grow, rewards, reloads, dialog focus, and failed watering retries. Set `GROWTH_ORIGIN` and `CHROMIUM_EXECUTABLE` for another preview or browser install.
- The `e2e/growth-lab.fixture.*` files are deterministic browser fixtures, not the live reward backend.
