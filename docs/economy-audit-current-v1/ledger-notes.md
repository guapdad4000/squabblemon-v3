# Current earn/spend ledger notes

Source-only review at revision `5f86e9608f28e48f22879cf5fc5aa61ee1c7b654`.
No live accounts, database, provider, workflow or app were accessed. `ledger.json`
contains stable symbol anchors to the files inspected. Mode-specific settlement
and payment boundaries are separate audit work; the shared match payout row is
not an assertion that online/draft/challenge/tutorial all pay identically.

## Important modeling corrections

- First collection currently unions **24 owned cards**, although the saved mentor
  crew contains ten. `data.ts:538–539` and `grantFirstCollection` are authoritative.
- All three early Collection Road thresholds (7/9/12) are immediately eligible.
  They grant Closet Nerd, Live Streamer and Techbro Rich, 50 universal shards and
  150 Clout, subject to duplicate compensation if ownership has changed.
- Current exported story content has **29 chapters, 209 nodes, 101 battles,
  14,450 authored account XP, 750 authored Clout and 118 authored tickets**.
  The 101 possible first-perfect tickets bring the finite maximum to **219**.
  The first eight chapter closings still grant ten tickets; a global major-node
  constant of two does not rewrite those authored rewards. Do not model 123.
- Reaching (not clearing) Chapter 5 separately enables the permanent
  `starter-mythic:nothing-to-lose:v1` claim: Homeless Guy, 1,000 Clout and three
  tickets; an owned card converts to 25 universal shards.
- Seven consecutive check-ins: 1,000 Clout, two tickets and 25 universal shards.
  Seven shop freebies add 350 Clout. Seven daily mission pairs add 1,750.
  Weekly mastery claims add 300 Clout and five-completion weekly mission adds
  two tickets. Seven valid waterings add 350 Clout, one ticket and 25 shards.
  **Total recurring seven-day non-match boundary: 3,750 Clout, five tickets,
  50 universal shards**, assuming every qualification and explicit claim.
  Garden progress uses existing login/mission evidence, not extra battles.
- First-login plus time-limited new-player claims separately add 350 Clout and
  four tickets. Welcome progression adds 250 Clout, one ticket, 100 XP and five
  Rep; Rookie Road adds another ticket. A free welcome pull is just Dr. Fade
  (normally five universal shards after onboarding), not another ordinary pack.
- Level milestones at 10,20,... each add 250 Clout, one ticket and 50 shards.
  These follow total account XP including authored story XP and are not present
  in the simple seven-day subtotal. Claim batches all pending level milestones.
- Missing a login day resets the reward streak, but garden waterings accumulate
  permanently across missed days. Both must be modeled independently.
- Stockz expected net is zero, not a reliable income source. Model at most five
  starts per UTC date, 10/25/50/100 Clout stakes, and independent 50% double-or-zero
  gross payout after eight seconds. The same wallet stores all Clout.
- `KYLE` and `CITYLEGENDS` are not development-gated. Never mix their combined
  60,000 Clout/25 tickets into organic acquisition pacing.
- Tier shards are six restricted currencies plus universal shards. Summing
  them into a universal affordability number is incorrect. Legacy receipts
  without `shardRarity` stay universal; no historical balance reconstruction.

## Reproducing the authored catalog

The checked-in `ledger.json` includes the **full per-node catalog** at
`generatedEvidence.storyPerNode`: every node including empty-reward nodes,
exact authored amounts, original indexes, stable keys, prerequisites,
optionality, completion eligibility and independent first-perfect rewards.
`generatedEvidence.sourceManifest` records SHA-256 hashes for all engine
TypeScript/JSON source plus referenced API/schema files and the extractor.
The broad engine manifest covers imported chapter transformations as well as
the top-level story file. It is a source snapshot, not deployment evidence.

```sh
# JSON to stdout; no server/database imports:
node --import tsx scripts/src/economy-current-ledger.ts
# Update generated evidence and explicit economic taxonomy, then review:
node --import tsx scripts/src/economy-current-ledger.ts --write-ledger
node --import tsx scripts/src/economy-current-ledger.ts --check
node --import tsx --test scripts/src/economy-current-ledger.test.ts
```

