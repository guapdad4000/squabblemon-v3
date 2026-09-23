import assert from 'node:assert/strict';
import test from 'node:test';
import { CELLBLOCK_WAVE } from '../../../lib/squabblemon-engine/src/cellblockWave';
import { cards, cardCatalog, catalogCardById, validateCardAbilityUpgrades, validateSavedDeck } from './data';
import { createMatch, createCardInstance, createAbilityUpgradeSnapshot, playTurnCard, nextRound,
  type Match, type Owner, type Lane, type CardInstance } from './gameEngine';

const blank = (): Match => ({ ...createMatch('block', 'block'), round: 1, playerMotion: 9, cpuMotion: 9,
  boards: [[], [], []], playerHand: [], cpuHand: [] });
const unit = (id: string, owner: Owner, lane: Lane = 0, index = 0): CardInstance => ({
  ...createCardInstance(id, owner, 'test', index), lane,
});
const find = (m: Match, id: string) => m.boards.flat().find(c => c.cardId === id)!;
const supportId = Object.keys(cards).find(id => cards[id].kind === 'support')!;
function cast(m: Match, id: string, owner: Owner = 'player', tier = 0, status?: 'silenced' | 'frozen' | 'weakened', cost?: number) {
  const source = createCardInstance(id, owner, 'cast', m.round);
  if (status) source.statuses[status] = true;
  if (cost !== undefined) source.cost = cost;
  const snapshot = createAbilityUpgradeSnapshot(owner === 'player' ? [id] : [], owner === 'cpu' ? [id] : [],
    { [owner]: { [id]: { level: [1, 2, 5, 8][tier], xp: 2800, moveTier: tier } } });
  return playTurnCard({ ...m, abilityUpgradeSnapshot: snapshot, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    [owner === 'player' ? 'playerHand' : 'cpuHand']: [source] }, owner, source.instanceId, 0);
}
function setup(owner: Owner): Match {
  const m = blank(), enemy = owner === 'player' ? 'cpu' : 'player';
  m.boards[0] = [unit(supportId, owner), unit('rastamon', owner), unit('hooper', enemy)];
  find(m, 'hooper').powerModifier = 20;
  return m;
}
test('catalog, pack-only acquisition, rarity, three upgrade tiers and deck legality', () => {
  validateCardAbilityUpgrades();
  for (const [id, name, rarity] of CELLBLOCK_WAVE) {
    const card = catalogCardById[id];
    assert.equal(card.name, name); assert.equal(card.rarity, rarity);
    assert.equal(card.engineId, id); assert.equal(card.artworkId, id);
    assert.deepEqual(card.acquisitionSources, ['Street Packs']);
    assert.equal(card.abilityUpgrades.length, 3);
    assert.equal(card.kind, 'character');
    assert.equal(card.faction, id === 'lebron-james' ? 'Independent' : 'Cellblock');
  }
  assert.equal(cards['lebron-james'].name, 'Regular guy named LeBron James');
  assert.equal(cards['lebron-james'].type, 'Normal');
  assert.equal(cards['lebron-james'].ability, 'Regular Guy');
  assert.match(cards['lebron-james'].effect, /fictional regular guy/);
  assert.doesNotMatch(cards['lebron-james'].effect, /basketball|dunk|hoop|court/i);
  const ids = [...CELLBLOCK_WAVE.map(([id]) => id), ...cardCatalog.filter(c => !CELLBLOCK_WAVE.some(([id]) => c.catalogId === id)).slice(0, 5).map(c => c.catalogId)];
  assert.equal(validateSavedDeck(ids, ids, 'lebron-james').valid, true);
});
for (const owner of ['player', 'cpu'] as const) {
  test(`${owner}: every base ability and upgrade tier is immutable and deterministic after JSON serialization`, () => {
    for (const [id] of CELLBLOCK_WAVE) for (let tier = 0; tier <= 3; tier++) {
      const m = setup(owner), before = JSON.stringify(m), after = cast(m, id, owner, tier);
      assert.equal(JSON.stringify(m), before);
      assert.deepEqual(cast(JSON.parse(before), id, owner, tier), after);
      assert.equal(find(after, id).powerModifier, tier + (id === 'inmate-crafty' ? 2 : id === 'lebron-james' ? 1 : 0));
      if (id === 'inmate-boyfriend') assert.equal(find(after, supportId).powerModifier, 2);
      if (id === 'inmate-informant') assert.equal(find(after, 'hooper').powerModifier, 18);
      if (id === 'inmate-contraband') assert.equal(after[owner === 'player' ? 'playerMotion' : 'cpuMotion'], 8);
      if (id === 'lebron-james') assert.equal(find(after, supportId).statuses.protected, true);
      assert.equal(after.effectLog.filter(e => e.abilityMetadata).length, tier);
      assert.ok(after.effectLog.some(e => e.replay.after.boards.flat().some(c => c.cardId === id)));
    }
  });
  test(`${owner}: no targets and source debuffs prevent effects and training`, () => {
    for (const [id] of CELLBLOCK_WAVE) {
      assert.equal(find(cast(blank(), id, owner, 3), id).powerModifier, 0);
      for (const status of ['silenced', 'frozen', 'weakened'] as const) {
        const after = cast(setup(owner), id, owner, 3, status);
        assert.equal(find(after, id).powerModifier, 0);
        assert.equal(find(after, 'hooper').powerModifier, 20);
        assert.equal(find(after, supportId).powerModifier, 0);
        assert.equal(after.effectLog.filter(e => e.abilityMetadata).length, 0);
      }
    }
  });
  test(`${owner}: supporting conditions require correct owner, lane and kind`, () => {
    const enemy = owner === 'player' ? 'cpu' : 'player', m = blank();
    m.boards[0] = [unit(supportId, enemy)];
    m.boards[1] = [unit(supportId, owner, 1), unit('rastamon', owner, 1)];
    for (const id of ['inmate-crafty', 'inmate-boyfriend', 'inmate-contraband']) {
      assert.equal(find(cast(m, id, owner, 3), id).powerModifier, 0);
    }
    m.boards[0] = [unit(supportId, owner)];
    assert.equal(find(cast(m, 'inmate-contraband', owner, 3), 'inmate-contraband').powerModifier, 0);
    m.boards[0] = [unit('rastamon', owner)];
    assert.equal(find(cast(m, 'inmate-crafty', owner, 3), 'inmate-crafty').powerModifier, 0);
    const full = cast(m, 'inmate-contraband', owner, 3, undefined, 0);
    assert.equal(full[owner === 'player' ? 'playerMotion' : 'cpuMotion'], 9);
    assert.equal(find(full, 'inmate-contraband').powerModifier, 0);
  });
  test(`${owner}: Informant respects protection and immunity and never trains on blocked damage`, () => {
    const enemy = owner === 'player' ? 'cpu' : 'player';
    for (const shield of ['protected', 'uncounterable'] as const) {
      const m = blank(), target = unit('hooper', enemy);
      target.statuses[shield] = true; m.boards[0] = [target];
      if (shield === 'protected') m.timedEffects = [{ id: 'test-protect', kind: 'church-protection', sourceInstanceId: target.instanceId,
        targetInstanceId: target.instanceId, owner: enemy, lane: 0, startsAtRound: 1, expiresAtRound: 7, expiration: 'match-complete' }];
      const after = cast(m, 'inmate-informant', owner, 3);
      assert.equal(find(after, 'hooper').powerModifier, 0);
      assert.equal(find(after, 'inmate-informant').powerModifier, 0);
    }
  });
  test(`${owner}: Regular Guy cleanses all debuffs, preserves buffs, grants a working shield, and snapshots the losing condition`, () => {
    const m = blank(), target = unit('rastamon', owner), enemy = owner === 'player' ? 'cpu' : 'player';
    target.statuses = { ...target.statuses, frozen: true, silenced: true, weakened: true, locked: true, burnStacks: 3, boosted: true };
    target.powerModifier = 2; m.boards[0] = [target];
    let after = cast(m, 'lebron-james', owner, 3);
    const ally = find(after, 'rastamon');
    assert.deepEqual(ally.statuses, { ...target.statuses, frozen: false, silenced: false, weakened: false, locked: false, burnStacks: 0, protected: true });
    assert.equal(ally.powerModifier, 2); assert.equal(find(after, 'lebron-james').powerModifier, 3);
    // Make the protected ally the strongest target without changing its identity.
    after.boards[0] = after.boards[0].map(c => c.instanceId === ally.instanceId ? { ...c, powerModifier: 20 } : c);
    after = cast(after, 'inmate-informant', enemy);
    assert.equal(find(after, 'rastamon').powerModifier, 20);
    assert.equal(find(after, 'rastamon').statuses.protected, false);
    const solo = blank(); solo.boards[0] = [unit('hooper', enemy)]; find(solo, 'hooper').powerModifier = 10;
    assert.equal(find(cast(solo, 'lebron-james', owner), 'lebron-james').powerModifier, 1);
  });
}
test('weakest and strongest ties use stable instance IDs, not board order', () => {
  for (const [id, owner] of [['inmate-boyfriend', 'player'], ['inmate-informant', 'cpu']] as const) {
    const m = blank(), a = unit('rastamon', owner, 0, 1), b = unit('rastamon', owner, 0, 2);
    m.boards[0] = [b, a];
    const after = cast(m, id);
    const selected = after.boards[0].find(c => c.instanceId === a.instanceId);
    if (id === 'inmate-boyfriend') assert.equal(selected?.powerModifier, 2);
    else assert.equal(selected, undefined); // Two-Hand target destroyed by -2.
  }
});
test('six rounds do not create passive growth or repeat upgrade payments', () => {
  for (const [id] of CELLBLOCK_WAVE) {
    let m = cast(setup('player'), id, 'player', 3);
    const power = find(m, id).powerModifier;
    while (m.phase !== 'complete') m = nextRound({ ...m, phase: 'resolved', playerHand: [], cpuHand: [] });
    assert.equal(m.round, 6);
    assert.equal(find(m, id).powerModifier, power);
    assert.equal(m.effectLog.filter(e => e.abilityMetadata).length, 3);
  }
});