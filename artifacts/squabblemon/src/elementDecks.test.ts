import assert from 'node:assert/strict';
import test from 'node:test';
import { cards, catalogCardById } from './data';
import { createMatch, createCardInstance, playCard, playTurnCard, nextRound,
  suppressMatchPresentationEvents, DISTRICT_CATALOG, type Match, type CardInstance, type Owner, type Lane } from './gameEngine';

const unit = (id: string, owner: Owner, lane: Lane, index: number, power = 10): CardInstance =>
  ({ ...createCardInstance(id, owner, 'elements', index), lane, basePower: power, power });
const find = (m: Match, card: CardInstance) => m.boards.flat().find(c => c.instanceId === card.instanceId)!;
const blank = (): Match => ({ ...createMatch('block', 'combo'), round: 3, playerMotion: 9, cpuMotion: 9,
  playerHand: [], cpuHand: [], boards: [[], [], []] });
function cast(m: Match, id: string, owner: Owner = 'player', lane: Lane = 0, index = 0) {
  const source = createCardInstance(id, owner, 'cast', index);
  return { source, after: playCard({ ...m, phase: owner === 'player' ? 'player' : 'cpu-reveal',
    playerMotion: 9, cpuMotion: 9, [owner === 'player' ? 'playerHand' : 'cpuHand']: [source] },
  owner, source.instanceId, lane) };
}
function shield(m: Match, target: CardInstance) {
  target.statuses.protected = true;
  m.timedEffects.push({ id: 'shield:' + target.instanceId, kind: 'church-protection', owner: target.owner,
    sourceInstanceId: target.instanceId, targetInstanceId: target.instanceId, lane: target.lane!,
    startsAtRound: 1, expiresAtRound: 7, expiration: 'match-complete' });
}

test('existing Epic leaders retain their costs, IDs and base kits; Ashlee is Plant', () => {
  for (const id of ['piratedj', 'promoter', 'gamer']) {
    assert.equal(cards[id].cost, 3);
    assert.equal(catalogCardById[cards[id].id].rarity, 'Epic');
    assert.match(cards[id].effect, /On Reveal:/); assert.match(cards[id].effect, /Ongoing:/);
  }
  assert.equal(cards.ashlee.type, 'Plant'); assert.match(cards.ashlee.effect, /Plant allies in all three/);
  assert.equal(cards.ashlee.cost, 5); assert.equal(cards.ashlee.power, 3);
  assert.equal(cards.buddy.cost, 3); assert.equal(cards.folks.cost, 4);
  assert.equal(cards.buddy.type, 'Earth');
  assert.equal(cards.buddy.elementalBond, undefined, 'Buddy is an Earth character, not an elemental-bond engine');
});
for (const owner of ['player', 'cpu'] as const) test('DJ rewards exactly the second Electric character for ' + owner, () => {
  const m = blank(), dj = unit('piratedj', owner, 2, 1); m.boards[2] = [dj];
  const first = cast(m, 'nightcashier', owner);
  assert.equal(first.after.electricPlays?.[owner]?.count, 1);
  assert.equal(find(first.after, first.source).powerModifier, 0);
  const normal = cast(first.after, 'cornball', owner, 1, 1).after;
  assert.equal(normal.electricPlays?.[owner]?.count, 1);
  const second = cast(JSON.parse(JSON.stringify(normal)), 'streamer', owner, 1, 2);
  assert.equal(second.after[owner === 'player' ? 'playerMotion' : 'cpuMotion'], 8);
  assert.equal(find(second.after, second.source).powerModifier, 2, 'DJ bonus stacks with Streamer cheap-play bonus');
  const third = cast(second.after, 'techbro', owner, 2, 3);
  assert.equal(third.after[owner === 'player' ? 'playerMotion' : 'cpuMotion'], 9 - cards.techbro.cost + 2);
  assert.equal(third.after.electricPlays?.[owner]?.count, 3);
  assert.equal(third.after.leaderRounds?.[owner]?.piratedj, 3);
});
test('DJ can be the second Electric play, but a later DJ cannot grant an earlier missed refund', () => {
  const m = cast(blank(), 'nightcashier').after;
  const second = cast(m, 'piratedj', 'player', 1, 1);
  assert.equal(find(second.after, second.source).powerModifier, 1);
  assert.equal(second.after.playerMotion, 7);
  const missed = cast(m, 'streamer', 'player', 1, 2).after;
  const late = cast(missed, 'piratedj', 'player', 2, 3);
  assert.equal(late.after.playerMotion, 6); assert.equal(find(late.after, late.source).powerModifier, 0);
});
test('DJ refund respects the Motion cap, resets next round and never charges a negative cost', () => {
  const m = blank(), dj = unit('piratedj', 'player', 2, 1);
  const source = { ...createCardInstance('nightcashier', 'player'), cost: 0 };
  m.boards[2] = [dj]; m.electricPlays = { player: { round: 3, count: 1 } }; m.playerHand = [source];
  const after = playTurnCard(m, 'player', source.instanceId, 0);
  assert.equal(after.playerMotion, 9); assert.equal(find(after, source).powerModifier, 1);
  const next = nextRound({ ...after, phase: 'resolved', playerHand: [], cpuHand: [] });
  const first = cast(next, 'techbro', 'player', 1, 2).after;
  assert.equal(first.electricPlays?.player?.count, 1);
  const second = cast(first, 'nightcashier', 'player', 1, 3).after;
  assert.equal(second.leaderRounds?.player?.piratedj, 4);
});
for (const status of ['silenced', 'frozen', 'weakened'] as const) test('disabled DJ cannot refund: ' + status, () => {
  const m = blank(), dj = unit('piratedj', 'player', 2, 1);
  dj.statuses[status] = true; m.boards[2] = [dj]; m.electricPlays = { player: { round: 3, count: 1 } };
  const { after, source } = cast(m, 'nightcashier');
  assert.equal(after.playerMotion, 7); assert.equal(find(after, source).powerModifier, 0);
});
test('Electric supports and summons do not consume the second character trigger', () => {
  const m = blank(), dj = unit('piratedj', 'player', 2, 1);
  const support = { ...createCardInstance('firstaid', 'player'), type: 'Electric' };
  m.boards[2] = [dj]; m.playerHand = [support];
  const after = playTurnCard(m, 'player', support.instanceId, 0);
  assert.equal(after.electricPlays, undefined);
});

