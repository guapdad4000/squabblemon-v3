import assert from 'node:assert/strict';
import test from 'node:test';
import { cards, cardCatalog, completeEngineCrew } from './data';
import { createAbilityUpgradeSnapshot, createCardInstance, createMatch, createMatchFromEngineCards, playTurnCard, pass, nextRound, revealCpuTurn, verifyMatchTranscript, type Match, type Owner, type PlayerMove } from './gameEngine';
import { STREET_WAVE } from '../../../lib/squabblemon-engine/src/streetWave';
import { moveAssignments, resolveSpecialMove } from './specialMoves';

const unit = (id: string, owner: Owner, index: number, lane: 0 | 1 | 2 = 0) => ({ ...createCardInstance(id, owner, 'street-wave', index), lane });
function setup(id: string, owner: Owner) {
  const opponent = owner === 'player' ? 'cpu' : 'player';
  const source = unit(id, owner, 0), ally = unit('cornball', owner, 1), item = unit('buspass', owner, 2);
  const enemy = unit('cornball', opponent, 3), bigEnemy = unit('hooper', opponent, 4);
  bigEnemy.powerModifier = 20;
  const remote = unit('plug', owner, 5, 1), remoteTwo = unit('hooper', owner, 6, 2);
  remoteTwo.powerModifier = 10;
  const match: Match = { ...createMatch('block', 'block'), round: 4, phase: owner === 'player' ? 'player' : 'cpu-reveal', playerMotion: 9, cpuMotion: 9,
    playerHand: owner === 'player' ? [source] : [], cpuHand: owner === 'cpu' ? [source] : [], boards: [[ally, item, enemy, bigEnemy], [remote], [remoteTwo]] };
  return { source, ally, item, enemy, bigEnemy, remote, remoteTwo, match };
}

for (const owner of ['player', 'cpu'] as const) test(`all 21 street fighters resolve their printed effects for ${owner}`, () => {
  for (const [id] of STREET_WAVE) {
    const { source, ally, item, enemy, bigEnemy, remote, remoteTwo, match } = setup(id, owner);
    ally.statuses.frozen = true; remote.statuses.silenced = true; remoteTwo.statuses.frozen = true;
    if (['homelessyn', 'divorceddad', 'incel'].includes(id)) match.boards[0] = [enemy, bigEnemy];
    const after = playTurnCard(match, owner, source.instanceId, 0);
    const find = (key: string) => after.boards.flat().find(c => c.instanceId === key)!;
    const selfBuff: Record<string, number> = { homelessyn: 2, sportsprodigy: 2, fein: 1, divorceddad: 2, failedathlete: 3, krump: 1 };
    if (id in selfBuff) assert.equal(find(source.instanceId).powerModifier, selfBuff[id], id);
    if (id === 'stud') { assert.equal(find(ally.instanceId).powerModifier, 1); assert(find(ally.instanceId).statuses.protected); }
    if (id === 'gothkid') { assert(find(enemy.instanceId).statuses.silenced); assert(!find(bigEnemy.instanceId).statuses.silenced); }
    if (id === 'redpill') { assert(find(bigEnemy.instanceId).statuses.weakened); assert(!find(bigEnemy.instanceId).statuses.silenced); assert(!find(enemy.instanceId).statuses.weakened); }
    if (id === 'stonerjr' || id === 'stonersr') { assert(!find(ally.instanceId).statuses.frozen); assert.equal(find(ally.instanceId).powerModifier, 1); assert(find(remote.instanceId).statuses.silenced); }
    if (id === 'bblnice' || id === 'failedrapper') { assert.equal(find(ally.instanceId).powerModifier, 1); assert.equal(find(item.instanceId).powerModifier, 0); }
    if (id === 'bbldemon') { assert.equal(find(enemy.instanceId), undefined, 'a one-Hands enemy is destroyed'); assert.equal(find(bigEnemy.instanceId).powerModifier, 19); }
    if (id === 'krump') assert.equal(find(bigEnemy.instanceId).powerModifier, 19);
    if (id === 'sportsprodigy') assert.equal(find(bigEnemy.instanceId).powerModifier, 19);
    if (id === 'break') { assert.equal(find(ally.instanceId).lane, 2, 'frozen fighters contribute no district Hands'); assert.equal(find(ally.instanceId).powerModifier, 1); }
    if (id === 'bboy') { assert.equal(find(source.instanceId).lane, 2); assert.equal(find(remoteTwo.instanceId).powerModifier, 11); }
    if (id === 'yunghustle') assert.equal(owner === 'player' ? after.playerMotion : after.cpuMotion, 9);
    if (id === 'simmy') { assert.equal(find(bigEnemy.instanceId).powerModifier, 17); assert.equal(find(ally.instanceId).powerModifier, 2); }
    if (id === 'foodz') for (const target of [ally, remote, remoteTwo]) { assert(!find(target.instanceId).statuses.frozen); assert(!find(target.instanceId).statuses.silenced); assert.equal(find(target.instanceId).powerModifier, target.powerModifier + 1); }
    assert(after.effectLog.some(e => e.type === 'ability'), id);
    assert.equal(ally.powerModifier, 0, 'input state is immutable');
  }
});

