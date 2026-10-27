import { generateStreetPack } from "./collectionEconomy";
import { cardCatalog } from "@workspace/squabblemon-engine/data";
import assert from "node:assert/strict";
import test from "node:test";
import { kumiteMastery } from "./kumiteMastery";
import type { CollectionRoadRewardRecord } from "@workspace/db";
const row = (key: string, reward: CollectionRoadRewardRecord) => ({
  key,
  reward,
});
test("legacy wins and Precinct raids cannot forge a fighter-specific Kumite art or quest unlock", () => {
  const result = kumiteMastery(
    [
      row("kumite:win:old", {
        kumite: { tournamentId: "t", matchId: "m", at: 1, event: "win" },
      }),
      row("boss-campaign:v2", {
        bossCampaign: { version: 2, state: { defeated: [1, 2, 3, 4, 5] } },
      }),
    ],
    [],
  );
  for (const fighter of result) {
    assert.equal(fighter.dojoCleared, false);
    assert.equal(fighter.weeklyWin, false);
    assert.ok(fighter.quests.every((q) => !q.complete));
  }
});
test("only recorded crew wins and Dojo tier facts qualify, with stable once-only quest keys", () => {
  const rows = [
    row("boss-campaign:kumite:v2", {
      bossCampaign: { version: 2, state: { defeated: [1, 2, 3, 4, 5] } },
    }),
    row("kumite:win:t:m", {
      kumite: {
        tournamentId: "t",
        matchId: "m",
        event: "win",
        at: 1,
        crew: ["leroy"],
        sweep: true,
      },
    }),
    row("kumite:quest:leroy:sweep:v1", {
      kumiteQuest: { cardId: "leroy", styleShards: 20 },
    }),
  ];
  const a = kumiteMastery(rows, ["leroy:kumite-alt-v1"]);
  const leroy = a.find((m) => m.cardId === "leroy")!;
  assert.ok(leroy.dojoCleared && leroy.weeklyWin && leroy.altOwned);
  assert.ok(leroy.quests[0].complete && leroy.quests[0].claimed);
  assert.equal(a.find((m) => m.cardId === "sho-nuff")!.weeklyWin, false);
  assert.deepEqual(a, kumiteMastery(rows, ["leroy:kumite-alt-v1"]));
});

test("pack bonuses never contain mastery art even after every ordinary variant is exhausted", () => {
  const all = cardCatalog.map((c) => c.catalogId),
    normal = cardCatalog.flatMap((c) =>
      c.variantSlots.filter((v) => !v.progressionOnly).map((v) => v.id),
    );
  for (const rand of [(n: number) => 0, (n: number) => n - 1]) {
    const pack = generateStreetPack(
      {
        ownedCardIds: all,
        discoveredCardIds: all,
        ownedVariants: normal,
        pity: 9,
      },
      rand,
    );
    assert.ok(
      pack.rewards.every((r) => !r.variantId?.endsWith(":kumite-alt-v1")),
    );
  }
});

test("damage and Glo quests require the correct Dojo tier, owner and deployed fighter", async () => {
  const { createBossRaid } =
    await import("@workspace/squabblemon-engine/bossRaid");
  const { createCardInstance } =
    await import("@workspace/squabblemon-engine/gameEngine");
  const { decks, engineIdsToCatalogIds } =
    await import("@workspace/squabblemon-engine/data");
  const crew = [
    "leroy",
    ...engineIdsToCatalogIds(decks.find((d) => d.id === "block")!.cards)
      .filter((id) => id !== "leroy")
      .slice(0, 9),
  ];
  const run = createBossRaid(
    "recorded-dojo",
    "2026-10-26",
    crew,
    "Crew",
    { tier: 3, hp: 1575 },
    "kumite",
  );
  const glo = {
    ...createCardInstance("leroy", "player", "quest", 0),
    lane: 0 as const,
    basePower: 10,
  };
  const raid = {
    ...run,
    phase: "complete" as const,
    score: 35,
    blasts: [{ boards: [[glo], [], []] }],
  };
  const facts = (value: unknown) =>
    kumiteMastery(
      [
        row("boss-raid:kumite:v2:2026-10-26", {
          bossRaid: {
            version: 1,
            runId: run.id,
            day: run.day,
            state: value,
            earned: { softCurrency: 0, packTickets: 0, styleShards: 0 },
          },
        }),
      ],
      [],
    ).find((f) => f.cardId === "leroy")!.quests;
  assert.equal(facts(raid)[1].complete, true);
  assert.equal(facts(raid)[2].complete, true);
  assert.equal(facts({ ...raid, bossTier: 2 })[1].complete, false);
  assert.equal(facts({ ...raid, score: 34 })[1].complete, false);
  assert.equal(
    facts({
      ...raid,
      blasts: [{ boards: [[{ ...glo, owner: "cpu" }], [], []] }],
    })[2].complete,
    false,
  );
  assert.equal(
    facts({
      ...raid,
      match: {
        ...raid.match,
        playerCardIds: crew.filter((id) => id !== "leroy"),
      },
    })[2].complete,
    false,
  );
});