for (const owner of ['player', 'cpu'] as const) test('Promoter rewards successful Air movement, once per round, for ' + owner, () => {
  const m = blank(), leader = unit('promoter', owner, 2, 1); m.boards[2] = [leader];
  const first = cast(m, 'ogdominican', owner);
  assert.equal(find(first.after, first.source).powerModifier, 4, 'Block Shortcut +2 and Guest List +2');
  const second = cast(first.after, 'ogdominican', owner, 0, 1);
  assert.equal(find(second.after, second.source).powerModifier, 2, 'only Block Shortcut on second movement');
  assert.equal(second.after.leaderRounds?.[owner]?.promoter, 3);
});
test('Promoter ignores blocked movement and non-Air passengers', () => {
  for (const locked of [true, false]) {
    const m = blank(), promoter = unit('promoter', 'player', 2, 1);
    const passenger = unit(locked ? 'ogdominican' : 'cornball', 'player', 0, 2, 1);
    passenger.statuses.locked = locked; m.boards = [[passenger], [], [promoter]];
    const { after } = cast(m, 'conductor');
    assert.equal(after.leaderRounds?.player?.promoter, undefined);
    if (locked) { assert.equal(find(after, passenger).lane, 0); assert.equal(find(after, passenger).powerModifier, 0); }
  }
});
test('Promoter also sees district rides and settles before the next player action', () => {
  const m = blank(), leader = unit('promoter', 'player', 2, 1);
  m.boards[2] = [leader];
  m.districtSnapshot = { version: 1, locations: ['the-subway', 'county-jail', 'community-kitchen'].map(id => structuredClone(DISTRICT_CATALOG.find(d => d.id === id)!)) } as Match['districtSnapshot'];
  m.districtRuntime = { plays: { player: [0,0,0], cpu: [0,0,0] }, roundPlays: { player: [0,0,0], cpu: [0,0,0] },
    trailing: { player: [false,false,false], cpu: [false,false,false] }, trappedCardIds: [], detainedCardIds: [] };
  const { after, source } = cast(m, 'dragonflyjones');
  assert.equal(find(after, source).lane, 1); assert.equal(find(after, source).powerModifier, 3);
  assert.equal(after.pendingLeaderReactions?.length, 0);
});

