import { and, eq, like, or } from 'drizzle-orm';
import { db, playerCollectionClaimsTable, playerProfilesTable, type CollectionRoadRewardRecord } from '@workspace/db';
import { catalogCardById, KUMITE_CARD_REWARDS } from '@workspace/squabblemon-engine/data';
import type { OnlineRoom } from '@workspace/squabblemon-engine/multiplayer';
import type { KumiteMatchState, KumiteProgression, KumiteState } from './kumiteEngine';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = Pick<typeof db, 'select'>;
export async function kumiteProgression(reader: Reader, userId: string): Promise<KumiteProgression> {
  const rows = await reader.select({ key: playerCollectionClaimsTable.milestoneKey, reward: playerCollectionClaimsTable.reward }).from(playerCollectionClaimsTable)
    .where(and(
      eq(playerCollectionClaimsTable.clerkUserId, userId),
      or(
        like(playerCollectionClaimsTable.milestoneKey, 'kumite:%'),
        like(playerCollectionClaimsTable.milestoneKey, 'boss-raid:%'),
        like(playerCollectionClaimsTable.milestoneKey, 'boss-campaign:%'),
      ),
    ));
  const keys = new Set(rows.map(row => row.key));
  const [profile] = await reader.select({ ownedCardIds: playerProfilesTable.ownedCardIds }).from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, userId));
  const owned = new Set(profile?.ownedCardIds ?? []);
  const raidRows = rows.filter(row => row.key.startsWith('boss-raid:'));
  const raidCompleted = raidRows.filter(row => {
    const state = (row.reward as { bossRaid?: { state?: { phase?: string } } } | null)?.bossRaid?.state;
    return state?.phase && state.phase !== 'active';
  }).length;
  const raidWins = raidRows.filter(row => {
    const state = (row.reward as { bossRaid?: { state?: { phase?: string; score?: number; hp?: number } } } | null)?.bossRaid?.state;
    return state?.phase && state.phase !== 'active' && ((state.score ?? 0) >= 50 || state.hp === 0);
  }).length;
  const raidTierClears = rows
    .filter(row => row.key.startsWith('boss-campaign:'))
    .reduce((sum, row) => {
      const defeated = (row.reward as { bossCampaign?: { state?: { defeated?: unknown[] } } } | null)?.bossCampaign?.state?.defeated;
      return sum + (Array.isArray(defeated) ? defeated.length : 0);
    }, 0);
  const progress = {
    completedMatches: rows.filter(row => row.key.startsWith('kumite:completed:')).length + raidCompleted,
    matchWins: rows.filter(row => row.key.startsWith('kumite:win:')).length + raidWins,
    championships: rows.filter(row => row.key.startsWith('kumite:champion:')).length + raidTierClears,
  };
  return { ...progress, rewards: KUMITE_CARD_REWARDS.map(reward => ({ id: reward.id, cardId: reward.cardId,
    name: catalogCardById[reward.cardId].name, rarity: catalogCardById[reward.cardId].rarity,
    requirement: reward.requirement, metric: reward.metric, required: reward.required,
    progress: progress[reward.metric], claimed: keys.has(reward.id), owned: owned.has(reward.cardId) })) };
}

/** Newly added roadmap steps honor genuine prior weeks without re-crediting battles. */
export async function reconcileKumiteRewards(tx: Tx, userId: string, now: number) {
  await recordEvents(tx, userId, [], now);
}

async function recordEvents(tx: Tx, userId: string, events: { key: string; reward: CollectionRoadRewardRecord }[], now: number) {
  const [profile] = await tx.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId)).for('update');
  if (!profile) return;
  for (const event of events) await tx.insert(playerCollectionClaimsTable).values({ clerkUserId: userId,
    milestoneKey: event.key, reward: event.reward, createdAt: new Date(now) }).onConflictDoNothing();
  const progress = await kumiteProgression(tx, userId);
  const newlyEarned = progress.rewards.filter(reward => !reward.claimed && reward.progress >= reward.required);
  if (!newlyEarned.length) return;
  for (const reward of newlyEarned) await tx.insert(playerCollectionClaimsTable).values({ clerkUserId: userId,
    milestoneKey: reward.id, reward: { cardId: reward.cardId, kumiteUnlock: { newlyOwned: !profile.ownedCardIds.includes(reward.cardId) } }, createdAt: new Date(now) }).onConflictDoNothing();
  const cardIds = newlyEarned.map(reward => reward.cardId);
  const ownedCardIds = [...new Set([...profile.ownedCardIds, ...cardIds])];
  await tx.update(playerProfilesTable).set({ ownedCardIds,
    discoveredCardIds: [...new Set([...profile.discoveredCardIds, ...cardIds])],
    unlockedCharacterIds: [...new Set([...profile.unlockedCharacterIds, ...cardIds])],
    cardProgression: { ...Object.fromEntries(cardIds.map(id => [id, { xp: 0, level: 1 }])), ...profile.cardProgression },
    collectionProgress: ownedCardIds.length, updatedAt: new Date(now),
  }).where(eq(playerProfilesTable.clerkUserId, userId));
}

/** Called only after the service validates the server-issued room receipt. */
export async function recordKumitePlayedRoom(tx: Tx, state: KumiteState, match: KumiteMatchState, code: string, room: OnlineRoom, now: number) {
  if (room.status !== 'complete' || room.reason !== 'districts' || !room.match || room.match.phase !== 'complete' ||
    room.startedAt == null || room.completedAt == null || room.kumite?.finishedAt == null) return;
  const participants = match.entrantIds.map(id => state.entrants.find(entry => entry.id === id)!);
  const ordered = [...participants].sort((a, b) => a.member.userId.localeCompare(b.member.userId));
  for (const entry of ordered) {
    const seat = participants[0].id === entry.id ? 'player' : 'cpu';
    const detail = { tournamentId: state.id, matchId: match.id, roomCode: code, at: room.completedAt };
    const events: { key: string; reward: CollectionRoadRewardRecord }[] = [
      { key: `kumite:completed:${state.id}:${match.id}:v1`, reward: { kumite: { ...detail, event: 'completed' } } },
    ];
    if (room.winner === seat) events.push({ key: `kumite:win:${state.id}:${match.id}:v1`, reward: { kumite: { ...detail, event: 'win' } } });
    await recordEvents(tx, entry.member.userId, events, now);
  }
}
export async function recordKumiteChampion(tx: Tx, state: KumiteState, now: number) {
  const final = state.rounds[2][0];
  // A forfeit can decide the bracket, but it cannot farm the champion card.
  if (state.status !== 'complete' || !state.championId || final.reason !== 'played') return;
  const champion = state.entrants.find(entry => entry.id === state.championId)!;
  await recordEvents(tx, champion.member.userId, [{ key: `kumite:champion:${state.id}:v1`, reward: {
    kumite: { tournamentId: state.id, matchId: final.id, roomCode: final.roomCode ?? undefined, event: 'champion', at: final.completedAt ?? now },
  } }], now);
}
