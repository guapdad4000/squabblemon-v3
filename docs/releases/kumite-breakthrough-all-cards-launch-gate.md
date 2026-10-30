# Breakthrough: Anunaki integration coverage, launch still closed

User decision, October 29, 2026: no public launch until every collectible card is playable and usable. A restricted-card public beta is not the release policy.

## Current implementation

| Card kind | Canonical total | Concrete adapters | Missing adapters |
| --- | ---: | ---: | ---: |
| Characters | 288 | 278 | 10 |
| Supports | 13 | 13 | 0 |
| Blockbusters | 10 | 10 | 0 |
| Total | 311 | 301 | 10 |

The Anunaki integration adds ten canonical characters to the original 301-card catalog. All 301 existing reviewed adapters remain intact. Anu, Enki, Enlil, Inanna, Ninhursag, Utu, Ereshkigal, Nabu, Yakub and Caucus Mountaineer have no reviewed real-time Breakthrough conversions yet. Their turn-based abilities, tablet rules, media and base-game multiplayer compatibility do not establish Breakthrough parity.

Compatibility reports all 311 canonical cards, while the playable Breakthrough roster contains the 301 reviewed cards. Owned Anunaki cards fail deck admission with an explicit unsupported-card reason; simulation construction rejects those decks, and injecting one into a hand cannot spend Motion or deploy a generic fallback. The original 15 starter decks retain their existing compatibility. Public launch remains closed until the new conversions and the complete acceptance evidence are ready.

All 15 canonical starter recipes pass the combined ownership, captain and compatibility validator and complete local CPU simulations. Saved custom decks use the same canonical resolver. No name matching or generic no-op fallback supplies missing abilities. Intentionally unplayable archive bosses remain separate. Generated fighters/resources cannot enter saved decks, packs, tampered hands or the normal collectible rotation.

The 256 previously missing adapters are implemented across Supports, Network, Fitness, Music, Community, Blockbusters, House, Neighborhood, Summons, Reactions, Contracts, Factions, Control and Specials. Stats, immutable IDs, gameplay family membership and equipped art come from the final canonical catalog.

## Mechanical contracts now implemented

- Paid deployments materialize immediately, including consecutive same-lane plays. Abilities, media playback and friendly spacing never queue the player's input. Frozen or movement-locked allies do not stop the entire friendly lane.
- Supports and blockbusters are real actions: authored targets and choices, atomic costs, no marching/scoring/breaches. Homeless Guy investment, Concert effect and Dice wagers require an explicit choice in the renderer and room command protocol.
- Round references use deterministic global 10-second beats. Through-next-round contracts end on the second following beat; final-round effects mean irreversible Last Stand. After Party extends the clock once without restarting draws.
- Hostile packets resolve against the actual recipient after bodyguard redirection, personal Protection, Side Eye, immunity, staff movement wards and Janitor defenses. Damage/status/move follow-ups stay in that same packet. Execution limits are rechecked on an interceptor.
- Delayed entrance abilities do not delay paid deployment. Canceled/queued outcomes reach Music observers correctly. Lawyer defers a complete status batch; delayed statuses get their authored duration when they begin. Future Burn respects its start time. Burn ticks retain source provenance even after that source leaves.
- Genuine refunds are distinct from natural refill, borrowed Motion and income. Shared caps survive returns and copying. Gain/heal and damage observers receive exact source metadata, including summoned attackers.
- Runtime summons have explicit owner/source/scoring/fighting/recycling flags and canonical art. Mushrooms remain consumable lane resources, not combat blockers or timeout Hands. Guyana blocks hostile abilities but can take physical damage; Blue immutable Hands remain distinct.
- Scammer copies a live Ongoing kit without firing its entrance or changing printed identity, traits or element. Entrance echoes and Coach retries do not become paid placements or rearm persistent contracts. A true return preserves instance identity but clears copied kits for the next printed entrance.
- Mary's disappearance preserves signed investment/damage and suspended statuses; Elephant form retains its art, base Hands and cost on later live returns. Recruited Snow changes combat ownership only and returns/recycles to its original owner. Rabbit/Cheshire observe the true hand recipient.
- Public room projections expose visible forms, copied ability keys and resource/lock flags while hiding opponent hands, queues, RNG, module ledgers and held-source identity. Choice values participate in retry identity and durable replay.

## Verification and evidence

Current candidate: `breakthrough-v9-full-catalog`, branch `codex/kumite-breakthrough-integration`, based on fetched main `77f44c8b597a908202d5f65b8ecc293e4b47f5d6`. The dirty original audition checkout is preserved. No commit, push or deployment is implied.

The historical 301-card candidate evidence is under `output/kumite-breakthrough-full-catalog-20261029/`. It predates the ten-card Anunaki addition and is not full-catalog evidence for this 311-card integration:

- `release-build.json`: required source tests, production bundle, Story delivery, JavaScript and CSS budgets; exact tracked/untracked source fingerprints.
- `catalog-coverage.json`: all 301 IDs, kinds, costs, Hands, concrete ability keys, triggers, descriptions and all 15 starter validations.
- `reducer-performance.json`: deterministic CPU matches, dense 40/80-fighter stress tests, before/after lookup measurements, full-state outcome equality, workload and process-memory limits.
- `media.json`: all 54 approved mode media files remain byte-identical; 16,348,370 bytes, with no new raster assets in this card implementation pass.
- `browser-proof.json`: observed local browser geometry and choice/deployment behavior; browser evidence is not physical-device or live-network evidence.

Every reviewed Breakthrough card also runs through legal immediate deployment, invalid-input purity, Last Stand and JSON checkpoint continuation in `breakthroughFullCatalog.test.ts`. The ten unsupported Anunaki cards have separate fail-closed admission and input-purity regressions in `breakthroughCatalog.test.ts`; those rejection checks are not gameplay parity proof. Authored module and real-reducer integration tests prove additional targeting, timing, interactions, caps, summons, copying, forms and ownership cases. Breadth smoke checks alone do not certify every eight-part acceptance checklist.

## What still unlocks launch

`BREAKTHROUGH_PUBLIC_LAUNCH_APPROVED` stays false and `BREAKTHROUGH_FULL_CATALOG_EVIDENCE` stays null. Ten Anunaki conversions and full release acceptance remain outstanding. The ledger requires activation, targeting/choices, rejected input, interactions, lifecycle, Last Stand, replay and presentation evidence for exactly the current catalog, bound to the current rules and all 17 behavior-module hashes. Even hypothetical complete proof and approval cannot bypass the ten missing concrete adapters.

The hub CTA remains hidden. Both public mode URLs redirect to Kumite; default room creation and service admission reject before a store read. Internal simulation constructors and DEV fixtures remain explicitly named and isolated. Loaners, query parameters, local storage and account roles do not bypass release admission.

Before promotion: real-device touch/drag and crowded-match presentation acceptance; authenticated two-client transport/reconnect/latency and durable store/lease proof; authoritative separate trophy/roadmap receipts and anti-farming rules; staged deployment revision/readiness evidence. The room domain and its test store are not a hosted PvP service. Local CPU results grant no account progression. Normal-PvP rank extensions remain a separate economy task.
