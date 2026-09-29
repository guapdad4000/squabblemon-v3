# Homies API contract

All endpoints are authenticated, under `/api`, with private/no-store responses. Errors are `{error:string}`. Public player objects contain ONLY `{friendCode:string,username:string,displayName:string,avatarKey:string,lastActiveAt:string|null}`. Friend codes remain stable random 12-character uppercase hexadecimal service identifiers; they are not shown or entered in Fadebook. Previously shared code-based links remain compatible. Contract codegen has completed; generated functions/hooks are ready.

Usernames are unique, lowercase, 3–24 ASCII letters/digits/underscores, with reserved system names rejected. Input is trimmed, accepts a leading `@`, and normalizes case. Existing accounts receive a readable handle lazily in bounded batches; changing either public name does not change their relationships or opaque link target. `lastActiveAt` is recorded profile activity, **not** live presence or an availability guarantee.

DTOs:
- `SocialPlayer`: the five fields above; `lastActiveAt` is an ISO timestamp or null.
- `SocialRequest`: `{id:string,player:SocialPlayer,createdAt:string}` (ISO timestamp).
- `SocialInvitation`: `{id:string,roomCode:string,direction:'incoming'|'outgoing',player:SocialPlayer,status:'pending'|'accepted'|'declined'|'cancelled'|'expired'|'unavailable'|'closed',expiresAt:string}`.
- `SocialState`: `{self:SocialPlayer,homies:SocialPlayer[],incomingRequests:SocialRequest[],outgoingRequests:SocialRequest[],blocked:SocialPlayer[],invitations:SocialInvitation[],counts:{requests:number,invitations:number}}`. Counts include only incoming pending entries. Invitations includes recent terminal receipts.
- `SocialLookup`: `{player:SocialPlayer,relationship:'none'|'incoming'|'outgoing'|'homie'|'blocked'|'self',requestId:string|null}`. The request ID identifies a pending incoming/outgoing request; it is null otherwise.
- `SocialSearchResult`: `{players:SocialLookup[]}`; at most 12 username-prefix matches, with exact matches first, excluding self and blocks in either direction.
- `SocialMatchOpponent`: `{opponent:SocialLookup|null}`; resolves the other recorded human participant, including after completion, surrender, or room closure. Outsiders cannot use the endpoint. Bots, self, blocked players, and missing human opponents return no action.

| Method/path | operationId / generated function | Body | Response |
|---|---|---|---|
| GET /social | getSocialState | — | SocialState |
| GET /social/search?query=… | searchSocialPlayers | — (minimum 3 normalized characters) | SocialSearchResult |
| PATCH /social/username | updateSocialUsername | `{username}` | SocialState |
| GET /social/match-opponent/{code} | getSocialMatchOpponent | — | SocialMatchOpponent |
| GET /social/lookup/{code} | lookupSocialPlayer | — | SocialLookup |
| POST /social/requests | sendHomieRequest | `{friendCode}` | SocialState |
| POST /social/requests/{id}/respond | respondHomieRequest | `{action:'accept'|'decline'|'cancel'}` | SocialState |
| POST /social/homies/{code}/remove | removeHomie | — | SocialState |
| POST /social/blocks | blockSocialPlayer | `{friendCode}` | SocialState |
| POST /social/blocks/{code}/remove | unblockSocialPlayer | — | SocialState |
| POST /social/invitations | sendFadeInvitation | `{friendCode,deckId,requestId}` (UUID requestId) | SocialInvitation |
| POST /social/invitations/{id}/respond | respondFadeInvitation | `{action:'accept'|'decline'|'cancel',deckId?}` | SocialInvitation |
| GET /social/invitations/{id} | getFadeInvitation | — | SocialInvitation |

React Query hook names are `use` + capitalized operationId. Mutation variables follow generated Orval shapes: `{data: body}`, `{id,data:body}`, or `{code}`. All success statuses are 200. Accepting an invitation requires a legal owned deck; navigate to the returned roomCode only when status is accepted. Sending a crossed request returns a conflict; accept the existing incoming request explicitly. Links must never automatically mutate social state.

