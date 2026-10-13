import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  db,
  communityDecksTable as decks,
  communityDeckVotesTable as votes,
  playerProfilesTable as profiles,
  socialIdentitiesTable as identities,
} from "@workspace/db";
import {
  starterRecipes,
  validateSavedDeck,
} from "@workspace/squabblemon-engine/data";
import { eventWeek } from "@workspace/squabblemon-engine/activities";
import { OnlineError } from "@workspace/squabblemon-engine/multiplayer";

export function communityWeek(now = new Date()) {
  return eventWeek(now);
}
export async function communityDeckFeed(
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
export async function submitCommunityDeck(
  userId: string,
  input: { deckId: string; strategy: string },
  now = new Date(),
  offset = 0,
) {
  const strategy = input.strategy.trim();
  if (
    !strategy ||
    strategy.length > 280 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(strategy)
  )
    throw new OnlineError("Explain your crew in 1–280 characters.");
  await db.transaction(async (tx) => {
    const [profile] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.clerkUserId, userId))
      .for("update");
    if (!profile || profile.onboardingStep !== "complete")
      throw new OnlineError(
        "Finish your starter journey before submitting a crew.",
        403,
      );
    const saved = profile.savedDecks.find((deck) => deck.id === input.deckId);
    const recipe = starterRecipes.find((deck) => deck.id === input.deckId);
    const cardIds = saved?.cardIds ?? recipe?.catalogCardIds ?? [];
    const heroCardId = saved?.heroCardId ?? recipe?.hero ?? cardIds[0];
    if (!validateSavedDeck(cardIds, profile.ownedCardIds, heroCardId).valid)
      throw new OnlineError("Submit a legal ten-card deck you own.");
    const name = (saved?.name ?? recipe?.name ?? "").trim().slice(0, 60);
    if (!name) throw new OnlineError("Name your deck first.");
    await tx
      .insert(decks)
      .values({
        clerkUserId: userId,
        week: communityWeek(now),
        name,
        strategy,
        cardIds: [...cardIds],
        heroCardId,
        createdAt: now,
      })
      .onConflictDoNothing();
  });
  return communityDeckFeed(userId, now, offset);
}
export async function voteCommunityDeck(
  userId: string,
  deckId: string,
  now = new Date(),
  offset = 0,
) {
  await db.transaction(async (tx) => {
    // The deck lock serializes votes with removal and keeps the author check authoritative.
    const [deck] = await tx
      .select()
      .from(decks)
      .where(eq(decks.id, deckId))
      .for("update");
    if (!deck) throw new OnlineError("Crew not found.", 404);
    if (deck.week !== communityWeek(now))
      throw new OnlineError("Voting for this week has closed.", 409);
    if (deck.clerkUserId === userId)
      throw new OnlineError("Vote for another player’s crew.");
    const [profile] = await tx
      .select({ step: profiles.onboardingStep })
      .from(profiles)
      .where(eq(profiles.clerkUserId, userId));
    if (profile?.step !== "complete")
      throw new OnlineError("Finish your starter journey to vote.", 403);
    await tx
      .insert(votes)
      .values({ deckId, clerkUserId: userId, createdAt: now })
      .onConflictDoNothing();
  });
  return communityDeckFeed(userId, now, offset);
}

export async function communityDeckArchive(userId: string, now = new Date()) {
  const weeks = await Promise.all(
    [1, 2, 3, 4].map(async (ago) => {
      const feed = await communityDeckFeed(
        userId,
        new Date(now.getTime() - ago * 7 * 86400000),
      );
      return { week: feed.week, picks: feed.weeklyPicks };
    }),
  );
  return { weeks: weeks.filter((entry) => entry.picks.length) };
}
