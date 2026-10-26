import { storeOnlineRoom as stored, restoreOnlineRoom as restore } from './onlineRoomPersistence';
import { bankRankedMatchClout } from './rankedMatchClout';
import { equippedPlayerMat } from '@workspace/squabblemon-engine/playerMats';
import { PARK_BOT_PERSONAS, parkBotPersona, reactParkBot } from '@workspace/squabblemon-engine/parkBots';
import { RANKED_SEASON, rankMilestoneRewards } from '@workspace/squabblemon-engine/ranked';
import { addReaction, ownedReactions, resolveReactionTray, ReactionError } from '@workspace/squabblemon-engine/reactions';
import { progressBountyEvent } from './legendBountyProgress';
import type { BountyTask } from '@workspace/squabblemon-engine/legendBounties';
import { randomBytes, randomInt } from "node:crypto";
import { and, asc, desc, eq, gt, ne, or, sql } from "drizzle-orm";
import {
  db,
  onlineCommandsTable,
  onlineRoomsTable,
  playerProfilesTable,
  playerCollectionClaimsTable,
} from "@workspace/db";
import {
  ROOKIE_CORE_IDS,
  catalogIdsToEngineIds,
  starterRecipes,
  validateSavedDeck,
} from "@workspace/squabblemon-engine/data";
import {
  RANKED_BOT_WAIT_MS, RANKED_QUEUE_IDLE_MS, TURN_SECONDS, awardRank, rankedStats, rankProgress,
  applyOnlineCommand,
  createOnlineRoom,
  expireOnlineRoom,
  retireIncompatibleOnlineRoom,
  ONLINE_RULES_VERSION,
  joinOnlineRoom,
  memberSeat,
  onlineRoomView,
  roomSeries,
  OnlineError,
  type OnlineCommand,
  type OnlineMember,
  type OnlineRoom,
} from "@workspace/squabblemon-engine/multiplayer";

import { chooseCpuPlay } from "@workspace/squabblemon-engine/gameEngine";
import { lockSocial, guardTargetedRoom, syncRoomInvitation } from "./socialRoomGuard";
import { homiesDiagnostics, homiesTransaction } from "./homiesDiagnosticsRuntime";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const commandFingerprint = (command: object) =>
  JSON.stringify(
    Object.entries(command).sort(([a], [b]) => a.localeCompare(b)),
  );

export async function loadMember(
  tx: Tx,
  userId: string,
  deckId: string,
  lock = true,
): Promise<OnlineMember> {
  const query = tx.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId));
  const [profile] = await (lock ? query.for("update") : query);
  if (!profile || profile.onboardingStep !== "complete")
    throw new OnlineError(
      "Finish your first gang lesson before playing online.",
      403,
    );
  const saved = profile.savedDecks.find((deck) => deck.id === deckId);
  const recipe = starterRecipes.find((deck) => deck.id === deckId);
  const cardIds = saved?.cardIds ?? recipe?.catalogCardIds ?? [];
  const hero = saved?.heroCardId ?? recipe?.hero;
  if (!validateSavedDeck(cardIds, profile.ownedCardIds, hero).valid)
    throw new OnlineError(
      "Choose a saved gang of ten unique cards you own.",
      400,
    );
  return {
    userId,
    name: profile.displayName,
    avatarKey: profile.avatarKey,
    level: profile.level,
    streetRep: profile.streetRep,
    rankPoints: rankedStats(profile.storyProgress.fadePark).points,
    ...equippedBanner(profile),
    playerMatId: equippedPlayerMat(profile),
    ready: false,
    deck: {
      id: deckId,
      name: saved?.name ?? recipe!.name,
      hero: hero!,
      cards: catalogIdsToEngineIds(cardIds),
    },
  };
}

