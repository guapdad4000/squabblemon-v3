import { randomUUID } from "node:crypto";
import { db, playerProfilesTable as profiles, socialIdentitiesTable as identities,
  socialRelationshipsTable as relations, socialInvitationsTable as invites, onlineRoomsTable as rooms } from "@workspace/db";
import { cardCatalog, starterRecipes, catalogIdsToEngineIds } from "@workspace/squabblemon-engine/data";
import { createOnlineRoom } from "@workspace/squabblemon-engine/multiplayer";

export type Player = { id: string; code: string };
export const deckId = starterRecipes[0].id;
const memberDeck = { id: deckId, name: starterRecipes[0].name, hero: starterRecipes[0].hero,
  cards: catalogIdsToEngineIds(starterRecipes[0].catalogCardIds) };

/** Each account has twenty actual homies and five historical invitation receipts. */
export async function seedPlayers(count: number): Promise<Player[]> {
  if (count < 25) throw new Error("Fixture needs at least 25 players for twenty distinct homies.");
  const prefix = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  const players = Array.from({ length: count }, (_, i) => ({
    id: `load-${randomUUID()}`, code: prefix + (i + 1).toString(16).toUpperCase().padStart(6, "0"),
  }));
  const ownedCardIds = cardCatalog.map(c => c.catalogId);
  for (let i = 0; i < players.length; i += 100) {
    await db.insert(profiles).values(players.slice(i, i + 100).map((p, j) => ({
      clerkUserId: p.id, displayName: `Load Player ${i + j}`, onboardingStep: "complete" as const, ownedCardIds,
    })));
    await db.insert(identities).values(players.slice(i, i + 100).map(p => ({ userId: p.id, friendCode: p.code })));
  }
  const friendships = new Map<string, { low: string; high: string; sender: string; status: string }>();
  for (let i = 0; i < count; i++) for (let offset = 1; offset <= 10; offset++) {
    const a = players[i].id, b = players[(i + offset) % count].id;
    const [low, high] = [a, b].sort();
    friendships.set(`${low}/${high}`, { low, high, sender: a, status: "homie" });
  }
  const edges = [...friendships.values()];
  for (let i = 0; i < edges.length; i += 100) await db.insert(relations).values(edges.slice(i, i + 100));
  // Receipts are terminal, not pending: they populate the real menu read path
  // without exhausting invite limits or competing with the live race fixtures.
  for (let i = 0; i < count; i += 50) {
    const batch = players.slice(i, i + 50);
    const roomRows = batch.flatMap((p, j) => Array.from({ length: 5 }, (_, k) => {
      const state = createOnlineRoom({ userId: p.id, name: `Load Player ${i + j}`, level: 1,
        streetRep: 0, ready: false, deck: memberDeck }, "player", Date.now());
      return { code: randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase(), hostUserId: p.id,
        inviteOnly: true, createRequestId: randomUUID(), state: { ...state, status: "closed" } as unknown as Record<string, unknown>,
        expiresAt: new Date(Date.now() - 120_000) };
    }));
    const inserted = await db.insert(rooms).values(roomRows).returning({ id: rooms.id });
    await db.insert(invites).values(batch.flatMap((p, j) => Array.from({ length: 5 }, (_, k) => {
      const other = players[(i + j + k + 1) % count];
      const [low, high] = [p.id, other.id].sort();
      return { sender: p.id, recipient: other.id, low, high, roomId: inserted[j * 5 + k].id,
        requestId: roomRows[j * 5 + k].createRequestId, deckId, status: "cancelled",
        createdAt: new Date(Date.now() - 120_000), expiresAt: new Date(Date.now() - 120_000) };
    })));
  }
  return players;
}