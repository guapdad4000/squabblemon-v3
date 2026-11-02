# Kumite Breakthrough PvP launch preparation

Implementation update: the ten Anunaki adapters and efficient room owner, delta protocol and PostgreSQL journal adapter are now implemented locally. See [current implementation and evidence boundaries](kumite-breakthrough-anunaki-efficient-rooms.md). The baseline counts and proposed work below are historical; hosted public PvP remains closed.

Audited November 2, 2026. Baseline: `ddf77549cd1323d1ab5b30e6a220e5ef8a8d26ad`.

**Live PvP is not ready to open.** The shipped mode is explicit, reward-free CPU practice. This preparation adds a repeatable source preflight and repairs practice → edit deck → return. It does not approve public PvP or change the weekly tournament rules.

This is the current launch worklist. Earlier integration documents describe historical implementation slices; use the current catalog and source preflight instead of their old 45/301 counts or closed-CPU-entry statements. The subsequent CPU-practice release intentionally opened only the explicit practice path.

## Verified baseline

| Area | Evidence on November 2 |
| --- | --- |
| Production revision | Netlify current/ready deploy `6ae662dce4156c7a37bf076d`, commit `ddf77549cd1323d1ab5b30e6a220e5ef8a8d26ad` |
| Read-only production probes | `/api/healthz` and `/api/readyz`: HTTP 200, `status: ok`; `/api/deploymentz`: matching deploy ID, production context, live Clerk environment |
| Catalog | 311 collectible cards; 301 concrete Breakthrough adapters; ten Anunaki conversions missing |
| Catalog acceptance | Full-catalog evidence is null; public launch approval is false |
| Playable route | `/game/kumite/breakthrough/practice`; local CPU state and no account rewards |
| Room foundation | Shared authoritative reducer, private projections, command retry identity, CAS fencing and journal/outbox interfaces, tested with an in-memory store |
| Hosted Breakthrough PvP | No durable store, server transport, matchmaking, lifecycle controller or terminal reward consumer |

Hosting and API health establish the deployed baseline. They do not establish a signed-in match, result transaction, device experience or Breakthrough multiplayer service.

## Repeatable preflight

From the repository root:

```sh
pnpm run verify:kumite-pvp
node scripts/kumite-pvp-preflight.mjs --json --output .cache/kumite-pvp-readiness.json
node scripts/kumite-pvp-preflight.mjs --require-ready
```

The default command is an audit: a blocked launch is a valid report, so it exits zero. `--require-ready` fails while launch requirements remain unmet. The report loads the actual canonical catalog and release evaluator, records source fingerprints, names unsupported cards and separates card readiness from unverified hosted requirements. It performs no network, account or database writes. Its regression tests run in the ordinary local/Netlify release gate.

The preflight is not an acceptance-evidence issuer. Editing a checklist or flipping the public flag cannot produce hosted proof. The service requirements must gain implementation and appropriate verification before the preflight can recognize them as satisfied.

## Work in dependency order

### 1. Complete the current catalog

Implement Anu, Enki, Enlil, Inanna, Ninhursag, Utu, Ereshkigal, Nabu, Yakub and Caucus Mountaineer as concrete real-time conversions. Preserve canonical IDs, costs, Hands, rarity and art. The [Anunaki conversion plan](kumite-breakthrough-anunaki-conversion-plan.md) identifies tablet, consumption, summon and radiation contracts and the decisions still requiring review.

For each current card, bind activation, targeting/choice, rejected-input purity, interaction, lifecycle, Last Stand, deterministic replay and presentation evidence to the current catalog/rule fingerprints. Adding adapters or passing a generic deployment smoke test cannot fill that ledger. New cards or changed rules invalidate stale evidence. Preserve the existing all-card release policy; do not open a restricted pool as a shortcut.

### 2. Build the private durable room service

Start with `lib/squabblemon-engine/src/breakthroughRoom.ts` and its `BreakthroughRoomStore` contract. Add a dedicated database schema and paired development/Netlify migrations, then implement atomic creation, canonical deck snapshots, lease acquisition/renewal, monotonic owner fences, checkpoint CAS, unique journal entries and the terminal outbox. Retention must preserve required retry and settlement receipts.