export async function createFriendRoom(
  userId: string,
  deckId: string,
  requestId: string,
) {
  const result = await db.transaction(async (tx) => {
    // Serializes create retries and the per-account open-room limit.
    const member = await loadMember(tx, userId, deckId);
    const [existing] = await tx
      .select()
      .from(onlineRoomsTable)
      .where(
        and(
          eq(onlineRoomsTable.hostUserId, userId),
          eq(onlineRoomsTable.createRequestId, requestId),
        ),
      );
    if (existing) {
      if (restore(existing.state).members.player.deck.id !== deckId)
        throw new OnlineError(
          "This request was already used for another gang.",
        );
      return { existingCode: existing.code };
    }
    const now = Date.now();
    const open = await tx
      .select({ state: sql<Record<string, unknown>>`${onlineRoomsTable.state} - 'match'` })
      .from(onlineRoomsTable)
      .where(
        and(
          eq(onlineRoomsTable.hostUserId, userId),
          gt(onlineRoomsTable.expiresAt, new Date(now)),
        ),
      );
    const openCount = open.filter((row) => {
      const room = expireOnlineRoom(restore(row.state), now);
      return room.status === "waiting" || room.status === "active";
    }).length;
    if (openCount >= 5)
      throw new OnlineError(
        "Close an existing room before creating another.",
        429,
      );
    const code = randomBytes(6).toString("hex").toUpperCase();
    const room = createOnlineRoom(
      member,
      randomInt(2) === 0 ? "player" : "cpu",
      now,
    );
    await tx.insert(onlineRoomsTable).values({
      code,
      hostUserId: userId,
      createRequestId: requestId,
      state: stored(room),
      expiresAt: new Date(room.expiresAt),
    });
    return onlineRoomView(room, code, userId, now);
  });
  return 'existingCode' in result ? accessFriendRoom(result.existingCode, userId) : result;
}

export async function listFriendRooms(userId: string) {
  const now = Date.now();
  const rows = await db
    .select({
      // The lobby never reads the replay; skip detoasting/transferring it.
      code: onlineRoomsTable.code, state: sql<Record<string, unknown>>`${onlineRoomsTable.state} - 'match'`,
      updatedAt: onlineRoomsTable.updatedAt, expiresAt: onlineRoomsTable.expiresAt,
    })
    .from(onlineRoomsTable)
    .where(
      and(
        or(
          eq(onlineRoomsTable.hostUserId, userId),
          eq(onlineRoomsTable.guestUserId, userId),
        ),
        gt(onlineRoomsTable.expiresAt, new Date(now)),
      ),
    )
    .orderBy(desc(onlineRoomsTable.updatedAt))
    .limit(20);
  return rows.filter(row => !restore(row.state).ranked && !restore(row.state).kumite).map((row) => {
    const room = expireOnlineRoom(restore(row.state), now);
    const seat = memberSeat(room, userId);
    const series = roomSeries(room);
    return {
      code: row.code,
      status: room.status,
      rival:
        room.members[seat === "player" ? "cpu" : "player"]
          ?.name ?? "Waiting for a friend",
      gameNumber: room.gameNumber,
      // Do not use the transient expiry produced by expireOnlineRoom on this read.
      expiresAt: row.expiresAt.getTime(),
      lastActivityAt: row.updatedAt.getTime(),
      lastPlayedAt: room.lastPlayedAt ?? null,
      // Seat-relative so each player reads their own side of the series.
      series: { you: series[seat], rival: series[seat === "player" ? "cpu" : "player"], draws: series.draws },
    };
  });
}

type Mutation =
  | { kind: "join"; deckId: string }
  | {
      kind: "command";
      expectedRevision: number;
      requestId: string;
      command: OnlineCommand;
    };
export async function accessFriendRoom(
  code: string,
  userId: string,
  mutation?: Mutation,
) {
  return homiesDiagnostics.operation("room_access",
    mutation?.kind === "command" ? "room_command" : mutation?.kind === "join" ? "room_join" : "room_read",
    () => accessFriendRoomOperation(code, userId, mutation));
}

/** Authenticated conditional read. The token hashes every persisted field,
 * including corrections/reactions that do not advance the board revision. */
export async function pollFriendRoom(code: string, userId: string, token?: string) {
  if (token && /^[a-f0-9]{32}$/.test(token)) {
    const [row] = await db.select({ live: onlineRoomsTable.liveState, token: onlineRoomsTable.syncToken })
      .from(onlineRoomsTable).where(eq(onlineRoomsTable.code, code));
    if (row?.live) {
      const room = row.live as unknown as OnlineRoom;
      memberSeat(room, userId);
      const now = Date.now();
      // Only settled paired human battles can skip authoritative advancement.
      // Waiting/invited, bot, complete/settlement and incompatible rooms retain
      // the original row/social-lock ordering and recovery path.
      if (row.token === token && room.members.cpu && room.status === 'active' &&
          room.rulesVersion === ONLINE_RULES_VERSION && !room.ranked?.bot &&
          room.expiresAt > now && room.deadline !== null && room.deadline > now &&
          (!room.kumite || room.kumite.roundDeadline > now))
        return { unchanged: true as const, syncToken: token, serverTime: now };
    }
  }
  return accessFriendRoom(code, userId);
}