for (const owner of ['player', 'cpu'] as const) test('Gamer and Counter reward actual disruption for ' + owner, () => {
  const enemy: Owner = owner === 'player' ? 'cpu' : 'player';
  const m = blank(), gamer = unit('gamer', owner, 2, 1, 5), counter = unit('counter', owner, 2, 2, 6);
  const ally = unit('nerd', owner, 1, 3, 1), foe = unit('hooper', enemy, 0, 4);
  m.boards = [[foe], [ally], [gamer, counter]];
  const first = cast(m, 'subwaymagician', owner).after;
  assert.equal(find(first, foe).statuses.weakened, true);
  assert.equal(find(first, ally).powerModifier, 2);
  assert.equal(find(first, ally).statuses.protected, true);
  assert(first.timedEffects.some(e => e.targetInstanceId === ally.instanceId));
  const again = cast(first, 'nerd', owner, 0, 1).after;
  assert.equal(find(again, foe).statuses.silenced, true);
  assert.equal(find(again, ally).powerModifier, 2);
  assert.equal(again.effectLog.filter(e => e.note.startsWith('Mirror: successful disruption')).length, 1);
  assert.deepEqual(again.leaderRounds?.[owner], { gamer: 3, counter: 3 });
});
test('blocked, repeated, friendly-district and already-present statuses never farm Dark leader bonuses', () => {
  for (const reason of ['protected', 'already-silenced', 'frozen-only'] as const) {
    const m = blank(), gamer = unit('gamer', 'player', 2, 1), counter = unit('counter', 'player', 2, 2);
    const enemy = unit('hooper', 'cpu', 0, 3); m.boards = [[enemy], [], [gamer, counter]];
    if (reason === 'protected') shield(m, enemy);
    if (reason === 'already-silenced') enemy.statuses.silenced = true;
    const { after } = cast(m, reason === 'frozen-only' ? 'snow' : 'nerd');
    assert.equal(after.leaderRounds?.player?.gamer, undefined);
    assert.equal(after.leaderRounds?.player?.counter, undefined);
  }
});
test('normal Buddy Buds do not invoke the retired Mythical disruption kit', () => {
  const m = blank(), gamer = unit('gamer', 'player', 2, 1, 1);
  const enemy = unit('leroy', 'cpu', 0, 2, 10);
  m.boards = [[enemy], [], [gamer]];
  const { after } = cast(m, 'buddy');
  assert.equal(find(after, gamer).powerModifier, 0);
  assert.equal(find(after, enemy).powerModifier, 0);
  assert.equal(find(after, enemy).statuses.silenced, false);
});
for (const status of ['silenced', 'frozen', 'weakened'] as const) test('disabled Gamer and Counter cannot react: ' + status, () => {
  const m = blank(), gamer = unit('gamer', 'player', 2, 1), counter = unit('counter', 'player', 2, 2);
  gamer.statuses[status] = true; counter.statuses[status] = true;
  m.boards = [[unit('hooper', 'cpu', 0, 3)], [], [gamer, counter]];
  const { after } = cast(m, 'nerd');
  assert.equal(after.leaderRounds, undefined);
});
test('Dark leaders trigger again next round, while copies share each per-side cap', () => {
  const m = blank(), gamer = unit('gamer', 'player', 2, 1, 5);
  const copy = { ...unit('scammer', 'player', 1, 2, 1), copiedAbilityCardId: 'gamer' };
  const foe = unit('hooper', 'cpu', 0, 3);
  m.boards = [[foe], [copy], [gamer]];
  const first = cast(m, 'nerd').after;
  assert.equal(find(first, copy).powerModifier, 2);
  const next = nextRound({ ...first, phase: 'resolved', playerHand: [], cpuHand: [] });
  const again = cast(next, 'subwaymagician').after;
  assert.equal(again.leaderRounds?.player?.gamer, 4);
  const darkTotal = (match: Match) => match.boards.flat().filter(c => c.owner === 'player').reduce((sum, c) => sum + c.powerModifier, 0);
  assert.equal(darkTotal(again) - darkTotal(next), 2, 'the new round buffs the current weakest Dark ally once');
});

