import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, playerProfilesTable } from "@workspace/db";
import {
  decks,
  engineIdsToCatalogIds,
} from "@workspace/squabblemon-engine/data";
import {
  applyBossAction,
  bossRewards,
  type BossRaid,
  type BossStatus,
} from "@workspace/squabblemon-engine/bossRaid";
import { startBossRaid, actBossRaid, getBossRaid } from "./bossRaid";
import { createApp } from "../app";
import type { AddressInfo } from "node:net";
import type { RequestHandler } from "express";
const ids = engineIdsToCatalogIds(decks.find((d) => d.id === "block")!.cards),
  day = new Date("2026-10-08T12:00:00Z");
async function player(t: test.TestContext) {
  const id = "boss-" + randomUUID();
  await db.insert(playerProfilesTable).values({
    clerkUserId: id,
    ownedCardIds: ids,
    onboardingStep: "complete",
    softCurrency: 0,
    packTickets: 0,
    styleShards: 0,
  });
  t.after(() =>
    db
      .delete(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, id)),
  );
  return id;
}
async function profile(id: string) {
  return (
    await db
      .select()
      .from(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkUserId, id))
  )[0];
}
function choose(run: BossRaid) {
  const plays = run.match.playerHand.flatMap((c) =>
    ([0, 1, 2] as const).flatMap((lane) => {
      try {
        const next = applyBossAction(run, {
          type: "play",
          instanceId: c.instanceId,
          lane,
        });
        return [
          {
            instanceId: c.instanceId,
            lane,
            next,
            value: next.match.boards
              .flat()
              .filter((c) => c.owner === "player")
              .reduce((n, c) => n + c.basePower + c.powerModifier, 0),
          },
        ];
      } catch {
        return [];
      }
    }),
  );
  return plays.sort(
    (a, b) => b.value - a.value || a.instanceId.localeCompare(b.instanceId),
  )[0];
}
test("concurrent starts use one daily entry; rejected decks do not consume entry; reload resumes", async (t) => {
  const user = await player(t);
  await assert.rejects(
    () =>
      startBossRaid(user, randomUUID(), ["raid-oink", ...ids.slice(1)], day),
    /owned/,
  );
  assert.equal((await getBossRaid(user, day)).attemptsRemaining, 1);
  const starts = await Promise.all(
    Array.from({ length: 3 }, () =>
      startBossRaid(user, randomUUID(), ids, day),
    ),
  );
  assert.equal(new Set(starts.map((s) => s.run!.id)).size, 1);
  assert.equal(starts[0].attemptsRemaining, 0);
  assert.deepEqual((await getBossRaid(user, day)).run, starts[0].run);
  const r = starts[0].run!;
  await actBossRaid(
    user,
    r.id,
    r.revision,
    randomUUID(),
    { type: "retire" },
    day,
  );
  await assert.rejects(
    () => startBossRaid(user, randomUUID(), ids, day),
    /entry is used/,
  );
  const tomorrow = new Date("2026-10-09T00:00:00Z");
  assert.equal((await getBossRaid(user, tomorrow)).attemptsRemaining, 1);
  assert.equal(
    (await startBossRaid(user, randomUUID(), ids, tomorrow)).run!.day,
    "2026-10-09",
  );
});
test("real deck plays, blasts and rewards persist; concurrent retries pay once; stale and foreign writes reject", async (t) => {
  const user = await player(t),
    other = await player(t);
  let s = await startBossRaid(user, randomUUID(), ids, day);
  await assert.rejects(
    () =>
      actBossRaid(other, s.run!.id, 0, randomUUID(), { type: "blast" }, day),
    /not found/,
  );
  let counted = 0;
  while (s.run!.phase === "active") {
    const choice = choose(s.run!);
    if (choice) {
      s = await actBossRaid(
        user,
        s.run!.id,
        s.run!.revision,
        randomUUID(),
        { type: "play", instanceId: choice.instanceId, lane: choice.lane },
        day,
      );
      continue;
    }
    const run = s.run!,
      actionId = randomUUID();
    const copies = await Promise.all(
      [0, 1, 2].map(() =>
        actBossRaid(
          user,
          run.id,
          run.revision,
          actionId,
          { type: "blast" },
          day,
        ),
      ),
    );
    s = copies[0];
    assert(copies.every((c) => c.run!.revision === run.revision + 1));
    counted++;
    await assert.rejects(
      () =>
        actBossRaid(
          user,
          run.id,
          run.revision,
          randomUUID(),
          { type: "blast" },
          day,
        ),
      /changed/,
    );
    const p = await profile(user),
      reward = bossRewards(s.run!);
    assert.equal(p.softCurrency, reward.softCurrency);
    assert.equal(p.packTickets, reward.packTickets);
    assert.equal(p.styleShards, reward.styleShards);
    assert.deepEqual(p.ownedCardIds, ids);
  }
  assert.equal(counted, 6);
  assert(s.run!.score >= 20, "real beginner crew earns a meaningful tier");
  assert.equal(s.bestScore, s.run!.score);
  assert.deepEqual((await getBossRaid(user, day)).run, s.run);
  assert.equal((await profile(other)).softCurrency, 0);
});
const brand = Symbol.for("@clerk/express.auth");
function auth(userId: string | null): RequestHandler {
  return (req, _res, next) => {
    const a = () => ({
      userId,
      isAuthenticated: !!userId,
      tokenType: "session_token",
      sessionId: "test",
      sessionClaims: { sub: userId },
      getToken: async () => null,
      has: () => false,
      debug: () => "",
    });
    Object.assign(a, { [brand]: true });
    Object.assign(req, { auth: a });
    next();
  };
}
async function api(
  userId: string | null,
  run: (base: string) => Promise<void>,
) {
  const server = createApp(auth(userId)).listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    await run(
      `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/player/boss-raid`,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
}
test("authenticated HTTP rejects forged damage and accepts exact start/action contract", async (t) => {
  const user = await player(t);
  await api(null, async (base) =>
    assert.equal((await fetch(base)).status, 401),
  );
  await api(user, async (base) => {
    const post = (path: string, body: unknown) =>
      fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    assert.equal(
      (
        await post(base + "/start", {
          requestId: randomUUID(),
          cardIds: ids,
          score: 160,
        })
      ).status,
      400,
    );
    const start = await post(base + "/start", {
      requestId: randomUUID(),
      cardIds: ids,
    });
    assert.equal(start.status, 200);
    const s = (await start.json()) as BossStatus;
    assert.equal(
      (
        await post(`${base}/${s.run!.id}/action`, {
          revision: 0,
          actionId: randomUUID(),
          action: { type: "blast", damage: 160 },
        })
      ).status,
      400,
    );
    const response = await post(`${base}/${s.run!.id}/action`, {
      revision: 0,
      actionId: randomUUID(),
      action: { type: "blast" },
    });
    assert.equal(response.status, 200);
    assert.equal(
      ((await response.json()) as BossStatus).run!.blasts[0].total,
      0,
    );
  });
});

test("daily attacks retain HP across days; a tier clear advances once and banks its bounty atomically", async (t) => {
  const user = await player(t);
  let wallet = { softCurrency: 0, packTickets: 0, styleShards: 0 },
    cleared = false;
  for (let offset = 0; offset < 20 && !cleared; offset++) {
    const now = new Date(Date.UTC(2026, 9, 8 + offset, 12));
    const before = await getBossRaid(user, now);
    let s = await startBossRaid(user, randomUUID(), ids, now);
    assert.equal(s.run!.startHp, before.campaign.hp);
    assert.equal(s.campaign.attacks, offset + 1);
    assert.equal(s.run!.bossTier, 1);
    while (s.run!.phase === "active") {
      const choice = choose(s.run!),
        old = s.run!,
        actionId = randomUUID();
      const action = choice
        ? {
            type: "play" as const,
            instanceId: choice.instanceId,
            lane: choice.lane,
          }
        : { type: "blast" as const };
      const copies = await Promise.all(
        [0, 1].map(() =>
          actBossRaid(user, old.id, old.revision, actionId, action, now),
        ),
      );
      s = copies[0];
      assert.deepEqual(copies[0].campaign, copies[1].campaign);
    }
    const reward = bossRewards(s.run!);
    wallet.softCurrency += reward.softCurrency;
    wallet.packTickets += reward.packTickets;
    wallet.styleShards += reward.styleShards;
    cleared = s.run!.hp === 0;
    if (cleared) {
      wallet.softCurrency += 500;
      wallet.packTickets += 5;
      wallet.styleShards += 50;
      assert.equal(s.campaign.tier, 2);
      assert.deepEqual(s.campaign.defeated, [1]);
    }
    const p = await profile(user);
    for (const key of ["softCurrency", "packTickets", "styleShards"] as const)
      assert.equal(p[key], wallet[key]);
    assert.deepEqual(s.campaign.earned, wallet);
    assert.deepEqual((await getBossRaid(user, now)).campaign, s.campaign);
    assert.equal(s.attemptsRemaining, 0);
  }
  assert(cleared, "existing block deck can clear persistent tier");
});