async function accessFriendRoomOperation(code: string, userId: string, mutation?: Mutation) {
  const access = (forceSocialLock: boolean) => homiesTransaction(async (tx) => {
    // This unlocked hint only chooses a lock path; it never authorizes access.
    // Joined seats survive remove/block and rematches, so polling or commanding
    // those rooms need not queue behind unrelated social menus.
    const [hint] = forceSocialLock ? [] : await tx
      .select({ joined: sql<boolean>`${onlineRoomsTable.state}->'members'->'cpu'->>'userId' is not null` })
      .from(onlineRoomsTable)
      .where(eq(onlineRoomsTable.code, code));
    const socialLocked = forceSocialLock || !hint?.joined;
    if (socialLocked) {
      homiesDiagnostics.roomPath(false);
      await lockSocial(tx);
    }
    const [row] = await tx
      .select()
      .from(onlineRoomsTable)
      .where(eq(onlineRoomsTable.code, code))
      .for("update");
    if (!row) throw new OnlineError("Room not found.", 404);
    let syncToken = row.syncToken;
    let room = restore(row.state);
    // Recheck under the row lock. If the hint ever becomes stale, end this
    // transaction before retrying: never acquire social after a room lock.
    if (!socialLocked && !room.members.cpu) return { retryWithSocialLock: true as const };
    if (!socialLocked) homiesDiagnostics.roomPath(true);
    await guardTargetedRoom(tx, row.id, room, userId, mutation?.kind === "join", row.inviteOnly);
    if (mutation?.kind !== "join") memberSeat(room, userId);
    const now = Date.now();
    room = retireIncompatibleOnlineRoom(room, now);
    room = advanceRankedBot(room, now);
    room = expireOnlineRoom(room, now);
    let failure: OnlineError | undefined;
    try {
      if (room.rulesVersion !== ONLINE_RULES_VERSION || room.reason === 'rules-updated') {
        // Return the neutral exit even for an in-flight/retried action. It must
        // not create a command receipt, result, or new match under old rules.
        if (mutation?.kind === 'join') memberSeat(room, userId);
      } else if (mutation?.kind === "join") {
        if (room.ranked) throw new OnlineError("Find ranked opponents through Fade Park.", 403);
        if (
          room.members.player.userId !== userId &&
          room.members.cpu?.userId !== userId
        ) {
          if (room.members.cpu || room.status !== "waiting")
            throw new OnlineError("This room is full or has expired.");
          room = joinOnlineRoom(
            room,
            await loadMember(tx, userId, mutation.deckId),
            now,
          );
        }
      } else if (mutation?.kind === "command") {
        const fingerprint = commandFingerprint(mutation.command);
        const [previous] = await tx
          .select()
          .from(onlineCommandsTable)
          .where(
            and(
              eq(onlineCommandsTable.roomId, row.id),
              eq(onlineCommandsTable.userId, userId),
              eq(onlineCommandsTable.requestId, mutation.requestId),
            ),
          );
        if (previous) {
          if (commandFingerprint(previous.command) !== fingerprint)
            throw new OnlineError(
              "This request ID was already used for another action.",
            );
        } else {
          // Ready/rematch votes commute when the only unseen revision is the rival's vote.
          // Plays and end-turns always require the exact board revision.
          const seat = memberSeat(room, userId);
          const rival = seat === "player" ? "cpu" : "player";
          // Returning to the lobby and leaving never touch a board, so a rival
          // who reopened the room first must not turn this into an error.
          const roomIntent =
            mutation.command.type === "lobby" ||
            mutation.command.type === "leave";
          const concurrentVote =
            roomIntent ||
            (mutation.expectedRevision === room.revision - 1 &&
            ((mutation.command.type === "ready" &&
              room.status === "waiting" &&
              !room.members[seat]!.ready &&
              room.members[rival]?.ready) ||
              (mutation.command.type === "rematch" &&
                room.status === "complete" &&
                !room.rematch[seat] &&
                room.rematch[rival])));
          if (room.revision !== mutation.expectedRevision && !concurrentVote)
            throw new OnlineError(
              "The fade changed. Your board has been refreshed; choose your next action.",
            );
          room = applyOnlineCommand(
            room,
            memberSeat(room, userId),
            mutation.command,
            now,
          );
          await tx.insert(onlineCommandsTable).values({
            roomId: row.id,
            revision: room.revision,
            userId,
            requestId: mutation.requestId,
            command: mutation.command,
          });
        }
      }
    } catch (error) {
      if (!(error instanceof OnlineError)) throw error;
      failure = error;
    }
    room = reactParkBot(restore(row.state), room, now);
    room = await settleRankedRoom(tx, room, now, row.id);
    room = await syncRoomInvitation(tx, row.id, room);
    // Persist expired turns even when rejecting a late/stale action.
    if (room.revision !== restore(row.state).revision) {
      const [saved] = await tx
        .update(onlineRoomsTable)
        .set({
          state: stored(room),
          guestUserId: room.ranked?.bot ? null : room.members.cpu?.userId ?? null,
          updatedAt: new Date(now),
          expiresAt: new Date(room.status === "closed" ? now : room.expiresAt),
        })
        .where(eq(onlineRoomsTable.id, row.id)).returning({ syncToken: onlineRoomsTable.syncToken });
      syncToken = saved.syncToken;
    }
    return failure
      ? { failure }
      : { view: { ...onlineRoomView(room, code, userId, now), syncToken: syncToken ?? undefined } };
  });
  let result = await access(false);
  if (result.retryWithSocialLock) {
    homiesDiagnostics.retry();
    result = await access(true);
  }
  if (result.failure) throw result.failure;
  return result.view!;
}

