import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, playerCollectionClaimsTable, playerPackOpeningsTable, playerProfilesTable } from '@workspace/db';
import { PULL_SEASON_MILESTONES, pullSeasonCalendar, type PullSeasonProgress, type PullSeasonReward } from '@workspace/squabblemon-engine/packRules';
type Connection = Pick<typeof db, 'select' | 'execute'>;
const keys = (id: string) => PULL_SEASON_MILESTONES.map(milestone => `pull-season:${id}:${milestone.threshold}`);

/** Both predicates use the existing (player,created_at) receipt index; no reward JSON/history hydration. */
export async function getPullSeasonProgress(userId: string, now = Date.now(), connection: Connection = db): Promise<PullSeasonProgress> {
  const season = pullSeasonCalendar(now);
  const result = await connection.execute(sql`
    select coalesce(sum(case
      when ${playerPackOpeningsTable.oddsVersion} like 'street-pack-ten-%' then 10
      when ${playerPackOpeningsTable.oddsVersion} ~ '^street-pack-batch-[2-9]-v1($|:)' then substring(${playerPackOpeningsTable.oddsVersion} from '^street-pack-batch-([2-9])-')::integer
      else 1 end),0)::integer as count
    from ${playerPackOpeningsTable}
    where ${playerPackOpeningsTable.clerkUserId} = ${userId}
      and ${playerPackOpeningsTable.createdAt} >= ${season.startsAt}::timestamptz
      and ${playerPackOpeningsTable.createdAt} < ${season.endsAt}::timestamptz
      and ${playerPackOpeningsTable.oddsVersion} like 'street-pack-%'
      and ${playerPackOpeningsTable.paymentMethod} in ('ticket','softCurrency')`);
  const claims = await connection.select({ key: playerCollectionClaimsTable.milestoneKey }).from(playerCollectionClaimsTable)
    .where(and(eq(playerCollectionClaimsTable.clerkUserId, userId), inArray(playerCollectionClaimsTable.milestoneKey, keys(season.id))));
  const claimed = new Set(claims.map(row => row.key));
  return { ...season, count: Number(result.rows[0]?.count ?? 0), milestones: PULL_SEASON_MILESTONES.map(milestone => ({ ...milestone, seasonId: season.id, claimed: claimed.has(`pull-season:${season.id}:${milestone.threshold}`) })) };
}

export async function recoverPullSeasonRewards(userId: string, openingKey: string, openedAt: Date, connection: Connection = db): Promise<PullSeasonReward[]> {
  const rows = await connection.select({ reward: playerCollectionClaimsTable.reward }).from(playerCollectionClaimsTable)
    .where(and(eq(playerCollectionClaimsTable.clerkUserId, userId), inArray(playerCollectionClaimsTable.milestoneKey, keys(pullSeasonCalendar(openedAt.getTime()).id))));
  return rows.flatMap(({ reward }) => reward.pullSeason?.openingKey === openingKey ? [{ seasonId: reward.pullSeason.seasonId, threshold: reward.pullSeason.threshold, softCurrency: reward.pullSeason.softCurrency, packTickets: reward.pullSeason.packTickets, styleShards: reward.pullSeason.styleShards }] : []).sort((a,b) => a.threshold - b.threshold);
}

/** Caller holds the profile lock and has inserted the successful opening in this transaction. */
export async function grantPullSeasonMilestones(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], userId: string, openingKey: string, now: number) {
  const progress = await getPullSeasonProgress(userId, now, tx);
  const rewards = progress.milestones.filter(milestone => !milestone.claimed && progress.count >= milestone.threshold);
  if (rewards.length) {
    await tx.insert(playerCollectionClaimsTable).values(rewards.map(({ claimed: _, ...reward }) => ({ clerkUserId: userId, milestoneKey: `pull-season:${progress.id}:${reward.threshold}`, reward: { pullSeason: { ...reward, openingKey } } })));
    const total = rewards.reduce((sum, reward) => ({ softCurrency: sum.softCurrency + reward.softCurrency, packTickets: sum.packTickets + reward.packTickets, styleShards: sum.styleShards + reward.styleShards }), { softCurrency: 0, packTickets: 0, styleShards: 0 });
    await tx.update(playerProfilesTable).set({ softCurrency: sql`${playerProfilesTable.softCurrency} + ${total.softCurrency}`, packTickets: sql`${playerProfilesTable.packTickets} + ${total.packTickets}`, styleShards: sql`${playerProfilesTable.styleShards} + ${total.styleShards}` }).where(eq(playerProfilesTable.clerkUserId, userId));
  }
  return { progress: { ...progress, milestones: progress.milestones.map(milestone => ({ ...milestone, claimed: milestone.claimed || progress.count >= milestone.threshold })) }, rewards: rewards.map(({ claimed: _, ...reward }) => reward) };
}
