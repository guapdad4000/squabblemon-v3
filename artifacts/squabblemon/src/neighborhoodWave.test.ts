import assert from 'node:assert/strict';
import test from 'node:test';
import { NEIGHBORHOOD_WAVE } from '../../../lib/squabblemon-engine/src/neighborhoodWave';
import { cards, cardCatalog, catalogCardById, validateSavedDeck, validateCardAbilityUpgrades } from './data';
import { createCardInstance, createMatch, createAbilityUpgradeSnapshot, playTurnCard, SUMMON_TEMPLATES,
  type Match, type Owner, type Lane, type CardInstance } from './gameEngine';
import { createOnlineRoom, onlineRoomView } from '@workspace/squabblemon-engine/multiplayer';

const blank = (): Match => ({ ...createMatch('block', 'block'), round: 3, playerMotion: 9, cpuMotion: 9,
  playerHand: [], cpuHand: [], boards: [[], [], []], squabbleByOwner: { player: false, cpu: false } });
const unit = (id: string, owner: Owner = 'player', lane: Lane = 0, index = 0): CardInstance => ({
  ...createCardInstance(id, owner, 'test', index), lane,
});
const find = (m: Match, id: string) => m.boards.flat().find(c => c.cardId === id)!;
function cast(m: Match, id: string, owner: Owner = 'player', lane: Lane = 0, squabble = false, tier = 0) {
  const card = createCardInstance(id, owner, 'cast');
  if (tier) m = { ...m, abilityUpgradeSnapshot: createAbilityUpgradeSnapshot(owner === 'player' ? [id] : [], owner === 'cpu' ? [id] : [],
    { [owner]: { [id]: { level: [1, 2, 5, 8][tier], xp: 2800, moveTier: tier } } }) };
  return playTurnCard({ ...m, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    [owner === 'player' ? 'playerHand' : 'cpuHand']: [card] }, owner, card.instanceId, lane, squabble);
}

test('five collectible identities have rarities, three upgrades and legal acquisition; forms and tokens do not', () => {
  validateCardAbilityUpgrades();
  for (const [id, name, rarity] of NEIGHBORHOOD_WAVE) {
    assert.equal(cards[id].name, name);
    assert.equal(catalogCardById[id].rarity, rarity);
    assert.equal(catalogCardById[id].artworkId, id);
    assert.equal(cards[id].abilityUpgrades.length, 3);
    assert.deepEqual(catalogCardById[id].acquisitionSources, ['Street Packs']);
  }
  const ids = [...NEIGHBORHOOD_WAVE.map(([id]) => id), ...cardCatalog.filter(c => !NEIGHBORHOOD_WAVE.some(([id]) => id === c.catalogId)).slice(0, 5).map(c => c.catalogId)];
  assert.equal(validateSavedDeck(ids, ids, 'luigion').valid, true);
  for (const id of ['luigion-powered', 'demario-mushroom']) {
    assert.equal(catalogCardById[id], undefined);
    assert.equal(cards[id], undefined);
  }
  assert.equal(SUMMON_TEMPLATES['demario-mushroom'].power, 1);
});

