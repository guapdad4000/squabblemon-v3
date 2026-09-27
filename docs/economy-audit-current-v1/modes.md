# Current mode rewards and progression — source audit

Scope: source at `5f86e9608f28e48f22879cf5fc5aa61ee1c7b654`; no live accounts,
database queries, provider calls, or runtime changes. Numbers below are rules,
not observed player behavior. Companion machine-readable data: `modes.json`.
All source paths below are repository-relative; line ranges identify evidence.

## Persisted completion matrix

W/D/L order throughout. “Standard” means 80/60/40 Clout, 50/35/25 account XP,
8/4/2 Rep, zero tickets; participating owned cards receive 30/25/20 card XP.
Historical `block-economy-v1` snapshots instead pay 40/30/20 Clout; other
standard amounts are unchanged. A missing/unrecognized economy version falls
back to legacy, not current. Source: `lib/squabblemon-engine/src/economy.ts:7-29,53-71`.

| Mode / event | Persisted result | Important boundary |
| --- | --- | --- |
| Guided tutorial | No match currency, account XP, Rep, tickets, or card XP | Marks tutorial/onboarding progress. Welcome is a separate claim, not tutorial payout. |
| Saved practice/open training | Standard | New verified completion; replay of same receipt grants nothing twice. |
| Pressure/control/movement/support/freeze/cheap activities | Standard | Same practice settlement, not special jackpot paths. |
| Fair/neighborhood/draft/boss activities | Standard | Base move tiers during match. Draft borrowed/unowned cards receive no card XP; owned played cards can. Badges/career progress are separate from wallet payout. |
| Story first win | Standard plus authored first-clear rewards and eligible first perfect ticket | Authored `street-xp` is additional account XP, not Rep or card XP. |
| Story replay / loss / draw | Standard for each newly verified match | No repeated first-clear grant. A later first three-star result can still issue the one-time ticket. |
| Challenge Arcade win / loss | Standard | Win advances encounter; loss settles run. No chain purse/entry debit in these paths. |
| Challenge Arcade draw | All match rewards zero, no card XP or battle mission/career advance | Run remains active on same encounter; binding cleared for retry. |
| Friendly online human match | No wallet, account XP, card XP, Rep, tickets, or rank award | Room/command state only. “Guest seat” here is an authenticated second player, not anonymous guest play. |
| Ranked online human match | Rank points/rating/statistics only | No standard earnings, card XP, missions or wallet credit. |
| Ranked online bot match | Rank points/rating/statistics only, reduced rank deltas | No bot account settlement; human only. |
| Guest/offline play | No persisted account rewards | Local presentation cannot create a completion without authenticated server-issued match. |

Evidence:

- `artifacts/api-server/src/routes/player.ts:648-720,805-891,941-1032`: authenticated
  owner lookup, current/legacy reward selection, zero tutorial rewards, story
  transaction and first-clear/perfect behavior.
- `artifacts/api-server/src/lib/playerRewardTransactions.ts:210-397`: profile lock,
  owned participation filter, conditional incomplete-row update, standard
  earnings, mission/career progress, challenge draw suppression and run transition.
- `lib/squabblemon-engine/src/activities.ts:4-16` and
  `artifacts/api-server/src/routes/player.ts:419-425,568-575`: activity selection,
  validated weekly draft and normalization.
- `artifacts/api-server/src/lib/storyTransactions.ts:182-230,308-338`: stable
  claims with conflict suppression, authored account XP and perfect ticket.
- `artifacts/api-server/src/lib/onlineMatches.ts:42-77,251-279,301-319`: owned
  deck/onboarding validation, persisted commands/room, ranked-only settlement;
  the only ranked profile update writes `storyProgress.fadePark` and `updatedAt`.
- `artifacts/squabblemon/src/components/PlayLoop.tsx:266-276` gates completion on
  non-guest mode plus server match ID; player route independently requires auth.

## Completion, quits, clocks and retries

The reward endpoint replays the stored roster/encounter and submitted legal
transcript rather than accepting a claimed outcome. It rejects unfinished
transcripts (`lib/squabblemon-engine/src/gameEngine.ts:3954-3986`).
Consequently exiting/abandoning a solo match is not a reward-bearing loss.
Solo timer actions must still form a legal completed transcript; a browser clock
does not mint a forfeit receipt. Abandoning an Arcade run updates run status,
not the wallet (`artifacts/api-server/src/routes/challenge.ts:125-140`).
Arcade admission allows two entries per UTC date and freezes the crew at entry
(`challenge.ts:37-82`). There is no additional wallet grant at run settlement.