The navigation label remains **Homies**; the page is **Fadebook**. It uses the supplied transparent gold logo on a light social layout, with Homies / Requests / Find Players sections and no device frame. The Add Homie result control is human-PvP-only and reconciles failed acknowledgements against the server's recorded opponent and relationship.

## Verification commands

- API/native PostgreSQL: `env -u DATABASE_URL LOG_LEVEL=silent pnpm exec node scripts/test-api-database.mjs social`
- Load/native PostgreSQL: `env -u DATABASE_URL LOG_LEVEL=silent pnpm exec node scripts/test-payments-database.mjs --social-load --label optimized --output scripts/results/homies-contention-optimized.json`
- Browser/native PostgreSQL: `env -u DATABASE_URL LOG_LEVEL=silent pnpm exec node scripts/test-payments-database.mjs --social-browser`
- Contracts: `pnpm --filter @workspace/api-spec run codegen`
- Migration coverage: `node scripts/check-netlify-migrations.mjs`

The API and browser social database commands refuse caller-provided URLs and create/clean an owned temporary native PostgreSQL cluster, with five independent pool connections. Browser entrypoint receives `SOCIAL_TEST_OWNED=1`, `CAMPAIGN_DATABASE_TESTS=1`, and only the owned database URL. No managed workflows or external databases are touched.

The load mode also refuses **every** caller-provided `DATABASE_URL` (including loopback, empty, and whitespace values). It creates a separate owned native cluster, uses a pool of up to 50 independent PostgreSQL connections (one reserved for observation), and runs 25/100/250 simulated accounts. It reports scheduled-request latency, connection-pool queuing, observed PostgreSQL lock waiters, and sampled waiting-query ages. These local measurements compare contention; they are not a production capacity guarantee. See [the contention report](homies-contention.md) for workload details, results, and limitations. No production load testing is authorized by this command.

Migration `lib/db/migrations/20261002_social.sql` and identical native artifact `netlify/database/migrations/202610020001_social/migration.sql` are finalized. Only prerequisites are existing `player_profiles(clerk_user_id)`, `online_rooms(id)`, and PostgreSQL's existing `gen_random_uuid()` function (already used by online_rooms). The idempotent migration adds `online_rooms.invite_only` and backfills that reservation marker for rooms referenced by existing invitations. No profile/economy/inbox data is updated; codes are allocated lazily. The finalized migration was applied to development; production was not changed. Native deployment continues through the existing migration path.

## Bounds and concurrency

Lookup is limited to 30/minute; social mutation attempts to 40/minute per account in durable SQL (failed attempts count). Repeat requests/invitations have a 60-second pair cooldown. Maximums: 100 homies, 30 combined pending requests, 100 own blocks, 10 pending invitations per account, five open hosted rooms. State lists are bounded; pending invites sort first with recent terminal receipts filling a 40-entry list. Invitations expire after ten minutes.

Social transactions and **unclaimed** room access use one transaction-level PostgreSQL advisory lock before room/profile locks. This conservative global social lock still serializes pair/account mutations, durable throttles, limits, and pending-seat eligibility consistently across serverless instances.

Already-joined room reads, commands, and rejoin retries bypass that social lock, but still take the room row lock and run the same authorization, reservation, revision, and idempotency checks. An unlocked joined-seat hint only chooses the lock path: both seats are rechecked under the room lock. If that hint becomes stale, the transaction ends and retries social-lock-first; it never takes the social lock while holding a room lock. Existing members retain reconnect/rematch access after remove/block, while unclaimed targeted rooms become unavailable.

Menu state batches public player identities instead of querying every contact separately. Terminal invitation receipts are read with their room codes without locking each old room; they cannot change status again. Pending and accepted receipts still refresh under room locks. All response shapes, visible ordering, list bounds, identity privacy, limits, and invitation lifecycles remain unchanged.

Targeted rooms also carry a durable private `invite_only` marker independent of invitation row deletion. A missing invitation never converts a targeted room into a share-code room. Nonmembers receive 404; an orphan waiting room closes when its host accesses it. Joined members retain access even if the invitation receipt is removed. Deleting a profile with an already joined room keeps the existing room-FK cascade behavior (the room itself is deleted).