for (const owner of ['player', 'cpu'] as const) {
  test(`${owner}: base abilities and all upgrade tiers are deterministic and immutable`, () => {
    for (const [id] of NEIGHBORHOOD_WAVE) for (let tier = 0; tier <= 3; tier++) {
      const m = blank(), ally = unit('rastamon', owner), rival = unit('hooper', owner === 'player' ? 'cpu' : 'player', 1);
      ally.statuses.burnStacks = 2; ally.statuses.frozen = true; ally.statuses.silenced = true;
      m.boards[0] = [ally]; m.boards[1] = [rival];
      const saved = JSON.stringify(m);
      const after = cast(m, id, owner, 0, false, tier);
      assert.equal(JSON.stringify(m), saved);
      assert.deepEqual(cast(JSON.parse(saved), id, owner, 0, false, tier), after);
      assert.equal(find(after, id).powerModifier, tier + (id === 'luigion' ? 1 : 0));
      if (id === 'luigion') assert.equal(find(after, 'rastamon').powerModifier, 1);
      if (id === 'hair-stylist') {
        assert.equal(find(after, 'rastamon').statuses.burnStacks, 0);
        assert.equal(find(after, 'rastamon').statuses.frozen, false);
        assert.equal(find(after, 'rastamon').statuses.silenced, false);
        assert.equal(find(after, 'rastamon').powerModifier, 1);
      }
      if (id === 'stylist') { assert.equal(find(after, 'rastamon').statuses.protected, true); assert.equal(find(after, 'rastamon').powerModifier, 2); }
      if (id === 'demario') assert.equal(find(after, 'demario-mushroom').basePower, 1);
      if (id === 'black-cowboy') assert.equal(find(after, 'hooper').lane, 0);
    }
  });
  test(`${owner}: mushroom requires summon space, and Squabble transforms independently`, () => {
    const full = blank();
    full.boards[0] = [0, 1, 2].map(i => unit('rastamon', owner, 0, i));
    assert.equal(find(cast(full, 'demario', owner, 0, false, 3), 'demario-mushroom'), undefined);
    assert.equal(find(cast(full, 'demario', owner, 0, false, 3), 'demario').powerModifier, 0);
    const solo = cast(blank(), 'luigion', owner, 0, true);
    assert.equal(find(solo, 'luigion').id, 'luigion-powered');
    assert.equal(find(solo, 'luigion').powerModifier, 5);
    assert.equal(find(cast(blank(), 'luigion', owner), 'luigion').powerModifier, 2);
    assert.equal(find(cast(blank(), 'luigion', owner, 0, true, 3), 'luigion').powerModifier, 8);
  });
}

test('Luigion consumes only one same-owner same-lane mushroom, preserving identity and historical frames', () => {
  let m = cast(blank(), 'demario');
  const mushroom = find(m, 'demario-mushroom');
  m.boards[0].push({ ...mushroom, instanceId: 'second-mushroom' }, { ...mushroom, owner: 'cpu', instanceId: 'enemy-mushroom' });
  m.boards[1].push({ ...mushroom, lane: 1, instanceId: 'remote-mushroom' });
  const before = JSON.stringify(m);
  const after = cast(m, 'luigion', 'player', 0, true);
  const luigion = find(after, 'luigion');
  assert.equal(JSON.stringify(m), before);
  assert.equal(luigion.cardId, 'luigion');
  assert.equal(luigion.name, 'Powered Luigion');
  assert.equal(luigion.instanceId, 'player:cast:0:luigion');
  assert.equal(luigion.powerModifier, 6); // +2 Squabble, +1 base reveal, +2 Mushroom, +1 jump
  assert.equal(after.boards[0].filter(c => c.owner === 'player' && c.cardId === 'demario-mushroom').length, 1);
  assert.ok(after.boards[0].some(c => c.instanceId === 'enemy-mushroom'));
  assert.ok(after.boards[1].some(c => c.instanceId === 'remote-mushroom'));
  assert.deepEqual(cast(JSON.parse(before), 'luigion', 'player', 0, true), after);
  assert.ok(after.effectLog.some(e => e.replay.after.boards.flat().some(c => c.id === 'luigion-powered')));
  const normal = cast(m, 'luigion');
  assert.equal(normal.boards[0].filter(c => c.cardId === 'demario-mushroom').length, 2);
});

