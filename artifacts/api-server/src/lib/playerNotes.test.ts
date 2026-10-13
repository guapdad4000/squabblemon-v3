import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  cardCatalog,
  starterRecipes,
} from "@workspace/squabblemon-engine/data";
import { rankedStats } from "@workspace/squabblemon-engine/ranked";
test(
  "community submission/vote receipts and private global standings",
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    const {
      db,
      pool,
      playerProfilesTable: profiles,
    } = await import("@workspace/db");
    const { eq, inArray } = await import("drizzle-orm");
    const { communityDeckFeed, submitCommunityDeck, voteCommunityDeck } =
      await import("./communityDecks");
    const { rankedStandings } = await import("./rankedStandings");
    const users = Array.from({ length: 5 }, () => `notes-${randomUUID()}`),
      recipe = starterRecipes[0],
      now = new Date("2026-10-12T12:00:00Z");
    await db
      .insert(profiles)
      .values(
        users.map((id, i) => ({
          clerkUserId: id,
          displayName: `Player ${i}`,
          onboardingStep: i === 4 ? "crew" : "complete",
          ownedCardIds: cardCatalog.map((c) => c.catalogId),
          savedDecks: [
            {
              id: "crew",
              name: `CREW ${i}`,
              cardIds: [...recipe.catalogCardIds],
              heroCardId: recipe.hero,
            },
          ],
          storyProgress: {
            fadePark: {
              ...rankedStats(null),
              points: i < 2 ? 350 : i === 2 ? 100 : 0,
              wins: 2,
              games: i === 3 ? 0 : 3,
            },
          },
        })),
      );
    t.after(async () => {
      await db.delete(profiles).where(inArray(profiles.clerkUserId, users));
      await pool.end();
    });
    await t.test(
      "one snapshot per week survives concurrent retries and later edits",
      async () => {
        await Promise.all([
          submitCommunityDeck(
            users[0],
            { deckId: "crew", strategy: "Open cheap, spread, then close." },
            now,
          ),
          submitCommunityDeck(
            users[0],
            { deckId: "crew", strategy: "Retry" },
            now,
          ),
        ]);
        let feed = await communityDeckFeed(users[0], now);
        assert.equal(feed.submissions.length, 1);
        assert(feed.submitted);
        assert(feed.submissions[0].isOwn);
        assert.equal(feed.submissions[0].votes, 0);
        await db
          .update(profiles)
          .set({ savedDecks: [] })
          .where(eq(profiles.clerkUserId, users[0]));
        feed = await communityDeckFeed(users[1], now);
        assert.equal(feed.submissions[0].cardIds.length, 10);
        assert(!feed.submissions[0].isOwn);
        assert(!JSON.stringify(feed).includes(users[0]));
      },
    );
    await t.test(
      "self-votes and starter accounts are rejected; retries count once; past votes close",
      async () => {
        const deck = (await communityDeckFeed(users[1], now)).submissions[0];
        await assert.rejects(
          voteCommunityDeck(users[0], deck.id, now),
          /another player/,
        );
        await assert.rejects(
          voteCommunityDeck(users[4], deck.id, now),
          /starter journey/,
        );
        await Promise.all([
          voteCommunityDeck(users[1], deck.id, now),
          voteCommunityDeck(users[1], deck.id, now),
        ]);
        assert.equal(
          (await communityDeckFeed(users[1], now)).submissions[0].votes,
          1,
        );
        const next = new Date("2026-10-19T00:00:00Z");
        await assert.rejects(
          voteCommunityDeck(users[2], deck.id, next),
          /closed/,
        );
        const feed = await communityDeckFeed(users[2], next);
        assert.equal(feed.weeklyPicks[0].id, deck.id);
        assert.equal(feed.weeklyPicks[0].votes, 1);
        assert.equal(feed.submissions.length, 0);
      },
    );
    await t.test("illegal crews and empty plans are rejected", async () => {
      await assert.rejects(
        submitCommunityDeck(
          users[4],
          { deckId: "crew", strategy: "Plan" },
          now,
        ),
        /starter journey/,
      );
      await assert.rejects(
        submitCommunityDeck(
          users[2],
          { deckId: "missing", strategy: "Plan" },
          now,
        ),
        /legal ten-card/,
      );
      await assert.rejects(
        submitCommunityDeck(users[2], { deckId: "crew", strategy: " " }, now),
        /1–280/,
      );
    });
    await t.test(
      "ties share a rank; unplayed accounts and auth IDs stay out of standings",
      async () => {
        const view = await rankedStandings(users[0]);
        assert.equal(view.you?.position, 1);
        assert.equal(view.total, 3);
        assert.equal(view.leaders.filter((p) => p.position === 1).length, 2);
        assert(!view.leaders.some((p) => p.name === "Player 3"));
        assert.equal(
          view.leaders.find((p) => p.name === "Player 2")?.position,
          2,
        );
        assert(!JSON.stringify(view).includes(users[0]));
      },
    );
    await t.test(
      "weekly skill contracts credit verified events once",
      async () => {
        const { ensurePlayer } = await import("./playerState");
        const { progressBountyEvent } = await import("./legendBountyProgress");
        const { playerMissionsTable: missions } = await import("@workspace/db");
        await ensurePlayer(users[2]);
        for (let retry = 0; retry < 2; retry++)
          await db.transaction(async (tx) => {
            const [profile] = await tx
              .select()
              .from(profiles)
              .where(eq(profiles.clerkUserId, users[2]))
              .for("update");
            const storyProgress = await progressBountyEvent(
              tx,
              profile,
              "notes-skill-proof",
              ["sweep-win", "fire-win", "support-win"],
            );
            await tx
              .update(profiles)
              .set({ storyProgress })
              .where(eq(profiles.clerkUserId, users[2]));
          });
        const tasks = await db
          .select()
          .from(missions)
          .where(eq(missions.clerkUserId, users[2]));
        for (const key of [
          "weekly-wide-win",
          "weekly-fire-crew",
          "weekly-support-crew",
        ])
          assert.equal(
            tasks.find((m) => m.missionKey === key)?.progress,
            1,
            key,
          );
        assert.equal(
          (await communityDeckFeed(users[2], now, 1)).submissions.length,
          0,
          "board offsets do not repeat an earlier submission",
        );
      },
    );
    await t.test(
      "your position survives a tie group larger than the leaderboard",
      async () => {
        const extra = Array.from(
          { length: 25 },
          () => `notes-tie-${randomUUID()}`,
        );
        users.push(...extra);
        await db
          .insert(profiles)
          .values(
            extra.map((id) => ({
              clerkUserId: id,
              onboardingStep: "complete",
              displayName: id,
              storyProgress: {
                fadePark: { ...rankedStats(null), points: 9999, games: 1 },
              },
            })),
          );
        const view = await rankedStandings(users[0]);
        assert.equal(view.leaders.length, 20);
        assert.equal(view.you?.position, 2);
        assert.equal(view.total, 28);
      },
    );
  },
);