Online is different: active surrender completes with the other seat winning;
surrender while waiting closes without a winner. A server deadline timeout
completes with the other seat winning. Ranked settlement does not distinguish
these reasons from a played-out win/loss and has no minimum-turn requirement.
Friendly rematches require both votes, increment game number and swap opening
seat; still no economy award. Ranked rematches are refused: requeue instead.
Sources: `lib/squabblemon-engine/src/multiplayer.ts:131-156,160-185,188-246`.
Turn duration is 75 seconds (`multiplayer.ts:37`). Bot catch-up executes legal
turns before timeout evaluation, avoiding wins merely because a serverless bot
slept; `artifacts/api-server/src/lib/onlineMatches.ts:321-348`.

Rank settlement holds room/profile locks, orders profile locks by user ID, and
stores a settlement marker; reads/retries cannot repeatedly award the same room
(`onlineMatches.ts:301-319,343-348`). Solo reward transactions persist the
receipt only once and return stored amounts on retry. New completed matches
remain repeatable; idempotency is not a per-day earnings cap.

## XP, normalization and paid-progression exposure

Account level is `1 + floor(max(0, XP)/250)`, uncapped. Card level thresholds
are `[0,100,300,600,1000,1500,2100,2800,3600,4500]` for levels 1–10.
Card XP is capped at 4,500. A continuously participating card needs 150 wins,
180 draws or 225 losses to cap from zero; 176.47 matches at 50% W/10% D/40% L
is a rate-based expectation, not a guaranteed stopping time. Account XP and
card XP are separate fields and are never interchangeable.

Account levels have an economic consequence: every tenth level (10, 20, ...)
creates a separately claimable 250-Clout, 1-ticket, 50-universal-shard reward,
keyed `level:<milestone>`. The first occurs at 2,250 account XP; subsequent
milestones are 2,500 XP apart. There is no authored terminal milestone in the
loop. It is not an automatic per-match wallet credit; the account claim path
holds the profile lock and records receipts. Sources:
`lib/squabblemon-engine/src/accountRewards.ts:23-27,128-136`;
`artifacts/api-server/src/lib/accountRewards.ts:16-40,67-120`.
Account level is also displayed in profile/header and online identity, not used
as card level (`artifacts/squabblemon/src/components/profile/ProfileOverview.tsx:38-72`;
`artifacts/api-server/src/lib/onlineMatches.ts:42-77`).

Street Rep is accumulated by welcome and verified solo rewards, serialized in
bootstrap and copied to online identity; it is not rank points/rating.
`playerRewardTransactions.ts:138,372`, `playerState.ts:234`,
`lib/squabblemon-engine/src/multiplayer.ts:425-426` and
`artifacts/squabblemon/src/components/venue/CityHeader.tsx:24` trace those uses.
Source search across API, engine and browser found no Rep debit, purchase price,
or Rep-threshold access gate. Online admission instead checks onboarding and
owned-deck validity. This is a bounded source finding, not a promise about
future Rep utility. No additional account-level admission gate was found in
these mode paths; move gates are **card** levels 2/5/8.

Participation uses distinct player-owned `play` events, surviving destruction;
cards left in hand do not qualify. Standard settlement additionally filters
current ownership; XP application intersects participation with the issued
snapshot roster and adds to current persisted XP (not stale issued XP), clipping
at cap. Source: `artifacts/api-server/src/lib/cardProgression.ts:212-247` and
`playerRewardTransactions.ts:228-230`.

Snapshots capture roster, balance/economy version and move upgrades. Invalid
progression, unknown/duplicate/mismatched roster and forged upgrade sets are
rejected (`cardProgression.ts:78-209`). Unfinished incompatible balance snapshots
are rejected for restart, not reinterpreted or forfeited; completed receipts
skip that balance check (`routes/player.ts:702-715`).

Normalization floors finite XP, clamps to cap, recomputes level and bounds move
tier by level eligibility. New entries have zero active tiers; legacy entries
missing `moveTier` inherit level-eligible tiers. Thresholds are levels 2/5/8.
XP awards preserve existing move tier, so reaching a level alone does not buy a
new tier. Source: `lib/squabblemon-engine/src/cardProgression.ts:12-34`;
`artifacts/api-server/src/lib/cardProgression.ts:235-237`.

