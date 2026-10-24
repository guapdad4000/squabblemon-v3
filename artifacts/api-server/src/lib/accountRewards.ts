import { randomInt } from 'node:crypto';
import { cardCatalog } from '@workspace/squabblemon-engine/data';
import { choosePackCardFromTier, type PackRandomInt } from '@workspace/squabblemon-engine/packRules';
import { addStyleShardBalances, STYLE_SHARD_TIERS, styleShardRarityForCard, totalStyleShardRewards } from '@workspace/squabblemon-engine/styleShards';
import { isStreetPackCard } from './collectionEconomy';
import { and, eq, like, sql } from "drizzle-orm";
import {
  db,
  playerCollectionClaimsTable,
  playerProfilesTable,
  playerMissionsTable,
} from "@workspace/db";
import {
  accountRewardStatus,
  growthLabStatus,
  GROWTH_GARDEN_SIZE,
  GROWTH_BUDDY_CYCLES,
  GROWTH_GARDEN_REWARD,
  type AccountRewardGrant,
} from "@workspace/squabblemon-engine/accountRewards";
import { lockPlayerProfile } from "./playerRewardTransactions";

export async function getAccountRewards(clerkUserId: string, now = new Date()) {
  const [profile] = await db
    .select({
      level: playerProfilesTable.level,
      createdAt: playerProfilesTable.createdAt,
      growthDaily: sql<unknown>`${playerProfilesTable.storyProgress}->'growthDaily'`,
    })
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
  if (!profile) throw new Error("Player profile not found");
  const receipts = await db
    .select()
    .from(playerCollectionClaimsTable)
    .where(
      and(
        eq(playerCollectionClaimsTable.clerkUserId, clerkUserId),
        like(playerCollectionClaimsTable.milestoneKey, "account:%"),
      ),
    );
  return accountRewardStatus(
    profile.level,
    profile.createdAt,
    receipts.flatMap((r) =>
      r.reward.accountReward ? [r.reward.accountReward] : [],
    ),
    now,
    await db.select().from(playerMissionsTable).where(eq(playerMissionsTable.clerkUserId, clerkUserId)),
    profile.growthDaily,
  );
}

/** One watering per UTC day. The same profile lock serializes battles, claims, and garden bonuses. */
export async function waterGrowthLab(clerkUserId: string, now = new Date()): Promise<AccountRewardGrant[]> {
  return db.transaction(async tx => {
    await lockPlayerProfile(tx, clerkUserId);
    const [profile] = await tx.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkUserId, clerkUserId));
    if (!profile) throw new Error('Player profile not found');
    const rows = await tx.select().from(playerCollectionClaimsTable).where(and(eq(playerCollectionClaimsTable.clerkUserId, clerkUserId), like(playerCollectionClaimsTable.milestoneKey, 'account:%')));
    const receipts = rows.flatMap(row => row.reward.accountReward ? [row.reward.accountReward] : []);
    const missions = await tx.select().from(playerMissionsTable).where(eq(playerMissionsTable.clerkUserId, clerkUserId));
    const growth = growthLabStatus(receipts, missions, now,profile.storyProgress.growthDaily);
    if (!growth.ready) return [];
    const date = now.toISOString().slice(0, 10);
    const rewards: AccountRewardGrant[] = [{ key: `growth:water:${date}`, title: 'A new plant for your garden', date, softCurrency: 0, packTickets: 0, styleShards: 0 }];
    const totalPlants = growth.totalPlants + 1;
    if (totalPlants % GROWTH_GARDEN_SIZE === 0) rewards.push({ key: `growth:garden:${totalPlants / GROWTH_GARDEN_SIZE}`, title: `Buddy’s garden ${totalPlants / GROWTH_GARDEN_SIZE} complete`, date, ...GROWTH_GARDEN_REWARD });
    if(totalPlants/GROWTH_GARDEN_SIZE>=GROWTH_BUDDY_CYCLES&&!receipts.some(r=>r.key==='growth:buddy'))rewards.push({key:'growth:buddy',title:'Buddy joins your crew',cardId:'buddy',date,softCurrency:0,packTickets:0,styleShards:profile.ownedCardIds.includes('buddy')?25:0});
    for (const reward of rewards) await tx.insert(playerCollectionClaimsTable).values({ clerkUserId, milestoneKey: `account:${reward.key}`, reward: { accountReward: reward } });
    const bonus = rewards.find(reward => reward.key.startsWith('growth:garden:'));
    const recruit=rewards.find(r=>r.cardId);
    if (bonus||recruit) await tx.update(playerProfilesTable).set({ softCurrency: profile.softCurrency + (bonus?.softCurrency??0), packTickets: profile.packTickets + (bonus?.packTickets??0), styleShards: profile.styleShards + (bonus?.styleShards??0)+(recruit?.styleShards??0), ...(recruit?{ownedCardIds:[...new Set([...profile.ownedCardIds,'buddy'])],discoveredCardIds:[...new Set([...profile.discoveredCardIds,'buddy'])],collectionProgress:new Set([...profile.ownedCardIds,'buddy']).size}:{}),updatedAt: now }).where(eq(playerProfilesTable.clerkUserId, clerkUserId));
    return rewards;
  });
}

