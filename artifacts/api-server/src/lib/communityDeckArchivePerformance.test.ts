import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { inArray } from "drizzle-orm";
import { NoopLogger } from "drizzle-orm/logger";
import {
  db,
  playerProfilesTable as profiles,
  socialIdentitiesTable as identities,
  communityDecksTable as decks,
  communityDeckVotesTable as votes,
} from "@workspace/db";
import { starterRecipes } from "@workspace/squabblemon-engine/data";
import { communityDeckArchive, communityWeek } from "./communityDecks";

import { communityDeckFeedReference } from "./communityDeckFeedReference.fixture";

type Query = { text: string; params: unknown[] };
const DAY = 86400000;

/** The previous archive implementation, composed from the frozen main feed. */
async function referenceArchive(userId: string, now: Date) {
  const weeks = await Promise.all([1, 2, 3, 4].map(async ago => {
    const feed = await communityDeckFeedReference(userId, new Date(now.getTime() - ago * 7 * DAY));
    return { week: feed.week, picks: feed.weeklyPicks };
  }));
  return { weeks: weeks.filter(entry => entry.picks.length) };
}

test("archive preserves personalized ranked picks and week labels with 16 -> 4 SQL reads", async t => {
  const users = Array.from({ length: 7 }, () => `archive-perf-${randomUUID()}`);
  const now = new Date("2026-10-19T00:00:00.000Z");
  const recipe = starterRecipes[0]!;
  t.after(async () => {
    await db.delete(profiles).where(inArray(profiles.clerkUserId, users));
  });
  await db.insert(profiles).values(users.map((clerkUserId, index) => ({
    clerkUserId, displayName: `Archive player ${index}`, avatarKey: "cornball",
  })));
  await db.insert(identities).values({
    userId: users[0]!,
    friendCode: randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase(),
  });
  const topIdsByWeek = new Map<string, string[]>();
  for (let ago = 0; ago <= 7; ago++) {
    if (ago === 3) continue; // Empty source weeks are omitted, not relabeled.
    const week = communityWeek(new Date(now.getTime() - ago * 7 * DAY));
    const createdAt = new Date(`${week}T12:00:00.000Z`);
    const ids = Array.from({ length: 5 }, () => randomUUID());
    await db.insert(decks).values(ids.map((id, index) => ({
      id, clerkUserId: users[index]!, week, name: `Crew ${index}`, strategy: `Plan ${index}`,
      cardIds: [...recipe.catalogCardIds], heroCardId: recipe.hero,
      createdAt: new Date(createdAt.getTime() + (index === 2 ? 1_000 : 0)),
    })));
    for (let index = 0; index < ids.length; index++) {
      const count = [2, 2, 2, 0, 3][index]!;
      if (count) await db.insert(votes).values(
        [users[6]!, users[5]!, users[0]!].slice(0, count).map(clerkUserId => ({
          deckId: ids[index]!, clerkUserId,
        })),
      );
    }
    topIdsByWeek.set(week, [ids[4]!, ...[ids[0]!, ids[1]!].sort()]);
  }
  const queries: Query[] = [];
  t.mock.method(NoopLogger.prototype, "logQuery", (...args: unknown[]) => {
    queries.push({ text: String(args[0]), params: args[1] as unknown[] });
  });
  for (const at of [
    now,
    new Date(now.getTime() - 1),
    new Date(now.getTime() + 6 * DAY + 86_399_999),
    new Date("2027-01-04T00:00:00.000Z"),
  ]) {
    for (const userId of [users[0]!, users[6]!]) {
      queries.length = 0;
      const expected = await referenceArchive(userId, at);
      const beforeQueries = [...queries];
      assert.equal(beforeQueries.length, 16);
      queries.length = 0;
      const actual = await communityDeckArchive(userId, at);
      const afterQueries = [...queries];
      assert.deepEqual(actual, expected);
      assert.equal(JSON.stringify(actual), JSON.stringify(expected));
      assert.equal(afterQueries.length, 4);
      assert(afterQueries.every(query => /^select /i.test(query.text)));
      const oldPickQueries = beforeQueries.filter(query => query.params.at(-1) === 3);
      assert.equal(oldPickQueries.length, 4);
      assert.deepEqual(afterQueries, oldPickQueries, "pick SQL, parameters, personalization and ordering are unchanged");
      for (const entry of actual.weeks) {
        assert.equal(entry.picks.length, 3);
        assert.deepEqual(entry.picks.map(pick => pick.id), topIdsByWeek.get(entry.picks[0]!.week));
        assert.equal(entry.week, communityWeek(new Date(Date.parse(entry.picks[0]!.week) + 7 * DAY)));
        assert(entry.picks.every(pick => typeof pick.createdAt === "string"));
        assert(entry.picks.every(pick => pick.voted === (userId === users[6] || pick.name === "Crew 4")));
        assert.equal(entry.picks.filter(pick => pick.isOwn).length, userId === users[0] ? 1 : 0);
      }
    }
  }
  t.diagnostic("Archive: 16 -> 4 SELECT statements (75% fewer); exact top-three SQL and complete JSON match across viewers, empty weeks, Monday rollover and year rollover.");
});
