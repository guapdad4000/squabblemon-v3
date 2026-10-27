import { kumiteMastery } from './kumiteMastery';
import { getDistrictResults } from '@workspace/squabblemon-engine/gameEngine';
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
  const [profile] = await reader.select({ ownedCardIds: playerProfilesTable.ownedCardIds, ownedVariants: playerProfilesTable.ownedVariants }).from(playerProfilesTable)
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
  return { ...progress, mastery: kumiteMastery(rows,profile?.ownedVariants??[]), rewards: KUMITE_CARD_REWARDS.map(reward => ({ id: reward.id, cardId: reward.cardId,
    name: catalogCardById[reward.cardId].name, rarity: catalogCardById[reward.cardId].rarity,
    requirement: reward.requirement, metric: reward.metric, required: reward.required,
    progress: progress[reward.metric], claimed: keys.has(reward.id), owned: owned.has(reward.cardId) })) };
}

/** Newly added roadmap steps honor genuine prior weeks without re-crediting battles.
 * Avoids locking player_profiles on read-only polls when no unclaimed milestone is due. */
export async function reconcileKumiteRewards(tx: Tx, userId: string, now: number): Promise<KumiteProgression> {
  const progress = await kumiteProgression(tx, userId);
  if (progress.rewards.every(reward => reward.claimed || reward.progress < reward.required) && progress.mastery?.every(m=> (m.altOwned || !m.dojoCleared || !m.weeklyWin) && m.quests.every(q=>q.claimed || !q.complete))) {
    return progress;
  }
  return recordEvents(tx, userId, [], now);
}

async function recordEvents(tx: Tx, userId: string, events: { key: string; reward: CollectionRoadRewardRecord }[], now: number): Promise<KumiteProgression> {
  const [profile] = await tx.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId)).for('update');
  if (!profile) return kumiteProgression(tx, userId);
  for (const event of events) await tx.insert(playerCollectionClaimsTable).values({ clerkUserId: userId,
    milestoneKey: event.key, reward: event.reward, createdAt: new Date(now) }).onConflictDoNothing();
  const progress = await kumiteProgression(tx, userId);
  const newlyEarned = progress.rewards.filter(reward => !reward.claimed && reward.progress >= reward.required);
  const mastery=progress.mastery??[];
  const newAlts=mastery.filter(m=>m.dojoCleared&&m.weeklyWin&&!m.altOwned&&(profile.ownedCardIds.includes(m.cardId)||newlyEarned.some(r=>r.cardId===m.cardId)));
  const newQuests=mastery.flatMap(m=>m.quests.filter(q=>q.complete&&!q.claimed).map(q=>({...q,cardId:m.cardId})));
  if (!newlyEarned.length&&!newAlts.length&&!newQuests.length) return progress;
  for(const m of newAlts) await tx.insert(playerCollectionClaimsTable).values({clerkUserId:userId,milestoneKey:`kumite:alternate:${m.cardId}:v1`,reward:{kumiteAlternate:{cardId:m.cardId,variantId:m.variantId}},createdAt:new Date(now)}).onConflictDoNothing();
  for(const q of newQuests) await tx.insert(playerCollectionClaimsTable).values({clerkUserId:userId,milestoneKey:q.id,reward:{kumiteQuest:{cardId:q.cardId,styleShards:q.styleShards}},createdAt:new Date(now)}).onConflictDoNothing();
  for (const reward of newlyEarned) await tx.insert(playerCollectionClaimsTable).values({ clerkUserId: userId,
    milestoneKey: reward.id, reward: { cardId: reward.cardId, kumiteUnlock: { newlyOwned: !profile.ownedCardIds.includes(reward.cardId) } }, createdAt: new Date(now) }).onConflictDoNothing();
  const cardIds = newlyEarned.map(reward => reward.cardId);
  const ownedCardIds = [...new Set([...profile.ownedCardIds, ...cardIds])];
  await tx.update(playerProfilesTable).set({ ownedCardIds,
    ownedVariants:[...new Set([...profile.ownedVariants,...newAlts.map(m=>m.variantId)])],
    styleShards:profile.styleShards+newQuests.reduce((sum,q)=>sum+q.styleShards,0),
    discoveredCardIds: [...new Set([...profile.discoveredCardIds, ...cardIds])],
    unlockedCharacterIds: [...new Set([...profile.unlockedCharacterIds, ...cardIds])],
    cardProgression: { ...Object.fromEntries(cardIds.map(id => [id, { xp: 0, level: 1 }])), ...profile.cardProgression },
    collectionProgress: ownedCardIds.length, updatedAt: new Date(now),
  }).where(eq(playerProfilesTable.clerkUserId, userId));
  return kumiteProgression(tx,userId);
}

/** Called only after the service validates the server-issued room receipt. */
export async function recordKumitePlayedRoom(tx: Tx, state: KumiteState, match: KumiteMatchState, code: string, room: OnlineRoom, now: number) {
  if (room.status !== 'complete' || room.reason !== 'districts' || !room.match || room.match.phase !== 'complete' ||
    room.startedAt == null || room.completedAt == null || room.kumite?.finishedAt == null) return;
  const participants = match.entrantIds.map(id => state.entrants.find(entry => entry.id === id)!);
  const ordered = [...participants].sort((a, b) => a.member.userId.localeCompare(b.member.userId));
  for (const entry of ordered) {
    const seat = participants[0].id === entry.id ? 'player' : 'cpu';
    const detail = { tournamentId: state.id, matchId: match.id, roomCode: code, at: room.completedAt, crew: [...(seat === "player" ? room.match.playerCardIds : room.match.cpuCardIds)], sweep: getDistrictResults(room.match).every(lane=>lane.winner===seat) };
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
