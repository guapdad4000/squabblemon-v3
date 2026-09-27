import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { accountLevelFromXp, battleEarnings, economyVersionFromSnapshot, LEGACY_ECONOMY_VERSION } from "@workspace/squabblemon-engine/economy";
import { CARD_XP_CAP, cardLevelFromXp, normalizeCardProgress, totalXpForCardLevel } from "@workspace/squabblemon-engine/cardProgression";
import { createAbilityUpgradeSnapshot } from "@workspace/squabblemon-engine/abilityUpgrades";
import { accountRewardStatus, LEVEL_MILESTONE_REWARD } from "@workspace/squabblemon-engine/accountRewards";
import { decks } from "@workspace/squabblemon-engine/data";
import { applyOnlineCommand, awardRank, createOnlineRoom, expireOnlineRoom, joinOnlineRoom, rankedStats, type OnlineMember } from "@workspace/squabblemon-engine/multiplayer";

const NOW = 1_800_000_000_000;
function member(index: number): OnlineMember {
  const deck = decks[index];
  return {
    userId: `fixture-${index}`, name: `Fixture ${index}`, ready: false,
    level: 100, streetRep: 100_000,
    deck: { id: deck.id, name: deck.name, hero: deck.cards[0], cards: [...deck.cards] },
  };
}
function activeRoom() {
  let room = joinOnlineRoom(createOnlineRoom(member(0), "player", NOW), member(1), NOW);
  room = applyOnlineCommand(room, "player", { type: "ready" }, NOW);
  return applyOnlineCommand(room, "cpu", { type: "ready" }, NOW);
}

test("account XP and card XP use different thresholds and only card XP is capped", () => {
  const thresholds = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500];
  thresholds.forEach((xp, index) => {
    assert.equal(totalXpForCardLevel(index + 1), xp);
    assert.equal(cardLevelFromXp(xp), index + 1);
    if (index > 0) assert.equal(cardLevelFromXp(xp - 1), index);
  });
  assert.equal(CARD_XP_CAP, 4500);
  assert.equal(cardLevelFromXp(999_999), 10);
  assert.equal(normalizeCardProgress({ xp: 999_999 }).xp, 4500);
  assert.equal(accountLevelFromXp(249), 1);
  assert.equal(accountLevelFromXp(250), 2);
  assert.equal(accountLevelFromXp(4500), 19);
  assert.equal(accountLevelFromXp(250_000), 1001);
  assert.equal(accountLevelFromXp(-1), 1);
});

test("account level milestones unlock claimable wallet rewards, not card move tiers", () => {
  const now = new Date(NOW), created = new Date(NOW - 30 * 86400000);
  const milestones = (level: number) => accountRewardStatus(level, created, [], now).pending.filter(r => r.key.startsWith("level:"));
  assert.deepEqual(milestones(9), []);
  assert.deepEqual(milestones(20).map(r => r.key), ["level:10", "level:20"]);
  assert.deepEqual(LEVEL_MILESTONE_REWARD, { softCurrency: 250, packTickets: 1, styleShards: 50 });
  const receipts = milestones(20);
  assert.equal(accountRewardStatus(20, created, receipts, now).pending.filter(r => r.key.startsWith("level:")).length, 0);
});

test("legacy economy and progression remain distinct from explicit untrained snapshots", () => {
  assert.equal(economyVersionFromSnapshot(null), LEGACY_ECONOMY_VERSION);
  assert.equal(battleEarnings("win", economyVersionFromSnapshot(null)).softCurrency, 40);
  assert.equal(battleEarnings("win").softCurrency, 80);
  const cardId = decks[0].cards[0];
  const legacy = createAbilityUpgradeSnapshot([cardId], [], { player: { [cardId]: { xp: 2800, level: 8 } } });
  const current = createAbilityUpgradeSnapshot([cardId], [], { player: { [cardId]: { xp: 2800, level: 8, moveTier: 0 } } });
  assert.equal(legacy.player[0].upgradeIds.length, 3);
  assert.equal(current.player[0].upgradeIds.length, 0);
  assert.equal(normalizeCardProgress({ xp: 100, level: 10, moveTier: 3 }).moveTier, 1);
});

test("pure online creation normalizes both sides regardless of displayed account level and Rep", () => {
  const room = activeRoom();
  assert.equal(room.status, "active");
  for (const side of ["player", "cpu"] as const) {
    assert.equal(room.match!.abilityUpgradeSnapshot[side].length, 10);
    for (const entry of room.match!.abilityUpgradeSnapshot[side]) {
      assert.equal(entry.level, 1);
      assert.equal(entry.moveTier, 0);
      assert.deepEqual(entry.upgradeIds, []);
    }
  }
});

test("pure rank rules accept immediate active surrender and timeout; waiting surrender is not complete", () => {
  const room = activeRoom();
  assert.equal(room.turnsEnded, 0);
  const surrendered = applyOnlineCommand(room, "player", { type: "surrender" }, NOW);
  assert.equal(surrendered.status, "complete");
  assert.equal(surrendered.winner, "cpu");
  assert.equal(awardRank(rankedStats({ points: 100 }), "loss", 1000, false).result.delta, -15);
  assert.equal(awardRank(rankedStats({}), "win", 1000, false).result.delta, 25);
  const timedOut = expireOnlineRoom(room, room.deadline!);
  assert.equal(timedOut.reason, "timeout");
  assert.equal(timedOut.winner, "cpu");
  assert.equal(applyOnlineCommand(createOnlineRoom(member(0), "player", NOW), "player", { type: "surrender" }, NOW).status, "closed");
  const ranked = { ...surrendered, ranked: { queuedAt: NOW, heartbeatAt: NOW, botAfter: NOW, bot: false, ratings: { player: 1000, cpu: 1000 } } };
  assert.throws(() => applyOnlineCommand(ranked, "player", { type: "rematch" }, NOW), /Return to Fade Park/);
});

test("pure repeated bot wins can reach top rank; point floor and bot draws are explicit", () => {
  let stats = rankedStats({});
  for (let i = 0; i < 184; i++) stats = awardRank(stats, "win", stats.rating, true).stats;
  assert.equal(stats.points, 2208);
  assert.equal(stats.botWins, 184);
  assert.equal(stats.games, 184);
  assert.equal(awardRank(stats, "draw", stats.rating, true).result.delta, 2);
  assert.equal(awardRank(rankedStats({}), "loss", 1000, true).result.delta, 0);
  assert.equal(awardRank(stats, "win", stats.rating, true).result.tier, "Park Royalty");
});

test("SOURCE ASSERTION ONLY: online profile update is rank state plus timestamp, not persistence proof", () => {
  const source = readFileSync(new URL("../../artifacts/api-server/src/lib/onlineMatches.ts", import.meta.url), "utf8");
  const start = source.indexOf("async function settleRankedRoom(");
  const end = source.indexOf("\n/** Bots use", start);
  assert.ok(start >= 0 && end > start, "settlement source boundary must remain identifiable");
  const settlement = source.slice(start, end);
  const profileWrites = source.match(/tx\.update\(playerProfilesTable\)\.set\(/g) ?? [];
  assert.equal(profileWrites.length, 1, "review any new online profile write");
  assert.match(settlement, /if \(!room\.ranked \|\| room\.status !== 'complete' \|\| room\.ranked\.settlement\) return room/);
  assert.match(settlement, /\.set\(\{ storyProgress: \{ \.\.\.profile\.storyProgress, fadePark: award\.stats \}, updatedAt: new Date\(now\) \}\)/);
  assert.doesNotMatch(source, /battleEarnings|applyCardXp|completeStandardMatchReward/);
});