type RoomRow = typeof onlineRoomsTable.$inferSelect;
const isRanked = sql`${onlineRoomsTable.state} ? 'ranked'`;
const isOpen = sql`${onlineRoomsTable.state}->>'status' in ('waiting', 'active')`;
const belongsTo = (userId: string) => or(eq(onlineRoomsTable.hostUserId, userId), eq(onlineRoomsTable.guestUserId, userId));
// The JSON predicates below must keep matching the partial index predicates in
// lib/db/src/schema/onlineRooms.ts, or PostgreSQL cannot use those indexes.
/** A player's waiting or active ranked rooms (online_rooms_ranked_open_host/guest). */
export const openRankedRoomsFor = (userId: string) => and(isRanked, isOpen, belongsTo(userId));
/** Waiting searches another player may claim (online_rooms_ranked_queue). */
export const claimableRankedRooms = (hostUserId: string, now: number) => and(isRanked,
  sql`${onlineRoomsTable.state}->>'status' = 'waiting'`, ne(onlineRoomsTable.hostUserId, hostUserId),
  gt(onlineRoomsTable.expiresAt, new Date(now)),
  sql`(${onlineRoomsTable.state}->'ranked'->>'heartbeatAt')::bigint >= ${now - RANKED_QUEUE_IDLE_MS}`);
/**
 * Finished rooms keep their full battle snapshot, often megabytes once unpacked.
 * PostgreSQL does not count that unpacking, so while the table is small it may
 * pick a sequential scan that unpacks every finished room just to read its
 * status. Ranked lobby and queue transactions must use the partial indexes.
 */
export async function preferRankedRoomIndexes(tx: Tx) {
  await tx.execute(sql`set local enable_seqscan = off`);
}

async function saveRoom(tx: Tx, row: RoomRow, room: OnlineRoom, now: number) {
  await tx.update(onlineRoomsTable).set({ state: stored(room),
    guestUserId: room.ranked?.bot ? null : room.members.cpu?.userId ?? null,
    updatedAt: new Date(now), expiresAt: new Date(room.status === 'closed' ? now : room.expiresAt),
  }).where(eq(onlineRoomsTable.id, row.id));
}