Focused isolated diagnostics passed **7/7**: classification completeness and
fail-closed handling of unknown earn/spend tracks; recorded extraction/hash parity;
UTC login reset, missed-day and cycle behavior; seven-day new-player boundary
and once-only milestone batching; garden expired-mission/one-water rules and
gap preservation; exact Stockz two-point net EV; proportional near-cap training
and matching-first cosmetic spending. Tests call pure shared rules, not
transaction functions. Stockz additionally checks source random-sign and payout
expressions; this is not an RNG statistical test or real-account settlement.
No database, provider, network or managed-workflow access is involved.

All balance/earn/spend paths, mission/promo/road catalogs and individual story
rewards carry `economicClassification` with a short reason. The taxonomy is
gameplay, cosmetic, identity/rank, convenience, mixed/gameplay-reachable and
dormant. Account XP is mixed because level milestones issue Clout/tickets.
Pack pity is mixed because its cosmetic pool changes bonus Clout outcomes.
Rank points/rating (including their counters) are identity/rank and not Clout;
their ledger rows link the separate mode audit's exact settlement. Payment
fulfillment is mixed: the 500/1,500/4,000 bundles credit ordinary gameplay-reachable
Clout, not a cosmetic-only wallet. Base prices, replay/locking and the boundary
report are linked without claiming present live configuration.
Spend rows explicitly list per-card XP/tier caps, permanent ownership limits,
daily Stockz starts and capacity limits; ordinary packs/tickets have no authored
daily purchase cap beyond balance and distinct valid requests.

The following read-only command imports only the shared story module, not the
API/database, and emits every authored reward including node prerequisites,
optionality and exact stable claim identity. It provides independent inspection;
the canonical extractor above adds computed totals, eligibility and hashes.

```sh
node --import tsx --input-type=module <<'JS'
import { storyContent } from './lib/squabblemon-engine/src/story.ts';
console.log(JSON.stringify(storyContent.chapters.map(chapter => ({
  id: chapter.id,
  nodes: chapter.nodes.map(node => ({
    id: node.id, kind: node.kind, optional: node.optional,
    prerequisites: node.prerequisites,
    rewards: node.rewards.map((reward, index) => ({
      ...reward,
      rewardKey: reward.claimKey ??
        `${node.id}:${index}:${reward.kind}:${reward.id}`,
    })),
  })),
})), null, 2));
JS
```

The totals were computed from this current exported graph, not copied from
historical documentation. Ordinary verified battle payouts, level milestones
and the Chapter 5 mythic claim are additional, not included in authored totals.
Courier Table's one-ticket backfill shares its old perfect-clear key with the
current reward node: count it once. The two training-fund Clout keys are stable
authored claims; no separate automatic campaign-load training-fund grant was
located. Puzzle skipping grants the same authored reward as solving.

## Transaction and completeness boundaries

Each listed account mutation uses the common player-profile row lock or direct
`FOR UPDATE`, with the receipt and wallet change inside the same transaction.
This is source evidence of intended serialization, not a new concurrency test.
Unique claim keys, onboarding flags, ownership sets and mission `claimedAt`
prevent repeated issuance according to each path's listed identity. Pack
idempotency returns the original opening regardless of changed retry parameters;
shop, Stockz and story actions additionally compare request identity.

Mail gifts are operator-authored data, not a static source catalog. No current
production campaign amounts are inferred; each valid gift field may range from
zero to one million. Claims are locked and `claimedAt`-guarded, and delivery
rejects a reused campaign ID with different content. Existing real inboxes could
contain additional finite grants; inspecting them was outside scope.

Schema defaults are zero wallet/XP/Rep, four deck slots, empty ownership and pity
zero. Bootstrap restores card ownership from immutable pack receipts and preserves
unknown/newer cards across rollbacks; it also unions the mentor for established
starter/tutorial accounts. This recovery is not another currency grant.
Development story reset deletes story receipts without debiting the wallet; it
grants nothing immediately but permits re-earning after replay in development.
It must not be treated as an organic production source.

The economic effect of payments, mode reward authority and offline/guest routes
must be integrated from the other audit sections. Nothing here authorizes
rebalancing, changing past claims, retiring balances, activating checkout or
running operator actions.