/** Frozen main 56f48cd feed for independent archive SQL/response regression tests. */
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, communityDecksTable as decks, communityDeckVotesTable as votes,
  playerProfilesTable as profiles, socialIdentitiesTable as identities } from "@workspace/db";
import { eventWeek } from "@workspace/squabblemon-engine/activities";

export function communityWeek(now = new Date()) {
  return eventWeek(now);
}
export async function communityDeckFeedReference(
  userId: string,
  now = new Date(),
  offset = 0,
) {
  const week = communityWeek(now),
    previousWeek = communityWeek(new Date(now.getTime() - 7 * 86400000));
  const list = async (targetWeek: string, limit: number, pageOffset = 0) => {
    const rows = await db
      .select({
        id: decks.id,
        week: decks.week,
        name: decks.name,
        strategy: decks.strategy,
        cardIds: decks.cardIds,
        heroCardId: decks.heroCardId,
        author: profiles.displayName,
        avatarKey: profiles.avatarKey,
        friendCode: identities.friendCode,
        createdAt: decks.createdAt,
        isOwn: sql<boolean>`${decks.clerkUserId} = ${userId}`,
        votes: sql<number>`(select count(*)::int from ${votes} where ${votes.deckId} = ${decks.id})`,
        voted: sql<boolean>`exists(select 1 from ${votes} where ${votes.deckId} = ${decks.id} and ${votes.clerkUserId} = ${userId})`,
      })
      .from(decks)
      .innerJoin(profiles, eq(profiles.clerkUserId, decks.clerkUserId))
      .leftJoin(identities, eq(identities.userId, decks.clerkUserId))
      .where(eq(decks.week, targetWeek))
      .orderBy(
        desc(
          sql`(select count(*) from ${votes} where ${votes.deckId} = ${decks.id})`,
        ),
        asc(decks.createdAt),
        asc(decks.id),
      )
      .limit(limit)
      .offset(pageOffset);
    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    }));
  };
  const [submissions, weeklyPicks, own, counts] = await Promise.all([
    list(week, 40, offset),
    list(previousWeek, 3),
    db
      .select({ id: decks.id })
      .from(decks)
      .where(and(eq(decks.week, week), eq(decks.clerkUserId, userId)))
      .limit(1),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(decks)
      .where(eq(decks.week, week)),
  ]);
  const total = counts[0]?.count ?? 0;
  return {
    week,
    previousWeek,
    submissions,
    weeklyPicks,
    offset,
    total,
    nextOffset:
      offset + submissions.length < total ? offset + submissions.length : null,
    submitted: own.length > 0,
    selectionRule:
      "Last week’s three most voted crews. Ties go to the earliest submission. Voting closes Monday at 00:00 UTC.",
  };
}
