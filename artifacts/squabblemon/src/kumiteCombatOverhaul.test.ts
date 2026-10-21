import assert from 'node:assert/strict';
import test from 'node:test';
import { cards, KUMITE_CARD_REWARDS, catalogCardById } from './data';
import {
  createAbilityUpgradeSnapshot, createCardInstance, createMatch, playTurnCard,
  type CardInstance, type Lane, type Match, type Owner,
} from './gameEngine';

const other = (owner: Owner): Owner => owner === 'player' ? 'cpu' : 'player';
const unit = (id: string, owner: Owner, index: number, lane: Lane, modifier = 0): CardInstance => ({
  ...createCardInstance(id, owner, 'kumite-v61-unit', index), lane, powerModifier: modifier,
});
const find = (m: Match, id: string) => m.boards.flat().find(c => c.instanceId === id);

function fixture(id: string, owner: Owner, boards: Match['boards'], trained = false) {
  const source = createCardInstance(id, owner, 'kumite-v61-cast', 100);
  const m: Match = {
    ...createMatch('block', 'slide'), round: 5, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    boards, playerMotion: 9, cpuMotion: 9,
    playerHand: owner === 'player' ? [source] : [], cpuHand: owner === 'cpu' ? [source] : [],
    timedEffects: boards.flat().filter(c => c.statuses.protected).map(c => ({
      id: `ward:${c.instanceId}`, kind: 'church-protection', sourceInstanceId: c.instanceId,
      targetInstanceId: c.instanceId, owner: c.owner, lane: c.lane!,
      startsAtRound: 1, expiresAtRound: 7, expiration: 'match-complete',
    })),
  };
  if (trained) m.abilityUpgradeSnapshot = createAbilityUpgradeSnapshot(
    owner === 'player' ? [id] : [], owner === 'cpu' ? [id] : [],
    { [owner]: { [id]: { xp: 2800, level: 8, moveTier: 3 } } },
  );
  return { m, source };
}
function cast(id: string, owner: Owner, boards: Match['boards'], trained = false) {
  const { m, source } = fixture(id, owner, boards, trained);
  const before = structuredClone(m);
  const after = playTurnCard(m, owner, source.instanceId, 0);
  assert.deepEqual(m, before, 'printed abilities keep the submitted state immutable');
  assert.deepEqual(after, playTurnCard(m, owner, source.instanceId, 0), 'same snapshot replays deterministically');
  return { after, source: find(after, source.instanceId)! };
}

test('v61 prints Watson 1/2 and strengthens all nine canonical Kumite fighters', () => {
  assert.deepEqual([cards.watson.cost, cards.watson.power], [1, 2]);
  const expected: Record<string, [number, number]> = {
    'bushedo-brown': [3, 4], 'franklin-duke': [4, 6], 'chonk-lee': [5, 7],
    dragonflyjones: [2, 3], ptang: [3, 4], undercova: [2, 3],
    shonuff: [3, 4], leroy: [3, 5], yasuke: [2, 3],
  };
  assert.equal(KUMITE_CARD_REWARDS.length, 9);
  for (const reward of KUMITE_CARD_REWARDS) {
    const id = catalogCardById[reward.cardId].engineId;
    assert.deepEqual([cards[id].cost, cards[id].power], expected[id], reward.name);
  }
});

