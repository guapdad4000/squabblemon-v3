import assert from 'node:assert/strict';
import test from 'node:test';
import { createBossCampaign, createBossRaid, bossRewards, settleBossCampaign, applyBossAction, BOSS_FORMS, type BossStatus } from '@workspace/squabblemon-engine/bossRaid';
import { ROOKIE_CORE_IDS } from '@workspace/squabblemon-engine/data';
import { raidBankedRewards, raidIdentity } from './bossRaidPresentation';

function status(): BossStatus {
  return { day: '2026-10-24', resetsAt: '2026-10-25T00:00:00Z', serverNow: 0, attemptsRemaining: 0,
    run: createBossRaid('receipt', '2026-10-24', [...ROOKIE_CORE_IDS.slice(0, 10)], 'Crew', { tier: 1, hp: 1 }),
    earned: { softCurrency: 0, packTickets: 0, styleShards: 0 }, bestScore: 0, campaign: { ...createBossCampaign(), hp: 1 }, history: [] };
}
test('receipt reports authoritative daily earnings without a projected tier reward', () => {
  const s = status();
  s.earned = { softCurrency: 175, packTickets: 2, styleShards: 15 };
  assert.deepEqual(raidBankedRewards(s, 'precinct'), { ...s.earned, tierCleared: false });
  s.run!.phase = 'retired';
  assert.deepEqual(raidBankedRewards(s, 'precinct'), { ...s.earned, tierCleared: false });
});
test('real tier clear includes its once-banked bonus in the attack receipt', () => {
  const s = status();
  let run = s.run!;
  let played = false;
  for (const card of run.match.playerHand) {
    try { run = applyBossAction(run, { type: 'play', instanceId: card.instanceId, lane: 0 }); played = true; break; } catch {}
  }
  assert(played);
  for (let turn = 0; turn < 6 && run.phase === 'active'; turn++) {
    const before = run;
    run = applyBossAction(run, { type: 'blast' });
    s.campaign = settleBossCampaign(s.campaign, before, run).campaign;
  }
  assert.equal(run.hp, 0);
  s.run = run; s.earned = bossRewards(run);
  const reward = raidBankedRewards(s, 'precinct');
  assert.deepEqual(reward, { tierCleared: true,
    softCurrency: s.earned.softCurrency + BOSS_FORMS[0].reward.softCurrency,
    packTickets: s.earned.packTickets + BOSS_FORMS[0].reward.packTickets,
    styleShards: s.earned.styleShards + BOSS_FORMS[0].reward.styleShards });
  assert.deepEqual(raidBankedRewards(s, 'precinct'), reward, 'reopening the result never accumulates another reward');
  s.campaign.defeated = [];
  assert.equal(raidBankedRewards(s, 'precinct').tierCleared, false, 'campaign must confirm the clear');
});
test('each operation names its actual boss without carrying over precinct labels', () => {
  assert.equal(raidIdentity('precinct', 5).title, 'OFFICER OINK');
  assert.equal(raidIdentity('kumite', 1).title, 'CHONK LEE');
  assert.equal(raidIdentity('kumite', 5).title, "SHO'NUFF");
  assert.equal(raidIdentity('kumite', 3).opposition, 'Opposition');
});