/** Room lock + profile locks make the result and both rating changes a single receipt. */
async function settleRankedRoom(tx: Tx, room: OnlineRoom, now: number, roomId: string): Promise<OnlineRoom> {
  if (room.rulesVersion !== ONLINE_RULES_VERSION || room.reason === 'rules-updated')
    return retireIncompatibleOnlineRoom(room, now);
  // Full human battles only. Timeouts, concessions and ranked bot matches never advance these tasks.
  if (room.status === 'complete' && room.reason === 'districts' && !room.ranked?.bot && room.members.cpu) {
    const seats = (['player','cpu'] as const).slice().sort((a,b)=>room.members[a]!.userId.localeCompare(room.members[b]!.userId));
    for (const seat of seats) {
      const userId = room.members[seat]!.userId;
      const [profile] = await tx.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId,userId)).for('update');
      if (!profile) continue;
      const tasks: BountyTask[] = [room.ranked || room.kumite ? 'pvp' : 'friendly'];
      if (room.winner === seat) tasks.push(room.ranked || room.kumite ? 'pvp-win' : 'friendly-win');
      const storyProgress = await progressBountyEvent(tx,profile,`online:${roomId}:${room.gameNumber}`,tasks);
      if(storyProgress!==profile.storyProgress)await tx.update(playerProfilesTable).set({storyProgress}).where(eq(playerProfilesTable.clerkUserId,userId));
    }
  }
  if (!room.ranked || room.status !== 'complete' || room.ranked.settlement) return room;
  const settlement: NonNullable<OnlineRoom['ranked']>['settlement'] = {};
  const seats = room.ranked.bot ? ['player'] as const : ['player', 'cpu'] as const;
  const ordered = [...seats].sort((a, b) => room.members[a]!.userId.localeCompare(room.members[b]!.userId));
  for (const seat of ordered) {
    const userId = room.members[seat]!.userId;
    const [profile] = await tx.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId)).for('update');
    if (!profile) throw new OnlineError('Could not save the ranked result. Please reconnect.', 503);
    const current = rankedStats(profile.storyProgress.fadePark);
    const outcome = room.winner === 'draw' ? 'draw' : room.winner === seat ? 'win' : 'loss';
    const rival = seat === 'player' ? 'cpu' : 'player';
    const award = awardRank(current, outcome, room.ranked.ratings[rival] ?? 1000, room.ranked.bot);
    const rewards = [];
    for (const reward of rankMilestoneRewards(0, award.stats.bestPoints)) {
      const [receipt] = await tx.insert(playerCollectionClaimsTable).values({ clerkUserId: userId,
        milestoneKey: `rank:${RANKED_SEASON}:${reward.tier}`, reward }).onConflictDoNothing().returning();
      if (receipt) rewards.push(reward);
    }
    const matchClout = await bankRankedMatchClout(tx, room, seat, roomId, now);
    await tx.update(playerProfilesTable).set({ storyProgress: { ...profile.storyProgress, fadePark: award.stats },
      softCurrency: sql`${playerProfilesTable.softCurrency} + ${rewards.reduce((total, reward) => total + reward.softCurrency, 0) + matchClout.delta}`,
      packTickets: sql`${playerProfilesTable.packTickets} + ${rewards.reduce((total, reward) => total + reward.packTickets, 0)}`,
      styleShards: sql`${playerProfilesTable.styleShards} + ${rewards.reduce((total, reward) => total + reward.styleShards, 0)}`,
      updatedAt: new Date(now) }).where(eq(playerProfilesTable.clerkUserId, userId));
    settlement[seat] = { ...award.result, rewards, matchClout: matchClout.receipt };
  }
  return { ...room, revision: room.revision + 1, ranked: { ...room.ranked, settlement } };
}

/** Bots use the same legal commands and the engine's public-board-only decision policy. */
function advanceRankedBot(input: OnlineRoom, now: number): OnlineRoom {
  let room = retireIncompatibleOnlineRoom(input, now);
  if (!room.ranked?.bot || room.status !== 'active' || room.activeSeat !== 'cpu' || !room.match) return room;
  if ((room.ranked.botNextAt ?? 0) > now) return room;
  // Serverless polling may sleep while the app is backgrounded. Catch up the bot's
  // bounded turn instead of awarding a win for a bot that had no process running.
  const catchUp = now >= (room.deadline ?? Infinity);
  for (let step = 0; step < (catchUp ? 12 : 1); step++) {
    if (room.status !== 'active' || room.activeSeat !== 'cpu' || !room.match) break;
    const choice = chooseCpuPlay(room.match, false);
    const command: OnlineCommand = choice ? { type: 'play', ...choice } : { type: 'end-turn' };
    const previous = room;
    room = reactParkBot(previous, applyOnlineCommand(room, 'cpu', command, Math.min(now, (room.deadline ?? now + 1) - 1)), now);
    room = { ...room, ranked: { ...room.ranked!, botNextAt: now + parkBotPersona(room.ranked?.botPersona).pace } };
    if (room.status === 'active' && room.activeSeat === 'player') room = { ...room, deadline: now + TURN_SECONDS * 1000 };
  }
  return room;
}