/** Called only inside the profile transaction. The selected identity is saved in the receipt. */
export function resolveAccountRewardCards(
  pending: readonly AccountRewardGrant[],
  ownedCardIds: readonly string[],
  rng: PackRandomInt = randomInt,
): AccountRewardGrant[] {
  const owned = new Set(ownedCardIds);
  return pending.map(value => {
    const reward = { ...value };
    if (reward.key.startsWith('monthly-login:')) {
      if (!reward.cardRarity) throw new Error('Monthly card tier is missing');
      const card = choosePackCardFromTier({
        rarity: reward.cardRarity,
        tier: cardCatalog.filter(card => card.rarity === reward.cardRarity && isStreetPackCard(card)),
        pulledCardIds: new Set(), ownedCardIds: owned, protectNew: true, rng,
      });
      reward.cardId = card.catalogId;
      reward.cardName = card.name;
      reward.isNewCard = !owned.has(card.catalogId);
      if (!reward.isNewCard) {
        reward.shardRarity = styleShardRarityForCard(card.rarity);
        reward.styleShards = STYLE_SHARD_TIERS[reward.shardRarity].duplicatePayout;
      }
    } else if (reward.cardId) {
      reward.isNewCard = !owned.has(reward.cardId);
      // Preserve the existing universal-shard compensation for the garden recruit.
      if (reward.cardId === 'buddy' && !reward.isNewCard) reward.styleShards = 25;
    }
    if (reward.cardId) owned.add(reward.cardId);
    return reward;
  });
}

export async function claimAccountRewards(
  clerkUserId: string,
  now = new Date(),
): Promise<AccountRewardGrant[]> {
  return db.transaction(async (tx) => {
    await lockPlayerProfile(tx, clerkUserId);
    const [profile] = await tx
      .select()
      .from(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
    if (!profile) throw new Error("Player profile not found");
    const receipts = await tx
      .select()
      .from(playerCollectionClaimsTable)
      .where(
        and(
          eq(playerCollectionClaimsTable.clerkUserId, clerkUserId),
          like(playerCollectionClaimsTable.milestoneKey, "account:%"),
        ),
      );
    const { pending: available } = accountRewardStatus(
      profile.level,
      profile.createdAt,
      receipts.flatMap((r) =>
        r.reward.accountReward ? [r.reward.accountReward] : [],
      ),
      now,
    );
    if (!available.length) return [];
    const pending = resolveAccountRewardCards(available, profile.ownedCardIds);
    const cardIds = pending.flatMap(reward => reward.cardId ? [reward.cardId] : []);
    const ownedCardIds = [...new Set([...profile.ownedCardIds, ...cardIds])];
    const shards = totalStyleShardRewards(pending.map(reward => ({ kind: 'styleShards', amount: reward.styleShards, shardRarity: reward.shardRarity })));
    for (const reward of pending)
      await tx
        .insert(playerCollectionClaimsTable)
        .values({
          clerkUserId,
          milestoneKey: `account:${reward.key}`,
          reward: { accountReward: reward },
        });
    const total = pending.reduce(
      (sum, reward) => ({
        softCurrency: sum.softCurrency + reward.softCurrency,
        packTickets: sum.packTickets + reward.packTickets,
        styleShards: sum.styleShards + reward.styleShards,
      }),
      { softCurrency: 0, packTickets: 0, styleShards: 0 },
    );
    await tx
      .update(playerProfilesTable)
      .set({
        softCurrency: profile.softCurrency + total.softCurrency,
        packTickets: profile.packTickets + total.packTickets,
        styleShards: profile.styleShards + shards.styleShardsGained,
        styleShardBalances: addStyleShardBalances(profile.styleShardBalances, shards.styleShardBalancesGained),
        ...(cardIds.length ? { ownedCardIds, discoveredCardIds: [...new Set([...profile.discoveredCardIds, ...cardIds])], collectionProgress: ownedCardIds.length } : {}),
        updatedAt: now,
      })
      .where(eq(playerProfilesTable.clerkUserId, clerkUserId));
    return pending;
  });
}