Prove independent-connection races, stale/expired owner rejection, rollback, process restart, uncertain commits and exactly one terminal outbox item using disposable native PostgreSQL. An in-memory test store is useful domain evidence and cannot establish those properties.

Select a host capable of the required room clock and connection lifecycle after measuring the tick workload. The current Netlify `kumite-tick` function reconciles the weekly turn-based bracket every 15 minutes; it is not a real-time match worker. Do not assume that a long-running browser or serverless request owns a room safely.

### 3. Add authenticated transport and human matchmaking

Define a typed Breakthrough API before implementing routes. Document authentication, participant authorization, deck ownership/captain checks, version mismatch, bounded request size, retry identity and recovery for each mutation. Pair two humans atomically; cancellation must not leave an account in both queue and room. Reuse existing authentication and account validation, then keep Breakthrough room state and results distinct.

Specify ready/start, disconnect grace and reconnect, surrender, leave and rematch behavior. The current domain intent supports deploy and reinforcement cancellation; it does not supply those lifecycle policies. Persist clock origin and recover missed ticks without trusting client time. Terminal settlement must win any race with a late command.

Do not reuse Fade Park matchmaking wholesale: its existing queue may insert a Park Bot and its settlement changes Fade Park progression. Existing weekly Kumite rooms use turn-based commands, deadlines and receipts.

### 4. Connect the player flow to the server

Add the distinct PvP lobby, queue and `/game/kumite/breakthrough/matches/:code` route. The current Arena constructs a local `GameState`, CPU opponent and local input clock. A PvP renderer needs seat-relative private server projections, including legal target/choice and dynamic-cost information. Never send the full private game state to the opponent or let the renderer invent authoritative outcomes.

Retain the current deck picker/editor and route recovery. Track pending intent, sequence, command identity and acknowledged revision across refresh/reconnect. Ensure fast deployment, cancellation and Last Stand remain usable while state catches up. Use actual rival identity and confirmed result/receipt values. Keep active matches registered with the existing Kumite unlock/media gate.

### 5. Settle results and progression

Define a distinct Breakthrough receipt namespace and an idempotent terminal-outbox consumer. Lock trophy rules, draws, disconnect/forfeit eligibility, repeated-opponent farming limits and roadmap mapping before enabling grants. Preserve weekly bracket history, final-win requirements, raid mastery and normal-PvP ranks. An in-memory terminal event or preview trophy art is not a saved reward.

Native tests must prove one settlement across duplicate delivery, two workers, a crash between commit and acknowledgment, and retries from both participants. Practice remains reward-free under the current shipped policy.

### 6. Stage and accept the whole journey

Use two authenticated accounts against the actual service: admission → queue → ready → simultaneous deployments → Last Stand/result → saved receipt → revisit. Include refresh, background/foreground, latency, loss, duplicate requests, disconnect, worker failover and deployment/version mismatch. Confirm opponents cannot read hidden hands, draw queues, RNG, server internals or other accounts' receipts.

Run actual phone touch/drag and crowded-match presentation checks, plus the existing desktop, short-landscape, reduced-motion and keyboard journeys. Record viewport/device, source revision, renderer, cache state, network conditions and artifacts. Browser emulation and local CPU simulations are separate evidence.

Run the required source/build gate and all triggered database/browser tiers from frozen source. Confirm staging's ready revision and API identity match that candidate. Only after these gates pass should the public admission policy and CTA be enabled, followed by production ready-revision checks and the authorized player journey.

## Immediate preparation validation

The preparation's source/build, preflight and browser results belong to the candidate verification record and PR description. They verify the audit tooling and deck-return fix. They do not satisfy the outstanding PvP milestones above.

Existing references: [all-card launch policy](kumite-breakthrough-all-cards-launch-gate.md), [integration target](kumite-breakthrough-production-integration-plan.md), [engineering standards](../../design/engineering-standards.md), [release tier inventory](../../scripts/release-check-inventory.json).