Training costs 100 Clout/100 XP or 225/250 XP, prorated at cap. Coaching costs
100/250/500 Clout with level prerequisites 2/5/8. This buys PvE acceleration,
not cosmetic-only progression (`lib/squabblemon-engine/src/economy.ts:34-41,84-101`).
Fair/neighborhood/draft/boss discard progression for battle snapshots but still
earn real owned-card XP afterward. Online members carry deck IDs/cards and
display account level, not owned card progression (`onlineMatches.ts:42-77`).
Online match creation passes no progression or upgrade snapshot
(`multiplayer.ts:160-173`); engine defaults create base-level snapshots
(`gameEngine.ts:289-310`; `abilityUpgrades.ts:35-51`).
Thus purchased card training/coaching does not carry into current online move
tiers. Purchased card **ownership** can still expand legal online crew choices;
normalizing upgrades is not proof that all paid progression has no competitive
effect. Bot display level 3/10 is not a trained-card snapshot
(`onlineMatches.ts:383-391`).

## Ranked rules (not wallet income)

Human W/D/L points: +25/+5/−15. Bot: +12/+2/−6, floor zero. Rating uses
`expected = 1/(1+10^((opponentRating-rating)/400))`, actual 1/.5/0, rounded
delta with K=32 human/K=12 bot and rating floor 100. Match-start rival rating
is captured; settlement uses current player stats. Bot rival rating is the
player's queued rating. Wins/losses/draws/games update; only wins extend streak;
bot wins also increment `botWins`; best points is monotonic.
Tier floors: Rookie 0, Bronze 100, Silver 300, Gold 600, Platinum 1000,
Diamond 1500, Park Royalty 2200. Bots enter after 12 seconds, stale queue
heartbeat after 30 seconds. No bot rank cap is present.
Source: `lib/squabblemon-engine/src/ranked.ts:1-37`;
`artifacts/api-server/src/lib/onlineMatches.ts:303-318,360-391`.
`rankedStats` stamps the current season but retains supplied numeric counts;
it does not implement a season-reset migration.

## Findings and recommendations

| ID | Severity / confidence | Evidence and player impact | Recommendation |
| --- | --- | --- | --- |
| MODE-01 | Medium / high | Online completion writes rank state only (`onlineMatches.ts:301-319`), while saved solo pays XP/Clout. Modeling every “fade” with shared earnings overstates income for online-focused players. | Segment all pacing by actual settlement mode; disclose online rewards explicitly. Do not invent online wallet payouts in this audit. |
| MODE-02 | Medium / high | Rank points award on immediate active surrender/timeout and repeated bot matches; no turn threshold or bot ceiling (`multiplayer.ts:131-156,202-215`; `ranked.ts:26-36`). This permits rank progression without the same competitive evidence as full human games. No actual abuse is observed. | Product decision on surrender eligibility, repeated-opponent controls and bot rank ceilings; measure reasons/opponent types before tuning. |
| MODE-03 | Medium / high | Paid Clout can buy card XP/coaching, whereas online upgrades are normalized. Owned roster selection is not normalized (`economy.ts:84-121`; `onlineMatches.ts:42-77`). | Do not label the entire economy cosmetic-only or infer pay-to-win magnitude. Separate cosmetics, PvE acceleration and roster access in the parent monetization audit. |
| MODE-04 | Low / high | “Equal footing” activity copy says “No ranked ladder yet” (`activities.ts:12`) despite implemented Fade Park settlement. | Correct obsolete explanatory copy in a separate scoped change. |

Validation: `node --import tsx --test scripts/src/economy-current-modes.test.ts`
passed **7/7**, zero skips. The suite uses pure engine rules and synthetic
members, not accounts: account/card thresholds and caps, account milestone
eligibility and receipt suppression, legacy economy/progression, explicit
untrained progression, actual online base snapshots, immediate surrender and
timeout, ranked-rematch denial and 184 consecutive bot wins reaching 2,208 RP.
That bot sequence is an illustrative rule exercise, not an observed cohort or
an estimate of time/win rate. The seventh test is explicitly a **source
assertion**, checking the online profile-write boundary; it does not prove
database persistence, locking or webhook behavior. JSON parses and cited full
source paths exist. No UI was changed, app run, live data accessed or database
test run. Other existing tests are not represented as rerun.