async function refreshRankedRoom(tx: Tx, row: RoomRow, now: number) {
  let room = retireIncompatibleOnlineRoom(restore(row.state), now);
  if (room.status === 'waiting' && room.ranked && now - room.ranked.heartbeatAt > RANKED_QUEUE_IDLE_MS)
    room = { ...room, status: 'closed', revision: room.revision + 1, reason: 'expired' };
  room = await settleRankedRoom(tx, expireOnlineRoom(advanceRankedBot(room, now), now), now, row.id);
  // Polling unchanged active rooms must not rewrite the full battle snapshot.
  if (room.revision !== restore(row.state).revision) await saveRoom(tx, row, room, now);
  return room;
}

function readyRanked(room: OnlineRoom, guest: OnlineMember, now: number) {
  room = joinOnlineRoom(room, guest, now);
  room = applyOnlineCommand(room, 'player', { type: 'ready' }, now);
  return applyOnlineCommand(room, 'cpu', { type: 'ready' }, now);
}

async function matchWaitingRoom(tx: Tx, own: RoomRow, input: OnlineRoom, now: number) {
  let room = input;
  if (room.status !== 'waiting' || !room.ranked) return { row: own, room };
  room = { ...room, ranked: { ...room.ranked!, heartbeatAt: now } };
  // Queue transactions share one short advisory lock. Row locks also coordinate
  // cancellations and normal match commands; another request can never claim a seat twice.
  const candidates = await tx.select().from(onlineRoomsTable).where(claimableRankedRooms(own.hostUserId, now))
    .orderBy(asc(onlineRoomsTable.createdAt)).limit(40).for('update', { skipLocked: true });
  for (const candidate of candidates) {
    const rival = await refreshRankedRoom(tx, candidate, now);
    if (rival.status !== 'waiting' || !rival.ranked || rival.members.cpu) continue;
    const waited = Math.max(now - room.ranked!.queuedAt, now - rival.ranked.queuedAt);
    const range = waited >= 4000 ? Infinity : 300 + Math.floor(waited / 1000) * 150;
    if (Math.abs(room.ranked!.ratings.player - rival.ranked.ratings.player) > range) continue;
    const joined = readyRanked({ ...rival, ranked: { ...rival.ranked,
      ratings: { player: rival.ranked.ratings.player, cpu: room.ranked!.ratings.player },
    } }, room.members.player, now);
    await saveRoom(tx, candidate, joined, now);
    await saveRoom(tx, own, { ...room, status: 'closed', revision: room.revision + 1,
      ranked: { ...room.ranked!, redirectCode: candidate.code } }, now);
    return { row: candidate, room: joined };
  }
  if (now >= room.ranked!.botAfter) {
    const recipe = starterRecipes[randomInt(starterRecipes.length)];
    const rookie = (await tx.select({ progress: playerProfilesTable.storyProgress }).from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, own.hostUserId)))[0];
    const beginner = rankedStats(rookie?.progress.fadePark).points < 100;
    const persona = PARK_BOT_PERSONAS[parseInt(own.code.slice(-4), 16) % PARK_BOT_PERSONAS.length];
    const bot: OnlineMember = { userId: `park-bot:${own.code}`, name: `${persona.name} · Park Bot`, avatarKey: persona.avatarKey, banner: { cardId: persona.bannerCardId, finish: 'base' }, level: beginner ? 3 : 10, ready: false,
      deck: { id: 'park-bot', name: persona.personality, hero: beginner ? 'hooper' : recipe.hero,
        cards: catalogIdsToEngineIds(beginner ? [...ROOKIE_CORE_IDS] : recipe.catalogCardIds) } };
    room = readyRanked({ ...room, ranked: { ...room.ranked!, bot: true, botPersona: persona.id, botReactionCount: 0, botNextAt: now + persona.pace,
      ratings: { player: room.ranked!.ratings.player, cpu: room.ranked!.ratings.player },
    } }, bot, now);
  }
  await saveRoom(tx, own, room, now);
  return { row: own, room };
}

async function rankProfile(tx: Tx, userId: string) {
  const [profile] = await tx.select({ storyProgress: playerProfilesTable.storyProgress, onboardingStep: playerProfilesTable.onboardingStep }).from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId));
  if (!profile || profile.onboardingStep !== 'complete') throw new OnlineError('Finish your first gang lesson before entering Fade Park.', 403);
  return rankedStats(profile.storyProgress.fadePark);
}

