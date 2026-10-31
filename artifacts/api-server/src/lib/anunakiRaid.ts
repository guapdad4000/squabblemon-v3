import { createHash } from 'node:crypto';
import { and, eq, like, desc, sql } from 'drizzle-orm';
import { db, playerCollectionClaimsTable, playerProfilesTable, playerStoryNodesTable } from '@workspace/db';
import { validateSavedDeck } from '@workspace/squabblemon-engine/data';
import { ANUNAKI_RAID_LOANER, AnunakiRaidRuleError, applyAnunakiRaidAction, createAnunakiRaid, type AnunakiRaid, type AnunakiRaidAction, type AnunakiRaidDifficulty } from '@workspace/squabblemon-engine/anunakiRaid';
import { buildStoryCampaign } from './storyService';
import { lockPlayerProfile, PlayerRewardError } from './playerRewardTransactions';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const prefix = 'anunaki-raid:run:';
const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const week = (date: Date) => { const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7); return day.toISOString().slice(0, 10); };
const runFilter = (userId: string) => and(eq(playerCollectionClaimsTable.clerkUserId, userId), like(playerCollectionClaimsTable.milestoneKey, prefix + '%'));
const activeFilter = sql`${playerCollectionClaimsTable.reward}->'anunakiRaid'->'state'->>'status' = 'active'`;
async function eligibility(tx: Tx, userId: string) {
  const story = await tx.select().from(playerStoryNodesTable).where(eq(playerStoryNodesTable.clerkUserId, userId));
  const chapters = buildStoryCampaign(story).chapters;
  const complete = (id: string) => chapters.some(chapter => chapter.id === id && chapter.status === 'cleared');
  const [standard] = await tx.select().from(playerCollectionClaimsTable).where(and(eq(playerCollectionClaimsTable.clerkUserId, userId), eq(playerCollectionClaimsTable.milestoneKey, 'anunaki-raid:first:standard')));
  return { training: complete('anunaki-07-wrong-millennium'), standard: complete('anunaki-08-original-arrival'), ascended: !!standard };
}
async function status(tx: Tx, userId: string) {
  // Project just the current run; never hydrate old action receipt snapshots.
  const projection = { state: sql<AnunakiRaid>`${playerCollectionClaimsTable.reward}->'anunakiRaid'->'state'` };
  const [active] = await tx.select(projection).from(playerCollectionClaimsTable).where(and(runFilter(userId), activeFilter)).orderBy(desc(playerCollectionClaimsTable.createdAt)).limit(1);
  const [latest] = active ? [active] : await tx.select(projection).from(playerCollectionClaimsTable).where(runFilter(userId)).orderBy(desc(playerCollectionClaimsTable.createdAt)).limit(1);
  return { eligibility: await eligibility(tx, userId), run: latest?.state ?? null };
}
export function getAnunakiRaid(userId: string) { return db.transaction(tx => status(tx, userId)); }
export function startAnunakiRaid(userId: string, requestId: string, difficulty: AnunakiRaidDifficulty, cardIds: string[]) {
  return db.transaction(async tx => {
    await lockPlayerProfile(tx, userId);
    const hash = fingerprint({ difficulty, cardIds });
    const [retry] = await tx.select().from(playerCollectionClaimsTable).where(and(eq(playerCollectionClaimsTable.clerkUserId, userId), eq(playerCollectionClaimsTable.milestoneKey, prefix + requestId))).limit(1);
    if (retry) { if (retry.reward.anunakiRaid?.startFingerprint !== hash) throw new PlayerRewardError('This raid request was already used for a different lineup.', 409); return retry.reward.anunakiRaid!.startResult as { eligibility: Awaited<ReturnType<typeof eligibility>>; run: AnunakiRaid }; }
    const [active] = await tx.select({ id: playerCollectionClaimsTable.id }).from(playerCollectionClaimsTable).where(and(runFilter(userId), activeFilter)).limit(1);
    if (active) throw new PlayerRewardError('Finish or retire your current raid first.', 409);
    const allowed = await eligibility(tx, userId);
    if (!allowed[difficulty]) throw new PlayerRewardError('Complete the required story chapter or raid first.', 403);
    const [profile] = await tx.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId));
    if (!profile) throw new PlayerRewardError('Player profile not found.', 404);
    const deck = difficulty === 'training' && cardIds.length === 0 ? [...ANUNAKI_RAID_LOANER] : cardIds;
    if (!(difficulty === 'training' && cardIds.length === 0) && !validateSavedDeck(deck, profile.ownedCardIds, deck[0]).valid) throw new PlayerRewardError('Bring ten unique owned cards, or use the training loaner.', 400);
    const run = createAnunakiRaid(requestId, difficulty, deck);
    const startResult = { eligibility: allowed, run };
    await tx.insert(playerCollectionClaimsTable).values({ clerkUserId: userId, milestoneKey: prefix + requestId, reward: { anunakiRaid: { version: 1, state: run, startFingerprint: hash, startResult, actionReceipts: {} } } });
    return startResult;
  });
}
export function actAnunakiRaid(userId: string, id: string, revision: number, actionId: string, action: AnunakiRaidAction, now = new Date()) {
  return db.transaction(async tx => {
    await lockPlayerProfile(tx, userId);
    const [row] = await tx.select().from(playerCollectionClaimsTable).where(and(eq(playerCollectionClaimsTable.clerkUserId, userId), eq(playerCollectionClaimsTable.milestoneKey, prefix + id)));
    const stored = row?.reward.anunakiRaid;
    if (!stored) throw new PlayerRewardError('Raid not found.', 404);
    const hash = fingerprint({ revision, action }); const receipt = stored.actionReceipts[actionId];
    if (receipt) { if (receipt.fingerprint !== hash) throw new PlayerRewardError('This action ID was already used for a different move.', 409); return receipt.result as { eligibility: Awaited<ReturnType<typeof eligibility>>; run: AnunakiRaid }; }
    if (Object.keys(stored.actionReceipts).length >= 128 && action.type !== 'retire') throw new PlayerRewardError('Raid action limit reached. Sync and start a new raid.', 409);
    const current = stored.state as AnunakiRaid;
    if (current.revision !== revision) throw new PlayerRewardError('Your raid changed. Sync to resume.', 409);
    let next: AnunakiRaid; try { next = applyAnunakiRaidAction(current, action); } catch (error) { if (error instanceof AnunakiRaidRuleError) throw new PlayerRewardError(error.message, 409); throw error; }
    if (next.status === 'won' && current.status === 'active' && next.difficulty !== 'training') {
      const [profile] = await tx.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, userId));
      if (!profile) throw new PlayerRewardError('Player profile not found.', 404);
      const firstKey = 'anunaki-raid:first:' + next.difficulty;
      const [first] = await tx.insert(playerCollectionClaimsTable).values({ clerkUserId: userId, milestoneKey: firstKey, reward: { softCurrency: 0 } }).onConflictDoNothing().returning();
      const [weekly] = await tx.insert(playerCollectionClaimsTable).values({ clerkUserId: userId, milestoneKey: `anunaki-raid:weekly:${week(now)}:${next.difficulty}`, reward: { softCurrency: 300, styleShards: 30 } }).onConflictDoNothing().returning();
      const unlocks = first ? next.difficulty === 'standard' ? ['anunaki-raid:cover', 'anunaki-raid:title'] : ['player-mat:anunaki-raid-ascended', 'anunaki-raid:reaction'] : [];
      next.reward = { firstClear: !!first, weekly: !!weekly, packTickets: (first ? 2 : 0) + (weekly ? 1 : 0), softCurrency: weekly ? 300 : 0, styleShards: weekly ? 30 : 0, unlocks };
      await tx.update(playerProfilesTable).set({ unlockedCosmeticIds: [...new Set([...profile.unlockedCosmeticIds, ...unlocks])],
        packTickets: profile.packTickets + (first ? 2 : 0) + (weekly ? 1 : 0), softCurrency: profile.softCurrency + (weekly ? 300 : 0), styleShards: profile.styleShards + (weekly ? 30 : 0), updatedAt: now }).where(eq(playerProfilesTable.clerkUserId, userId));
    }
    const result = { eligibility: await eligibility(tx, userId), run: next };
    await tx.update(playerCollectionClaimsTable).set({ reward: { ...row.reward, anunakiRaid: { ...stored, state: next, actionReceipts: { ...stored.actionReceipts, [actionId]: { fingerprint: hash, revision: next.revision, result } } } } }).where(eq(playerCollectionClaimsTable.id, row.id));
    return result;
  });
}