test('form preserves existing statuses and buffs and projects public art without leaking rival hands', () => {
  const card = createCardInstance('luigion', 'player');
  card.powerModifier = 3; card.statuses.protected = true; card.statuses.silenced = true;
  const m = playTurnCard({ ...blank(), playerHand: [card], cpuHand: [createCardInstance('demario', 'cpu')] }, 'player', card.instanceId, 0, true);
  assert.equal(find(m, 'luigion').powerModifier, 5);
  assert.deepEqual(find(m, 'luigion').statuses, card.statuses);
  const host = { userId: 'host', name: 'Host', ready: true, deck: { id: 'custom', name: 'Crew', hero: 'luigion', cards: m.playerCardIds } };
  const room = { ...createOnlineRoom(host, 'player', 0), match: JSON.parse(JSON.stringify(m)), status: 'active' as const };
  const view = onlineRoomView(room, 'test', 'host', 1);
  assert.equal(view.boards[0][0].artworkId, 'luigion-powered');
  assert.equal(view.boards[0][0].cardId, 'luigion');
  assert.equal(view.boards[0][0].form?.name, 'Powered Luigion');
  assert.equal(view.rivalHandCount, 1);
  assert.equal('cpuHand' in view, false);
});

test('opponent and remote mushrooms never grant a transformation bonus', () => {
  const m = blank();
  const seed = find(cast(blank(), 'demario'), 'demario-mushroom');
  m.boards[0] = [{ ...seed, owner: 'cpu', instanceId: 'enemy-only' }];
  m.boards[1] = [{ ...seed, lane: 1, instanceId: 'remote-only' }];
  const after = cast(m, 'luigion', 'player', 0, true);
  assert.equal(find(after, 'luigion').powerModifier, 5);
  assert.ok(after.boards[0].some(c => c.instanceId === 'enemy-only'));
  assert.ok(after.boards[1].some(c => c.instanceId === 'remote-only'));
});

test('lasso respects locks, immunity, destination cap, and deterministic weakest tie breaks', () => {
  for (const status of ['locked', 'uncounterable'] as const) {
    const m = blank(), target = unit('rastamon', 'cpu', 1);
    target.statuses[status] = true; m.boards[1] = [target];
    const after = cast(m, 'black-cowboy', 'player', 0, false, 3);
    assert.equal(find(after, 'rastamon').lane, 1);
    assert.equal(find(after, 'black-cowboy').powerModifier, 0);
  }
  const m = blank(); m.boards[1] = [unit('rastamon', 'cpu', 1, 2), unit('rastamon', 'cpu', 1, 1)];
  assert.equal(cast(m, 'black-cowboy').boards[0].find(c => c.owner === 'cpu')?.instanceId, 'cpu:test:1:rastamon');
  m.boards[0] = [0, 1, 2, 3].map(i => unit('rastamon', 'cpu', 0, i + 10));
  assert.equal(cast(m, 'black-cowboy').boards[1].length, 2);
});

