import test from "node:test";
import assert from "node:assert/strict";
import {
  createBossCampaign,
  settleBossCampaign,
  bossForm,
  type BossTier,
  createBossRaid,
  applyBossAction,
  bossBlastPreview,
  bossRewards,
  BOSS_NPCS,
  BOSS_HP,
  type BossRaid,
} from "@workspace/squabblemon-engine/bossRaid";
import {
  cards,
  decks,
  catalogCardById,
  engineIdsToCatalogIds,
  validateSavedDeck,
} from "@workspace/squabblemon-engine/data";
import {
  createCardInstance,
  getEffectiveCardPower,
  type Lane,
} from "./gameEngine";
const ids = engineIdsToCatalogIds(decks.find((d) => d.id === "block")!.cards);
const fresh = () => createBossRaid("test-raid", "2026-10-08", ids, "The Block");
const npc = (id: keyof typeof BOSS_NPCS, lane: Lane) => ({
  ...createCardInstance(id, "cpu", "raid-test", 0),
  lane,
  playedRound: 1,
});
const player = (id: string, lane: Lane) => ({
  ...createCardInstance(id, "player", "raid-test", 0),
  lane,
  playedRound: 1,
});
test("boss cards cannot enter player catalog, decks, packs, or player instance creation", () => {
  for (const id of Object.keys(BOSS_NPCS)) {
    assert(!cards[id]);
    assert(!catalogCardById[id]);
    assert.throws(() => createCardInstance(id, "player"), /Unknown/);
    assert.equal(
      validateSavedDeck([id, ...ids.slice(1)], [id, ...ids]).valid,
      false,
    );
  }
});
test("daily shuffle and police deck are identical; normal roster is unchanged", () => {
  const a = fresh(),
    b = createBossRaid("other-id", a.day, ids, "Other");
  assert.deepEqual(a.match.playerCardIds, b.match.playerCardIds);
  assert.deepEqual(a.match.boards, b.match.boards);
  assert.equal(a.hp, BOSS_HP);
  assert.equal(a.match.cpuHand.length, 5);
  assert.equal(new Set(a.match.cpuCardIds).size, 10);
  assert.deepEqual(a.match.cpuCardIds, b.match.cpuCardIds);
  assert.equal(a.match.boards.flat().length, 0);
  assert(cards.oink);
});
test("silence and freeze switch off armor; lane armor cannot consume another lane’s Hands", () => {
  const r = fresh();
  r.match.boards = [
    [{ ...player("hooper", 0), basePower: 10 }, npc("raid-hog", 0)],
    [{ ...player("cornball", 1), basePower: 3 }],
    [],
  ];
  const a = bossBlastPreview(r.match);
  assert.deepEqual(a.armor, [4, 0, 0]);
  assert.equal(a.damage[1], (a.hands[1] + 2) * 3);
  r.match.boards[0][1].statuses.silenced = true;
  assert.equal(bossBlastPreview(r.match).armor[0], 0);
  r.match.boards[0][1].statuses.silenced = false;
  r.match.boards[0][1].statuses.frozen = true;
  assert.equal(bossBlastPreview(r.match).armor[0], 0);
});
test("drone denies a reveal, expires its own silence and does not spend on an illegal play", () => {
  const r = fresh();
  r.match.boards = [[npc("raid-drone", 0)], [], []];
  r.match.playerHand = [createCardInstance("plug", "player", "raid-test", 1)];
  r.match.playerMotion = 6;
  const next = applyBossAction(r, {
    type: "play",
    instanceId: r.match.playerHand[0].instanceId,
    lane: 0,
  });
  assert(
    next.match.boards[0].find((c) => c.owner === "player")!.statuses.silenced,
  );
  assert(!r.match.boards[0].some((c) => c.owner === "player"));
  const ended = applyBossAction(next, { type: "blast" });
  assert(
    !ended.match.boards[0].find((c) => c.owner === "player")!.statuses.silenced,
  );
  assert.throws(() =>
    applyBossAction(next, { type: "play", instanceId: "fake", lane: 0 }),
  );
  assert.equal(next.revision, 1);
});
test("hound punishes cheap spam once per round and protection blocks police damage", () => {
  const r = fresh();
  r.match.boards = [[npc("raid-hound", 0)], [], []];
  r.match.playerHand = ["cornball", "plug"].map((id, i) =>
    createCardInstance(id, "player", "test", i),
  );
  r.match.playerMotion = 9;
  let n = applyBossAction(r, {
    type: "play",
    instanceId: r.match.playerHand[0].instanceId,
    lane: 0,
  });
  assert(n.log.some((s) => s.includes("Follow the Scent")));
  n = applyBossAction(n, {
    type: "play",
    instanceId: n.match.playerHand[0].instanceId,
    lane: 0,
  });
  assert.equal(n.log.filter((s) => s.includes("Follow the Scent")).length, 1);
  const protectedCard = {
    ...player("hooper", 0),
    powerModifier: 5,
    statuses: { ...player("hooper", 0).statuses, protected: true },
  };
  r.match.boards = [
    [protectedCard, npc("raid-ham", 0), npc("raid-hog", 0)],
    [],
    [],
  ];
  const safe = applyBossAction(r, { type: "blast" });
  assert.equal(
    safe.match.boards[0].find((c) => c.owner === "player")!.powerModifier,
    5,
  );
});
test("RICO tax is mandatory only for first deployment; Judge and Ham punish tall buffed cards", () => {
  const r = fresh();
  r.match.boards = [[npc("raid-feds", 0)], [], []];
  r.match.playerHand = [createCardInstance("cornball", "player", "test", 0)];
  r.match.playerMotion = 1;
  assert.throws(
    () =>
      applyBossAction(r, {
        type: "play",
        instanceId: r.match.playerHand[0].instanceId,
        lane: 0,
      }),
    /Motion/,
  );
  r.match.playerMotion = 3;
  const n = applyBossAction(r, {
    type: "play",
    instanceId: r.match.playerHand[0].instanceId,
    lane: 0,
  });
  assert.equal(n.match.playerMotion, 1);
  r.match.boards = [
    [
      { ...player("hooper", 0), basePower: 20, powerModifier: 6 },
      npc("raid-ham", 0),
      npc("raid-judge", 0),
    ],
    [],
    [],
  ];
  const ended = applyBossAction(r, { type: "blast" });
  assert(ended.log.some((s) => s.includes("Asset Forfeiture")));
  assert(ended.log.some((s) => s.includes("Maximum Sentence")));
});
test("Operator locks movement, Protester clears hazards, and Oink suppresses every lane", () => {
  let r = fresh();
  r.match.boards = [
    [npc("raid-protester", 0), { ...player("cornball", 0), hazard: true }],
    [player("hooper", 1), npc("raid-oink", 1)],
    [],
  ];
  r = applyBossAction(r, { type: "blast" });
  assert(!r.match.boards[0].some((c) => c.hazard));
  assert(r.log.some((s) => s.includes("Protection Racket")));
  r.match.round = 2;
  r.match.boards = [
    [player("hooper", 0), npc("raid-operator", 0)],
    [player("cornball", 1)],
    [player("plug", 2)],
  ];
  r = applyBossAction(r, { type: "blast" });
  const operator = r.match.boards
    .flat()
    .find((c) => c.cardId === "raid-operator")!;
  const target = r.match.boards[operator.lane!].find(
    (c) => c.owner === "player",
  );
  assert.equal(target?.squabblehouseCannotMoveThroughRound, 3);
});
test("Mary Mack round end and delayed elephant return happen through native card engine", () => {
  const r = fresh();
  r.match.boards = [
    [player("ms-mary-mack", 0), npc("raid-hound", 0), npc("raid-ham", 0)],
    [npc("raid-operator", 1), npc("raid-feds", 1)],
    [npc("raid-judge", 2)],
  ];
  const next = applyBossAction(r, { type: "blast" }),
    mary = next.match.boards.flat().find((c) => c.cardId === "ms-mary-mack")!;
  assert.equal(mary.maryElephant, true);
  assert.equal(mary.cost, 4);
  assert.equal(mary.basePower, 4);
  assert.equal(
    next.blasts[0].hands.reduce((a, b) => a + b, 0),
    0,
    "disappeared Mary does not fire in the charging round",
  );
});
test("six rounds end cleanly, score is real HP damage, tiers are cumulative and terminal actions reject", () => {
  let r = fresh();
  for (let i = 0; i < 6; i++) r = applyBossAction(r, { type: "blast" });
  assert.equal(r.phase, "complete");
  assert.equal(r.blasts.length, 6);
  assert.equal(r.hp, BOSS_HP);
  assert.throws(() => applyBossAction(r, { type: "blast" }), /ended/);
  assert.deepEqual(bossRewards(r), {
    softCurrency: 0,
    packTickets: 0,
    styleShards: 0,
  });
  r = fresh();
  r.hp = 3;
  r.match.boards = [[{ ...player("hooper", 0), basePower: 200 }], [], []];
  r = applyBossAction(r, { type: "blast" });
  assert.equal(r.hp, 0);
  assert.equal(r.score, 3);
  assert.equal(r.blasts[0].total, 3);
  assert.equal(r.phase, "complete");
  assert.deepEqual(bossRewards({ ...r, score: 160 }), {
    softCurrency: 350,
    packTickets: 5,
    styleShards: 50,
  });
});

