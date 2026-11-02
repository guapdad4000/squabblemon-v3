# Named matchmaking rivals

Kumite Breakthrough remains PvP. The hub enters the shared queue; old `/practice` links redirect to PvP. There is no public rival picker or CPU-practice entry. Local practice components remain only for existing engine/UI fixtures. The pre-existing full-catalog public launch gate remains closed: this patch does not claim launch approval or live deployment.

Ten stable Kumite rivals reuse reviewed starter crews, portrait assets and rush/counter/support policies. Existing waiting-lobby requests check for a human first, then fill after six seconds under the same matchmaking/cancel lock. No fake player profiles, extra timers, bot sockets or AI services. Public names/avatars travel with the existing private room view; deck contents and account IDs do not. The authoritative owner evaluates at most one rival intent per second, using the same command sequencing, journal, lease fencing and replay as players. Existing trophy eligibility and per-opponent/daily caps still apply to stable rival IDs.

Fade Park grows from four to fourteen named opponents. Display names omit `Park Bot`; internal automation flags, reduced RP and human-only Clout protections remain. Automated opponents are described in queue help and as AI in ladder metadata, separate from display names.

The regular PvP ladder adds fourteen bounded entries. New rivals start with zero games/points; actual settlements update one row per persona per season. The existing room lock and transaction make human rank, rival rank and room receipt atomic. No account creation, history scans, heartbeat writes or background bot-vs-bot matches. `PARK_RIVALS_IN_STANDINGS` is the temporary participation switch.

## Deployment order

Apply `202611020003_park-rival-standings` before the API build. The matching local SQL is `lib/db/migrations/20261102_park_rival_standings.sql`. The table is server-owned with RLS enabled. Public Kumite additionally requires its already-documented release acceptance and persistent room host; no gate was bypassed.

## Local verification

- `node scripts/test-breakthrough-database.mjs --browser`: owned native PostgreSQL, authenticated test-principal HTTP/SSE, human matches at five viewport sizes, automatic rival pairing, server moves, reconnection, cancellation and result receipt. This does not establish production Clerk/session or deployed-host behavior.
- `node scripts/test-park-rivals-database.mjs`: fresh owned PostgreSQL, actual schema migration, concurrent settlement/retry, rollback, all fourteen roster identities and private mixed standings.
- Required frozen-source release gate plus frontend/API TypeScript checks.