test('street fighters respect suppression, late-round conditions, and Motion cap', () => {
  for (const [id] of STREET_WAVE) for (const status of ['frozen', 'silenced'] as const) {
    const { source, match } = setup(id, 'player'); source.statuses[status] = true;
    const after = playTurnCard(match, 'player', source.instanceId, 0);
    assert.equal(after.playerMotion, 9 - source.cost, id);
    assert.equal(after.boards.flat().find(c => c.instanceId === source.instanceId)?.powerModifier, 0, id);
    assert.equal(after.boards.flat().find(c => c.cardId === 'hooper' && c.owner === 'cpu')?.powerModifier, 20, id);
  }
  for (const id of ['alchy', 'failedathlete']) {
    const { source, match } = setup(id, 'player'); match.round = 3;
    assert.equal(playTurnCard(match, 'player', source.instanceId, 0).boards[0].find(c => c.instanceId === source.instanceId)?.powerModifier, 0);
  }
  const { source, match } = setup('yunghustle', 'player'); source.cost = 0;
  assert.equal(playTurnCard(match, 'player', source.instanceId, 0).playerMotion, 9);
});

test('Red Pill rewards an already weakened target; STUD protects one hostile ability', () => {
  const red = setup('redpill', 'player'); red.bigEnemy.statuses.weakened = true;
  const afterRed = playTurnCard(red.match, 'player', red.source.instanceId, 0);
  assert.equal(afterRed.boards[0].find(c => c.cardId === 'redpill')?.powerModifier, 2);
  assert.equal(afterRed.boards[0].find(c => c.instanceId === red.bigEnemy.instanceId)?.statuses.silenced, true);
  const { source, ally, match } = setup('stud', 'player'); match.boards = [[ally], [], []];
  let m = playTurnCard(match, 'player', source.instanceId, 0);
  for (let n = 0; n < 2; n++) {
    const hostile = unit('gothkid', 'cpu', 20 + n);
    m = playTurnCard({ ...m, cpuHand: [hostile], cpuMotion: 9, phase: 'cpu-reveal' }, 'cpu', hostile.instanceId, 0);
    assert.equal(m.boards[0].find(c => c.instanceId === ally.instanceId)?.statuses.silenced, n === 1);
  }
});

test('Alchy trained tiers add one bounded round-end Hand each', () => {
  const playedSetup = setup('alchy', 'player');
  const played = playTurnCard(playedSetup.match, 'player', playedSetup.source.instanceId, 0);
  assert.equal(played.boards[0].find(c => c.instanceId === playedSetup.source.instanceId)?.powerModifier, 0, 'Ongoing grants no play-time Hands');

  for (const losing of [false, true]) {
    for (let tier = 0; tier <= 3; tier++) {
      const alchy = { ...unit('alchy', 'player', 30 + tier), lane: 0 as const };
      const enemy = { ...unit('hooper', 'cpu', 40 + tier), lane: 0 as const };
      const match: Match = {
        ...createMatch('vibes', 'vibes'),
        round: 4,
        phase: 'resolved',
        boards: [[alchy, ...(losing ? [enemy] : [])], [], []],
        abilityUpgradeSnapshot: createAbilityUpgradeSnapshot(['alchy'], [], {
          player: { alchy: { xp: 2800, level: 8, moveTier: tier } },
        }),
      };
      const after = nextRound(match);
      assert.equal(
        after.boards[0].find(c => c.instanceId === alchy.instanceId)?.powerModifier,
        (losing ? 2 : 1) + tier,
        `${losing ? 'losing' : 'even'} tier ${tier}`,
      );
    }
  }

  assert(cards.alchy.abilityUpgrades.every(upgrade => upgrade.description.includes('round end')));
});

test('new fighters are collectible, trained and use replaceable special-move fallbacks', () => {
  assert.equal(STREET_WAVE.length, 21);
  for (const [id, artwork, , rarity] of STREET_WAVE) {
    const entry = cardCatalog.find(c => c.engineId === id)!;
    assert(entry); assert.equal(entry.catalogId, artwork); assert.equal(entry.rarity, rarity);
    assert.equal(cards[id].abilityUpgrades?.length, 3);
    const delivered = id === 'simmy' ? 'char93' : id === 'foodz' ? 'char92' : null;
    assert.equal(moveAssignments[id], delivered);
    assert.equal(resolveSpecialMove(id)?.id ?? null, delivered);
  }
});

test('gangs containing every new fighter replay deterministically', () => {
  for (let offset = 0; offset < STREET_WAVE.length; offset += 10) {
    const crew = completeEngineCrew(STREET_WAVE.slice(offset, offset + 10).map(c => c[0]));
    let m = createMatchFromEngineCards('street', crew, 'block', createMatch('block', 'block').cpuCardIds);
    const initial = m, moves: PlayerMove[] = [];
    while (m.phase !== 'complete') {
      const card = m.playerHand.find(c => c.cost <= m.playerMotion);
      if (card) { moves.push({ endTurn: false, cardInstanceId: card.instanceId, lane: 0, squabble: false }); m = playTurnCard(m, 'player', card.instanceId, 0); }
      else { moves.push({ endTurn: true, cardInstanceId: null, lane: null, squabble: false }); m = nextRound(revealCpuTurn(pass(m, 'player'))); }
    }
    assert.deepEqual(verifyMatchTranscript('street', 'block', moves, initial.abilityUpgradeSnapshot, crew), m);
  }
});