test("surveillance expires before native next-round guards refresh", () => {
  const r = fresh();
  r.match.boards = [[npc("raid-drone", 0)], [], []];
  r.match.playerHand = [createCardInstance("wifey", "player", "test", 8)];
  r.match.playerMotion = 9;
  const deployed = applyBossAction(r, {
    type: "play",
    instanceId: r.match.playerHand[0].instanceId,
    lane: 0,
  });
  assert(
    deployed.match.boards[0].find((c) => c.owner === "player")!.statuses
      .silenced,
  );
  const ended = applyBossAction(deployed, { type: "blast" });
  assert(
    ended.match.boards[0].find((c) => c.owner === "player")!.statuses.protected,
  );
});

test("persistent campaign keeps damage across days and pays each tier only on defeat", () => {
  let c = createBossCampaign();
  for (const tier of [1, 2, 3, 4, 5] as BossTier[]) {
    let r = createBossRaid("attack", "2026-10-08", ids, "crew", {
      tier,
      hp: c.hp,
    });
    r.match.boards = [[{ ...player("hooper", 0), basePower: 20 }], [], []];
    const next = applyBossAction(r, { type: "blast" }),
      saved = settleBossCampaign(c, r, next);
    assert.equal(saved.campaign.hp, c.hp - next.score);
    assert.equal(saved.reward.packTickets, 0);
    c = saved.campaign;
    const tomorrow = createBossRaid("tomorrow", "2026-10-09", ids, "crew", {
      tier,
      hp: c.hp,
    });
    assert.equal(tomorrow.hp, next.hp);
    assert.equal(tomorrow.score, 0);
    tomorrow.match.boards = [
      [{ ...player("hooper", 0), basePower: 10000 }],
      [],
      [],
    ];
    const killed = applyBossAction(tomorrow, { type: "blast" }),
      settled = settleBossCampaign(c, tomorrow, killed);
    assert.deepEqual(settled.reward, bossForm(tier).reward);
    assert.equal(killed.score, tomorrow.hp);
    assert.equal(killed.blasts.at(-1)!.damage.reduce((a, b) => a + b, 0), killed.blasts.at(-1)!.total);
    assert.throws(
      () => settleBossCampaign(settled.campaign, tomorrow, killed),
      /Campaign changed/,
    );
    c = settled.campaign;
    assert(c.defeated.includes(tier));
    assert.equal(c.hp, tier === 5 ? 0 : bossForm((tier + 1) as BossTier).hp);
  }
  assert.equal(c.completed, true);
  assert.equal(c.defeated.length, 5);
});
test("police play a legal Motion turn, retain cards and draw instead of spawning reinforcements", () => {
  const r = fresh();
  r.match.cpuHand = [createCardInstance("raid-hound", "cpu", "boss-raid", 0)];
  const budget = r.match.cpuMotion;
  const next = applyBossAction(r, { type: "blast" });
  const resolution = next.blasts[0];
  assert(resolution.policePlays.length > 0);
  assert(resolution.policePlays.reduce((sum, p) => sum + p.cost, 0) <= budget);
  assert.equal(next.match.cpuDrawIndex, 6);
  assert.equal(next.match.cpuHand.length, 2 - resolution.policePlays.length);
  assert(resolution.boards.flat().some(c => c.owner === "cpu"));
  assert.equal(r.match.boards.flat().length, 0, "input is immutable");
  assert.equal(next.match.phase, "player");
});
test("lane outcomes determine attack strength and police Hands reduce a lost lane's attack", () => {
  const r = fresh();
  r.match.boards = [[{ ...player("hooper", 0), basePower: 12 }], [], []];
  const clear = bossBlastPreview(r.match);
  r.match.boards[0].push({ ...npc("raid-backup", 0), basePower: 15 });
  const lost = bossBlastPreview(r.match);
  assert.equal(clear.winners[0], "player");
  assert.equal(lost.winners[0], "cpu");
  assert(lost.damage[0] < clear.damage[0]);
  assert.equal(lost.policeHands[0], 15);
});

test("police can play ordinary cards gifted by native abilities", () => {
  const r = fresh();
  r.match.cpuHand = [createCardInstance("cornball", "cpu", "gift", 0)];
  const n = applyBossAction(r, { type: "blast" });
  assert(n.blasts[0].policePlays.some(p => p.name === "Cornball"));

});