export async function rankedLobby(userId: string, search?: { deckId: string; requestId: string }) {
  // This hint chooses a path only. Both paths recheck under their own locks.
  // Waiting polls go straight to matchmaking rather than paying for two full
  // transactions each time; active and empty lobbies avoid the queue entirely.
  const [hint] = search ? [] : await db.transaction(async tx => {
    await preferRankedRoomIndexes(tx);
    return tx.select({ status: sql<string>`${onlineRoomsTable.state}->>'status'` })
      .from(onlineRoomsTable).where(openRankedRoomsFor(userId))
      .orderBy(desc(onlineRoomsTable.createdAt)).limit(1);
  });
  if (!search && hint?.status !== 'waiting') {
    // An idle lobby or an already-paired battle cannot claim another queue seat.
    // Keep these reads off the global matchmaking lock so a busy match/result
    // cannot hold every unrelated player's search behind its room/profile locks.
    const current = await db.transaction(async tx => {
      await preferRankedRoomIndexes(tx);
      let stats = await rankProfile(tx, userId);
      const open = await tx.select().from(onlineRoomsTable)
        .where(openRankedRoomsFor(userId))
        .orderBy(desc(onlineRoomsTable.createdAt)).for('update');
      for (const row of open) {
        if (restore(row.state).status === 'waiting') return { retryQueue: true as const };
        const now = Date.now();
        const room = await refreshRankedRoom(tx, row, now);
        stats = await rankProfile(tx, userId);
        if (room.status === 'active') {
          return { stats, progress: rankProgress(stats.points), room: onlineRoomView(room, row.code, userId, now) };
        }
      }
      return { stats, progress: rankProgress(stats.points), room: null };
    });
    if (!('retryQueue' in current)) return current;
    // End the row-lock transaction before acquiring the queue lock. The queue
    // path rechecks the room, so cancellation/pairing races remain authoritative.
  }
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(72613401)`);
    await preferRankedRoomIndexes(tx);
    const now = Date.now();
    await rankProfile(tx, userId);
    // Search retries resolve the original room even if this player joined as guest.
    if (search) {
      const [previous] = await tx.select().from(onlineRoomsTable).where(and(eq(onlineRoomsTable.hostUserId, userId), eq(onlineRoomsTable.createRequestId, search.requestId))).for('update');
      if (previous) {
        let row = previous;
        const state = restore(row.state);
        if (!state.ranked || state.members.player.deck.id !== search.deckId) throw new OnlineError('This search request was already used for another gang.');
        if (state.ranked.redirectCode) {
          [row] = await tx.select().from(onlineRoomsTable).where(eq(onlineRoomsTable.code, state.ranked.redirectCode)).for('update');
          if (!row) throw new OnlineError('This fade has expired. Start a new search.', 404);
        }
        const room = await refreshRankedRoom(tx, row, now);
        const found = await matchWaitingRoom(tx, row, room, now);
        const stats = await rankProfile(tx, userId);
        return { stats, progress: rankProgress(stats.points), room: onlineRoomView(found.room, found.row.code, userId, now) };
      }
    }
    const open = await tx.select().from(onlineRoomsTable).where(openRankedRoomsFor(userId)).orderBy(desc(onlineRoomsTable.createdAt)).for('update');
    let found: { row: RoomRow; room: OnlineRoom } | undefined;
    for (const row of open) {
      const room = await refreshRankedRoom(tx, row, now);
      if (room.status === 'active' || room.status === 'waiting') { found = await matchWaitingRoom(tx, row, room, now); break; }
    }
    if (!found && search) {
      const member = await loadMember(tx, userId, search.deckId, false);
      const stats = await rankProfile(tx, userId);
      const room = createOnlineRoom(member, randomInt(2) ? 'player' : 'cpu', now);
      room.ranked = { queuedAt: now, heartbeatAt: now, botAfter: now + RANKED_BOT_WAIT_MS, bot: false, ratings: { player: stats.rating } };
      const [row] = await tx.insert(onlineRoomsTable).values({ code: randomBytes(6).toString('hex').toUpperCase(), hostUserId: userId,
        createRequestId: search.requestId, state: stored(room), expiresAt: new Date(room.expiresAt) }).returning();
      found = await matchWaitingRoom(tx, row, room, now);
    }
    const stats = await rankProfile(tx, userId);
    return { stats, progress: rankProgress(stats.points), room: found ? onlineRoomView(found.room, found.row.code, userId, now) : null };
  });
}

export async function cancelRankedSearch(userId: string, code: string) {
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(72613401)`);
    let [row] = await tx.select().from(onlineRoomsTable).where(eq(onlineRoomsTable.code, code)).for('update');
    if (!row || !restore(row.state).ranked) throw new OnlineError('Search not found.', 404);
    memberSeat(restore(row.state), userId);
    const redirected = restore(row.state).ranked?.redirectCode;
    if (redirected) [row] = await tx.select().from(onlineRoomsTable).where(eq(onlineRoomsTable.code, redirected)).for('update');
    if (!row) throw new OnlineError('Search not found.', 404);
    memberSeat(restore(row.state), userId);
    let room = await refreshRankedRoom(tx, row, Date.now());
    if (room.status === 'waiting') {
      room = { ...room, revision: room.revision + 1, status: 'closed' };
      await saveRoom(tx, row, room, Date.now());
    }
    // If pairing won the race, enter that match instead of silently forfeiting it.
    return onlineRoomView(room, row.code, userId, Date.now());
  });
}

