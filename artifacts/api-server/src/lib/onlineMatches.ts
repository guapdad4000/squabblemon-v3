import { randomBytes, randomInt } from "node:crypto";
import { and, desc, eq, gt, or } from "drizzle-orm";
import {
  db,
  onlineCommandsTable,
  onlineRoomsTable,
  playerProfilesTable,
} from "@workspace/db";
import {
  catalogIdsToEngineIds,
  starterRecipes,
  validateSavedDeck,
} from "@workspace/squabblemon-engine/data";
import {
  applyOnlineCommand,
  createOnlineRoom,
  expireOnlineRoom,
  joinOnlineRoom,
  memberSeat,
  onlineRoomView,
  OnlineError,
  type OnlineCommand,
  type OnlineMember,
  type OnlineRoom,
} from "@workspace/squabblemon-engine/multiplayer";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const stored = (state: OnlineRoom) =>
  state as unknown as Record<string, unknown>;
const restore = (state: Record<string, unknown>) =>
  state as unknown as OnlineRoom;
const commandFingerprint = (command: object) =>
  JSON.stringify(
    Object.entries(command).sort(([a], [b]) => a.localeCompare(b)),
  );

async function loadMember(
  tx: Tx,
  userId: string,
  deckId: string,
): Promise<OnlineMember> {
  const [profile] = await tx
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, userId))
    .for("update");
  if (!profile || profile.onboardingStep !== "complete")
    throw new OnlineError(
      "Finish your first crew lesson before playing online.",
      403,
    );
  const saved = profile.savedDecks.find((deck) => deck.id === deckId);
  const recipe = starterRecipes.find((deck) => deck.id === deckId);
  const cardIds = saved?.cardIds ?? recipe?.catalogCardIds ?? [];
  const hero = saved?.heroCardId ?? recipe?.hero;
  if (!validateSavedDeck(cardIds, profile.ownedCardIds, hero).valid)
    throw new OnlineError(
      "Choose a saved crew of ten unique cards you own.",
      400,
    );
  return {
    userId,
    name: profile.displayName,
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
  return db.transaction(async (tx) => {
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
          "This request was already used for another crew.",
        );
      return onlineRoomView(
        expireOnlineRoom(restore(existing.state), Date.now()),
        existing.code,
        userId,
        Date.now(),
      );
    }
    const now = Date.now();
    const open = await tx
      .select({ state: onlineRoomsTable.state })
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
}

export async function listFriendRooms(userId: string) {
  const rows = await db
    .select({ code: onlineRoomsTable.code, state: onlineRoomsTable.state })
    .from(onlineRoomsTable)
    .where(
      and(
        or(
          eq(onlineRoomsTable.hostUserId, userId),
          eq(onlineRoomsTable.guestUserId, userId),
        ),
        gt(onlineRoomsTable.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(onlineRoomsTable.updatedAt))
    .limit(20);
  return rows.map((row) => {
    const room = expireOnlineRoom(restore(row.state), Date.now());
    return {
      code: row.code,
      status: room.status,
      rival:
        room.members[memberSeat(room, userId) === "player" ? "cpu" : "player"]
          ?.name ?? "Waiting for a friend",
      gameNumber: room.gameNumber,
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
  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(onlineRoomsTable)
      .where(eq(onlineRoomsTable.code, code))
      .for("update");
    if (!row) throw new OnlineError("Room not found.", 404);
    let room = restore(row.state);
    if (mutation?.kind !== "join") memberSeat(room, userId);
    const now = Date.now();
    room = expireOnlineRoom(room, now);
    let failure: OnlineError | undefined;
    try {
      if (mutation?.kind === "join") {
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
          if (room.revision !== mutation.expectedRevision)
            throw new OnlineError(
              "The match changed. Your board has been refreshed; choose your next action.",
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
    // Persist expired turns even when rejecting a late/stale action.
    if (room.revision !== restore(row.state).revision)
      await tx
        .update(onlineRoomsTable)
        .set({
          state: stored(room),
          guestUserId: room.members.cpu?.userId ?? null,
          updatedAt: new Date(now),
          expiresAt: new Date(room.status === "closed" ? now : room.expiresAt),
        })
        .where(eq(onlineRoomsTable.id, row.id));
    return failure
      ? { failure }
      : { view: onlineRoomView(room, code, userId, now) };
  });
  if (result.failure) throw result.failure;
  return result.view!;
}