for (const owner of ['player', 'cpu'] as const) {
  test(`${owner}: opening Demario and both Luigion forms get exactly one local premium at all tiers`, () => {
    for (let tier = 0; tier <= 3; tier++) for (const powered of [false, true]) {
      const opening = { ...blank(), round: 1, playerMotion: 2, cpuMotion: 2 };
      const setup = cast(opening, 'demario', owner);
      assert.equal(setup[owner === 'player' ? 'playerMotion' : 'cpuMotion'], 0);
      assert.equal(find(setup, 'demario').basePower, 2);
      assert.equal(find(setup, 'demario-mushroom').basePower, 1);
      const m = { ...setup, playerMotion: 9, cpuMotion: 9 };
      const seed = find(m, 'demario-mushroom');
      m.boards[0].push({ ...seed, instanceId: 'spare-mushroom' });
      const before = JSON.stringify(m), after = cast(m, 'luigion', owner, 0, powered, tier);
      assert.equal(JSON.stringify(m), before);
      assert.deepEqual(cast(JSON.parse(before), 'luigion', owner, 0, powered, tier), after);
      assert.equal(find(after, 'luigion').powerModifier, tier + (powered ? 6 : 3));
      assert.equal(find(after, 'demario').powerModifier, 1);
      assert.equal(after.boards[0].filter(c => c.cardId === 'demario-mushroom').length, 1);
      assert.equal(find(after, 'luigion').luigionMushroomUsed, true);
      assert.equal(after.effectLog.filter(e => e.abilityMetadata).length, tier);
      const echo = cast({ ...after, playerMotion: 9, cpuMotion: 9 }, 'tayaty', owner, 2);
      assert.equal(echo.boards[0].filter(c => c.cardId === 'demario-mushroom').length, 1);
      assert.equal(echo.effectLog.filter(e => e.abilityMetadata).length, tier);
    }
  });
  test(`${owner}: Luigion counts legacy and other Luigion characters, but not tokens, supports, enemies or hazards`, () => {
    const enemy = owner === 'player' ? 'cpu' : 'player';
    for (const ally of [unit('rastamon', owner), unit('luigion', owner)]) {
      const m = blank(); m.boards[0] = [ally];
      const after = cast(m, 'luigion', owner);
      assert.equal(after.boards[0].find(c => c.instanceId === ally.instanceId)!.powerModifier, 1);
      assert.equal(after.boards[0].find(c => c.instanceId === `${owner}:cast:0:luigion`)!.powerModifier, 1);
    }
    for (const invalid of [
      unit('rastamon', enemy), { ...unit('rastamon', owner), kind: 'token' as const },
      { ...unit('rastamon', owner), kind: 'support' as const }, { ...unit('rastamon', owner), hazard: true as const },
    ]) {
      const m = blank(); m.boards[0] = [invalid];
      const after = cast(m, 'luigion', owner);
      assert.equal(find(after, 'luigion').powerModifier, 2);
      assert.equal(after.boards[0].find(c => c.instanceId === invalid.instanceId)!.powerModifier, 0);
    }
  });
  test(`${owner}: disabled Luigion cannot consume or train; ordinary consumers still get only +1`, () => {
    for (const powered of [false, true]) for (const status of ['silenced', 'frozen', 'weakened'] as const) {
      const setup = cast(blank(), 'demario', owner), source = createCardInstance('luigion', owner);
      source.statuses[status] = true;
      const hand = owner === 'player' ? 'playerHand' : 'cpuHand';
      const after = playTurnCard({ ...setup, phase: owner === 'player' ? 'player' : 'cpu-reveal', [hand]: [source] }, owner, source.instanceId, 0, powered);
      assert.equal(find(after, 'luigion').powerModifier, powered ? 2 : 0);
      assert(find(after, 'demario-mushroom'));
    }
    const setup = cast(blank(), 'demario', owner);
    const after = cast(setup, 'rastamon', owner);
    assert.equal(find(after, 'rastamon').powerModifier, 1);
    assert.equal(find(after, 'demario-mushroom'), undefined);
  });
  test(`${owner}: Oz echoes cannot consume another Mushroom; return and redeploy can`, () => {
    let m = cast(blank(), 'demario', owner);
    const mushroom = find(m, 'demario-mushroom');
    m.boards[0].push({ ...mushroom, instanceId: 'spare' });
    m = cast(m, 'luigion', owner);
    const source = find(m, 'luigion');
    m = cast({ ...m, playerMotion: 9, cpuMotion: 9 }, 'oz', owner, 1);
    assert.equal(m.boards[0].filter(c => c.cardId === 'demario-mushroom').length, 1);
    // Dorothy selects the weakest printed-two character: ensure it is Luigion.
    m.boards[0] = m.boards[0].map(c => c.instanceId === source.instanceId ? { ...c, powerModifier: -1 } : c);
    m = cast({ ...m, playerMotion: 9, cpuMotion: 9 }, 'dorothy', owner);
    const hand = owner === 'player' ? 'playerHand' : 'cpuHand';
    const returned = m[hand].find(c => c.instanceId === source.instanceId)!;
    assert(returned);
    // Dorothy was an ordinary consumer and used the spare; place a fresh local resource.
    m.boards[0].push({ ...mushroom, instanceId: 'redeploy-resource' });
    const after = playTurnCard({ ...m, playerMotion: 9, cpuMotion: 9 }, owner, returned.instanceId, 0);
    assert.equal(find(after, 'luigion').powerModifier, 3);
    assert.equal(after.boards[0].some(c => c.instanceId === 'redeploy-resource'), false);
  });
}