/** Reactions share the room lock but never change a card-play revision or turn clock. */
export async function accessRoomReactions(code: string, userId: string, input?: { requestId: string; reactionId: string; gameNumber: number }) {
  if (!input) {
    const [row] = await db.select({ live: onlineRoomsTable.liveState }).from(onlineRoomsTable).where(eq(onlineRoomsTable.code, code));
    if (!row) throw new OnlineError('Room not found.', 404);
    const room = row.live as unknown as OnlineRoom | null;
    if (room && room.rulesVersion === ONLINE_RULES_VERSION) {
      memberSeat(room, userId);
      const [profile] = await db.select({ unlockedCosmeticIds: playerProfilesTable.unlockedCosmeticIds, settings: playerProfilesTable.settings })
        .from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId));
      if (!profile) throw new OnlineError('Player profile not found.', 404);
      return { ...(room.reactions ?? { revision: 0, latest: {} }), serverTime: Date.now(), owned: ownedReactions(profile.unlockedCosmeticIds),
        tray: resolveReactionTray(profile.settings.reactionTray, profile.unlockedCosmeticIds) };
    }
  }
  return db.transaction(async tx => {
    const [row] = await tx.select().from(onlineRoomsTable).where(eq(onlineRoomsTable.code, code)).for('update');
    if (!row) throw new OnlineError('Room not found.', 404);
    const previous = restore(row.state);
    const seat = memberSeat(previous, userId);
    const now = Date.now();
    const room = retireIncompatibleOnlineRoom(previous, now);
    if (room.revision !== previous.revision) await saveRoom(tx, row, room, now);
    const [profile] = await tx.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId));
    if (!profile) throw new OnlineError('Player profile not found.', 404);
    const owned = ownedReactions(profile.unlockedCosmeticIds);
    if (input && room.reason !== 'rules-updated') {
      if (room.status !== 'active' || room.expiresAt <= now || (room.deadline !== null && room.deadline <= now) || room.gameNumber !== input.gameNumber) throw new OnlineError('Reactions are available during the current battle.', 409);
      try {
        const reactions = addReaction(room.reactions, { id: input.requestId, reactionId: input.reactionId, gameNumber: input.gameNumber, seat }, owned, now);
        if (reactions !== room.reactions) await tx.update(onlineRoomsTable).set({ state: stored({ ...room, reactions }) }).where(eq(onlineRoomsTable.id, row.id));
        room.reactions = reactions;
      } catch (error) {
        if (error instanceof ReactionError) throw new OnlineError(error.message, error.status);
        throw error;
      }
    }
    return { ...(room.reactions ?? { revision: 0, latest: {} }), serverTime: now, owned, tray: resolveReactionTray(profile.settings.reactionTray, profile.unlockedCosmeticIds) };
  });
}

/** Display-only banner for PvP; only an owned character banner is shown. */
function equippedBanner(profile: { ownedCardIds: string[]; settings: unknown }) {
  const loadout = (profile.settings as { cosmetics?: { bannerCardId?: string | null; bannerFinish?: 'base' | 'silver'; stickers?: string[] } } | null)?.cosmetics;
  const cardId = loadout?.bannerCardId;
  if (!cardId || !profile.ownedCardIds.includes(cardId)) return {};
  return { banner: { cardId, finish: loadout?.bannerFinish === 'silver' ? 'silver' as const : 'base' as const, stickers: (loadout?.stickers ?? []).slice(0, 3) } };
}