for (const owner of ['player', 'cpu'] as const) {
  const enemy = other(owner);
  test(`Bushedo reinforces the ally and confiscates the most bonus Hands without damage (${owner})`, () => {
    const ally = unit('waterboy', owner, 1, 0);
    const boosted = unit('edgar', enemy, 2, 0, 7);
    const tall = { ...unit('partytitan', enemy, 3, 0), basePower: 25 };
    const { after } = cast('bushedo-brown', owner, [[ally, boosted, tall], [], []]);
    assert.equal(find(after, ally.instanceId)!.powerModifier, 2);
    assert.equal(find(after, ally.instanceId)!.statuses.protected, true);
    assert.equal(find(after, boosted.instanceId)!.powerModifier, 3);
    assert.equal(find(after, tall.instanceId)!.powerModifier, 0);
    assert.equal(find(after, boosted.instanceId)!.recoverableDamage ?? 0, 0);
    assert.equal((after.laneDamage ?? []).length, 0);
  });

  test(`Bushedo does not turn a blocked confiscation into a second attack (${owner})`, () => {
    const target = unit('edgar', enemy, 2, 0, 7);
    target.statuses.protected = true;
    const { after, source } = cast('bushedo-brown', owner, [[target], [], []], true);
    assert.equal(find(after, target.instanceId)!.powerModifier, 7);
    assert.equal(source.powerModifier, 0);
    assert.equal(source.waveTrainingUsed, undefined);
  });

  test(`Franklin earns his counter only on actual damage and has a real support fallback (${owner})`, () => {
    const target = { ...unit('partytitan', enemy, 1, 0), basePower: 20 };
    const counter = cast('franklin-duke', owner, [[target], [], []]);
    assert.equal(find(counter.after, target.instanceId)!.powerModifier, -4);
    assert.equal(counter.source.powerModifier, 3);
    const guarded = { ...target, statuses: { ...target.statuses, protected: true } };
    assert.equal(cast('franklin-duke', owner, [[guarded], [], []]).source.powerModifier, 0);
    const janitor = unit('janitor', enemy, 9, 0);
    const reversed = cast('franklin-duke', owner, [[target, janitor], [], []]);
    assert.equal(reversed.source.powerModifier, 0, 'Janitor reversal is not a landed counter');
    const remote = unit('waterboy', owner, 2, 1);
    const support = cast('franklin-duke', owner, [[], [remote], []]);
    assert.equal(find(support.after, remote.instanceId)!.powerModifier, 3);
    assert.equal(find(support.after, remote.instanceId)!.statuses.protected, true);
  });

  test(`Franklin still earns a landed counter against a defeated boosted target (${owner})`, () => {
    const target = unit('edgar', enemy, 1, 0, 1);
    const { after, source } = cast('franklin-duke', owner, [[target], [], []]);
    assert.equal(find(after, target.instanceId), undefined);
    assert.equal(source.powerModifier, 3);
  });

  test(`Chonk pressures all three districts and counts only landed hits (${owner})`, () => {
    const targets = ([0, 1, 2] as Lane[]).map((lane, i) => unit('partytitan', enemy, i, lane));
    const { after, source } = cast('chonk-lee', owner, targets.map(c => [c]) as Match['boards']);
    for (const t of targets) assert.equal(find(after, t.instanceId)!.powerModifier, -2);
    assert.equal(source.powerModifier, 3);
    const shielded = { ...targets[0], statuses: { ...targets[0].statuses, protected: true } };
    assert.equal(cast('chonk-lee', owner, [[shielded], [targets[1]], [targets[2]]]).source.powerModifier, 2);
    assert.equal(cast('chonk-lee', owner, [[], [], []], true).source.powerModifier, 0);
  });

  test(`Leroy strips bonus Hands even without diversity and records only the genuine damage (${owner})`, () => {
    const target = { ...unit('partytitan', enemy, 1, 0, 8), basePower: 20 };
    const { after, source } = cast('leroy', owner, [[target], [], []]);
    assert.equal(find(after, target.instanceId)!.powerModifier, 2, 'four confiscated, two damaged');
    assert.equal(find(after, target.instanceId)!.recoverableDamage, 2);
    assert.equal((after.laneDamage ?? []).reduce((sum, hit) => sum + hit.amount, 0), 2);
    assert.equal(source.goldenGlow, undefined);
    const warded = { ...target, statuses: { ...target.statuses, protected: true } };
    const blocked = cast('leroy', owner, [[warded], [], []]);
    assert.equal(find(blocked.after, target.instanceId)!.powerModifier, 8, 'one ward blocks the whole strip-and-hit package');
    const allies = [unit('cornball', owner, 2, 1), unit('waterboy', owner, 3, 2)];
    const glow = cast('leroy', owner, [[target], [allies[0]], [allies[1]]]);
    assert.equal(glow.source.powerModifier, 3);
    assert.equal(glow.source.goldenGlow, true);
    assert.equal(glow.source.statuses.protected, true);
  });

  test(`Block Spin repeats Leroy damage but never replays confiscated bonus Hands (${owner})`, () => {
    const target = { ...unit('partytitan', enemy, 1, 0, 8), basePower: 30 };
    const { m, source } = fixture('leroy', owner, [[target], [], []]);
    const spin = createCardInstance('the-block-spin', owner, 'v61-spin', 101);
    const key = owner === 'player' ? 'playerHand' : 'cpuHand';
    m[key].push(spin);
    const first = playTurnCard(m, owner, source.instanceId, 0);
    const after = playTurnCard(first, owner, spin.instanceId, 0);
    assert.equal(find(after, target.instanceId)!.powerModifier, -4, 'four bonus confiscated + two damage repeated four times');
  });

  test(`Leroy trains on a committed hit even when the surviving enemy immediately trains above its old Hands (${owner})`, () => {
    const target = unit('homelesslegend', enemy, 1, 0, 1 - cards.homelesslegend.power);
    const { m, source } = fixture('leroy', owner, [[target], [], []], true);
    m.abilityUpgradeSnapshot = createAbilityUpgradeSnapshot(
      owner === 'player' ? ['leroy'] : ['homelesslegend'],
      owner === 'cpu' ? ['leroy'] : ['homelesslegend'],
      { [owner]: { leroy: { xp: 2800, level: 8, moveTier: 3 } },
        [enemy]: { homelesslegend: { xp: 2800, level: 8, moveTier: 3 } } },
    );
    const after = playTurnCard(m, owner, source.instanceId, 0);
    assert.equal(find(after, target.instanceId)!.legendSaved, true);
    assert(find(after, target.instanceId)!.powerModifier > target.powerModifier,
      'Built Different survival and training leave the defender stronger than before');
    assert.equal(find(after, source.instanceId)!.powerModifier, 3,
      'one real landed hit still earns Leroy his three once-per-match upgrades');
    assert.equal(after.effectLog.filter(e => e.abilityMetadata?.sourceInstanceId === source.instanceId).length, 3);
  });

  test(`Undercover pays for real damage when arrival checks and survival training disguise the net loss (${owner})`, () => {
    const spy = unit('undercova', owner, 1, 0);
    const security = unit('squabblehouse-security', owner, 2, 0);
    const manager = unit('squabble-house-manager', owner, 3, 0);
    const { m, source: buddy } = fixture('buddy', owner, [[spy, security, manager], [], []]);
    const victim = createCardInstance('homelesslegend', enemy, 'arrival-survival', 104);
    m[enemy === 'player' ? 'playerHand' : 'cpuHand'] = [victim];
    m.squabbleByOwner = { player: false, cpu: false };
    m.abilityUpgradeSnapshot = createAbilityUpgradeSnapshot(
      owner === 'player' ? ['undercova'] : ['homelesslegend'],
      owner === 'cpu' ? ['undercova'] : ['homelesslegend'],
      { [owner]: { undercova: { xp: 2800, level: 8, moveTier: 3 } },
        [enemy]: { homelesslegend: { xp: 2800, level: 8, moveTier: 3 } } },
    );
    const prepared = playTurnCard(m, owner, buddy.instanceId, 0, true);
    const after = playTurnCard({ ...prepared, phase: enemy === 'player' ? 'player' : 'cpu-reveal' },
      enemy, victim.instanceId, 0);
    assert.equal(find(after, victim.instanceId)!.legendSaved, true);
    assert.equal(find(after, victim.instanceId)!.waveTrainingUsed, true);
    assert.equal(find(after, spy.instanceId)!.powerModifier, 5,
      'Undercover takes the two committed damage Hands and earns three once-per-match upgrades');
    assert.notEqual(find(after, spy.instanceId)!.lane, 0, 'actual loss permits escape');
    assert.deepEqual(after.undercovaPayouts?.[owner], { round: m.round, count: 1 });
    assert.equal(after.effectLog.filter(e => e.abilityMetadata?.sourceInstanceId === spy.instanceId).length, 3);
  });

  test(`Dragonfly chooses bonus over cost, gains only on hit, and still has an ordinary fallback (${owner})`, () => {
    const boosted = { ...unit('waterboy', enemy, 1, 0, 6), basePower: 10 };
    const costly = { ...unit('partytitan', enemy, 2, 0), basePower: 30 };
    const punished = cast('dragonflyjones', owner, [[boosted, costly], [], []]);
    assert.equal(find(punished.after, boosted.instanceId)!.powerModifier, 2);
    assert.equal(find(punished.after, costly.instanceId)!.powerModifier, 0);
    assert.equal(punished.source.powerModifier, 1);
    const shield = { ...boosted, statuses: { ...boosted.statuses, protected: true } };
    assert.equal(cast('dragonflyjones', owner, [[shield], [], []], true).source.powerModifier, 0);
    const ordinary = { ...unit('edgar', enemy, 3, 0), basePower: 10 };
    const fallback = cast('dragonflyjones', owner, [[ordinary], [], []]);
    assert.equal(find(fallback.after, ordinary.instanceId)!.powerModifier, -2);
    assert.equal(cast('dragonflyjones', owner, [[], [], []], true).source.powerModifier, 0);
  });

  test(`Sho’Nuff steals actual removable bonus and keeps damage as a separate fallback (${owner})`, () => {
    const target = unit('partytitan', enemy, 1, 0, 8);
    const steal = cast('shonuff', owner, [[target], [], []]);
    assert.equal(find(steal.after, target.instanceId)!.powerModifier, 3);
    assert.equal(steal.source.powerModifier, 5);
    assert.equal(find(steal.after, target.instanceId)!.recoverableDamage ?? 0, 0);
    assert.equal((steal.after.laneDamage ?? []).length, 0);
    const guarded = { ...target, statuses: { ...target.statuses, protected: true } };
    assert.equal(cast('shonuff', owner, [[guarded], [], []]).source.powerModifier, 0);
    const normal = { ...target, powerModifier: 0 };
    const hit = cast('shonuff', owner, [[normal], [], []]);
    assert.equal(find(hit.after, normal.instanceId)!.powerModifier, -3);
    assert.equal(hit.source.powerModifier, 0);
  });

  test(`Yasuke guards and reinforces a client while pressuring the opposing lane (${owner})`, () => {
    const ally = unit('waterboy', owner, 1, 0);
    const target = unit('partytitan', enemy, 2, 0);
    const { after } = cast('yasuke', owner, [[ally, target], [], []]);
    assert.equal(find(after, ally.instanceId)!.powerModifier, 2);
    assert.equal(find(after, ally.instanceId)!.statuses.protected, true);
    assert.equal(find(after, target.instanceId)!.powerModifier, -2);
  });

  test(`Kumite training survives a genuine return and cannot be farmed on redeployment (${owner})`, () => {
    const target = { ...unit('partytitan', enemy, 1, 0), basePower: 30 };
    const { m, source } = fixture('bushedo-brown', owner, [[target], [], []], true);
    const hatter = createCardInstance('madhatter', owner, 'training-return', 102);
    const key = owner === 'player' ? 'playerHand' : 'cpuHand';
    m[key].push(hatter);
    const first = playTurnCard(m, owner, source.instanceId, 0);
    assert.equal(find(first, source.instanceId)!.powerModifier, 3);
    const returned = playTurnCard(first, owner, hatter.instanceId, 0);
    const traveler = returned[key].find(c => c.instanceId === source.instanceId)!;
    assert(traveler?.waveTrainingUsed, 'real return preserves the once-per-match training marker');
    const replayed = playTurnCard(returned, owner, traveler.instanceId, 0);
    assert.equal(find(replayed, source.instanceId)!.powerModifier, traveler.powerModifier);
    assert.equal(replayed.effectLog.filter(event => event.abilityMetadata?.sourceInstanceId === source.instanceId).length, 3);
  });
}