for (const owner of ['player', 'cpu'] as const) test('Stewards enhance existing Air allies and preserve both artwork IDs for ' + owner, () => {
  const m = blank(), ally = unit('promoter', owner, 0, 1, 1); m.boards[0] = [ally];
  const { after } = cast(m, 'captainjigga', owner);
  assert.equal(find(after, ally).powerModifier, 2);
  const stewards = after.boards[0].filter(c => c.cardId === 'steward');
  assert.deepEqual(stewards.map(c => c.id), ['steward', 'steward-blue']);
  assert(stewards.every(c => c.basePower === 2));
});
test('Ashlee rewards a full Plant spread; Air cards and Guyana do not fill missing Plant districts', () => {
  for (const full of [true, false]) {
    const m = blank(), local = unit('promoter', 'player', 0, 1);
    const plant = unit('gardener', 'player', 1, 2, 1);
    const remote = unit(full ? 'rastamon' : 'promoter', 'player', 2, 3, 2);
    m.boards = [[local], [plant], [remote]];
    const { after, source } = cast(m, 'ashlee');
    assert.equal(find(after, local).powerModifier, 1, 'original local crew buff stays');
    assert.equal(find(after, source).type, 'Plant');
    assert.equal(find(after, source).powerModifier, full ? 1 : 0);
    assert.equal(find(after, plant).powerModifier, full ? 1 : 0);
    assert.equal(find(after, remote).powerModifier, full ? 1 : 0);
    const guyana = after.boards.flat().find(c => c.cardId === 'guyana')!;
    assert.equal(guyana.type, 'Earth'); assert.equal(guyana.basePower, 4); assert(guyana.statuses.uncounterable);
  }
});
test('Conductor cleanses moved passengers and gives Water +4 total Hands', () => {
  for (const id of ['snow', 'cornball'] as const) {
    const m = blank(), passenger = unit(id, 'player', 0, 1, 2);
    passenger.statuses = { ...passenger.statuses, frozen: true, silenced: true, weakened: true, burnStacks: 3 };
    m.boards[0] = [passenger];
    const { after } = cast(m, 'conductor');
    const moved = find(after, passenger);
    assert.equal(moved.lane, 1); assert.equal(moved.powerModifier, id === 'snow' ? 4 : 3);
    assert.equal(moved.statuses.frozen, false); assert.equal(moved.statuses.silenced, false);
    assert.equal(moved.statuses.weakened, false); assert.equal(moved.statuses.burnStacks, 0);
  }
});
test('Conductor movement can trigger Promoter, and a cleansed Light passenger can trigger Medic', () => {
  for (const [leaderId, passengerId, burn] of [['promoter', 'ogdominican', false], ['nightmedic', 'church', true]] as const) {
    const m = blank(), leader = unit(leaderId, 'player', 2, 1), passenger = unit(passengerId, 'player', 0, 2, 2);
    if (burn) passenger.statuses.burnStacks = 3;
    m.boards = [[passenger], [], [leader]];
    const { after } = cast(m, 'conductor');
    assert.equal(find(after, passenger).powerModifier, 5);
    assert.equal(after.leaderRounds?.player?.[leaderId], 3);
  }
});
test('new element reactions match AI search without presentation events', () => {
  const m = blank(), gamer = unit('gamer', 'player', 2, 1), promoter = unit('promoter', 'player', 2, 2);
  const counter = unit('counter', 'player', 2, 3), enemy = unit('hooper', 'cpu', 0, 4);
  m.boards = [[enemy], [], [gamer, promoter, counter]];
  const visible = cast(m, 'subwaymagician').after, search = cast(suppressMatchPresentationEvents(m), 'subwaymagician').after;
  assert.deepEqual(search.boards, visible.boards); assert.deepEqual(search.timedEffects, visible.timedEffects);
  assert.deepEqual(search.leaderRounds, visible.leaderRounds); assert.equal(search.effectLog.length, 0);
});

for (const owner of ['player', 'cpu'] as const) {
  for (const id of ['bottle', 'piratedj', 'dancecaptain']) test('Guest List includes ' + id + ' and shares the Air movement cap for ' + owner, () => {
    const m = blank(), leader = unit('promoter', owner, 2, 1);
    const guest = unit(id, owner, 0, 2, 1);
    m.boards = [[guest], [], [leader]];
    const moved = cast(m, 'conductor', owner).after;
    assert.notEqual(find(moved, guest).lane, 0);
    assert.equal(find(moved, guest).powerModifier, 5, 'Conductor +3 and Guest List +2');
    const air = cast(moved, 'ogdominican', owner, 0, 4);
    assert.equal(find(air.after, air.source).powerModifier, 2, 'Air shares the already-spent trigger');
    for (const status of ['silenced', 'frozen', 'weakened', 'locked'] as const) {
      const blocked = blank(), boss = unit('promoter', owner, 2, 1), passenger = unit(id, owner, 0, 2, 1);
      if (status === 'locked') passenger.statuses.locked = true;
      else boss.statuses[status] = true;
      blocked.boards = [[passenger], [], [boss]];
      const after = cast(blocked, 'conductor', owner).after;
      assert.equal(after.leaderRounds?.[owner]?.promoter, undefined);
    }
  });
}
