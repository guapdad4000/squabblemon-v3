import assert from 'node:assert/strict';
import test from 'node:test';
import { createMatch, createCardInstance, nextRound, createAbilityUpgradeSnapshot, playTurnCard, getDistrictResults, getCharacterDistrictMarks, type CardInstance, type Lane, type Match, type Owner } from './gameEngine';
import { cards, decks, catalogCardById } from './data';
import { createOnlineRoom, joinOnlineRoom, onlineRoomView, ONLINE_RULES_VERSION, CARD_BALANCE_VERSION } from '../../../lib/squabblemon-engine/src/multiplayer';
import { battleChanges, isNeutralDeparture } from './battleChoreography';
import { asCard } from './components/MultiplayerBattle';
import { toPresentationEffect } from './lib/useOnlineEffectPresenter';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const end = (m: Match) => nextRound({ ...m, phase: 'resolved' });
const unit = (id: string, owner: Owner, lane: Lane, index = 0): CardInstance => ({ ...createCardInstance(id, owner, 'mary-fixture', index), lane, playedRound: 1 });
const find = (m: Match, card: CardInstance) => m.boards.flat().find(c => c.instanceId === card.instanceId);
const fixture = (owner: Owner, cents = 0): { m: Match; mary: CardInstance; foes: CardInstance[] } => {
  const m = { ...createMatch('block', 'block'), round: 1, boards: [[], [], []] as Match['boards'], playerHand: [], cpuHand: [] };
  const mary = { ...unit('ms-mary-mack', owner, 0), maryCents: cents, powerModifier: 2 };
  const enemy = owner === 'player' ? 'cpu' : 'player';
  const foes = [0, 1, 2].map(lane => ({ ...unit('og', enemy, lane as Lane, lane), basePower: 8 }));
  m.boards = [[mary, foes[0]], [unit('hooper', owner, 1), foes[1]], [unit('hooper', owner, 2, 2), foes[2]]];
  return { m, mary, foes };
};

test('Mary is one Mythical collectible: early 2/3, printed 15 Cents, no extra elephant fighter', () => {
  assert.equal(catalogCardById['ms-mary-mack'].rarity, 'Mythical');
  assert.equal(cards['ms-mary-mack'].cost, 2); assert.equal(cards['ms-mary-mack'].power, 3);
  assert.equal(cards['ms-mary-mack'].ability, '15 Cents'); assert(!cards['ms-mary-mack-elephant']);
  assert.equal(ONLINE_RULES_VERSION, 52); assert.equal(CARD_BALANCE_VERSION, 52);
});

for (const owner of ['player', 'cpu'] as const) {
  test(`${owner}: round-end board-wide cents cap, disappearance, next-round 4/4, buffs and independent slam`, () => {
    const { m, mary, foes } = fixture(owner); const initial = clone(m);
    const first = end(m);
    assert.deepEqual(m, initial); assert.equal(find(first, mary)?.maryCents, 9);
    assert(!find(first, mary)?.maryElephant); assert.equal(find(first, mary)?.basePower, 3);
    for (const foe of foes) assert.equal(find(first, foe)?.powerModifier, 0);
    const second = end(first), form = find(second, mary)!;
    assert.equal(second.round, 3); assert.equal(form.maryCents, 15); assert(form.maryElephant);
    assert.equal(form.instanceId, mary.instanceId); assert.equal(form.owner, owner); assert.equal(form.cardId, 'ms-mary-mack');
    assert.equal(form.cost, 4); assert.equal(form.power, 4); assert.equal(form.basePower, 4); assert.equal(form.powerModifier, 2);
    assert.equal(form.lane, 0); assert.equal(find(second, foes[0])?.powerModifier, -1);
    assert.equal(find(second, foes[1])?.powerModifier, 0); assert.equal(find(second, foes[2])?.powerModifier, 0);
    const vanish = second.effectLog.find(e => e.source?.departureCause === 'transformation')!;
    assert(vanish); assert.equal(vanish.type, 'expiration'); assert(!vanish.note.includes('destroyed'));
    assert(!vanish.replay.after.boards.flat().some(c => c.instanceId === mary.instanceId));
    assert(vanish.replay.after.creativeMarks?.some(x => x.kind === 'sl-mary-return'));
    assert(isNeutralDeparture(vanish.source!)); assert.deepEqual(battleChanges(vanish)[0].labels, ['15¢ · Returning next round']);
    assert.equal(end(second).effectLog.filter(e => e.source?.departureCause === 'transformation').length, 1);
    assert.deepEqual(end(clone(first)), second);
  });
  test(`${owner}: charges at round end only while active, and never steals currency or Hands`, () => {
    for (const status of ['silenced', 'frozen', 'weakened'] as const) {
      const { m, mary } = fixture(owner); mary.statuses[status] = true;
      assert.equal(find(end(m), mary)?.maryCents ?? 0, 0, status);
    }
    const { m, mary, foes } = fixture(owner);
    const charged = end(m); const event = charged.effectLog.find(e => e.cardInstanceId === mary.instanceId && e.note.startsWith('15 Cents: collected'))!;
    assert.deepEqual(event.resources.before, event.resources.after);
    for (const foe of foes) assert.equal(find(charged, foe)?.basePower, 8);
    m.boards = [[mary], [], []]; assert.equal(find(end(m), mary)?.maryCents, 0);
  });
  test(`${owner}: final round leaves charged Mary on board for scoring`, () => {
    const { m, mary } = fixture(owner, 12); m.round = 6;
    const result = end(m); assert.equal(result.phase, 'complete'); assert.equal(find(result, mary)?.maryCents, 15);
    assert(!find(result, mary)?.maryElephant); assert(!result.creativeMarks?.some(x => x.kind === 'sl-mary-return'));
  });
  test(`${owner}: every enemy in the landing lane is hit separately; Protection blocks its own hit`, () => {
    const { m, mary, foes } = fixture(owner, 12); m.boards = [[mary, ...foes.map(c => ({ ...c, lane: 0 as Lane }))], [unit('hooper', owner, 1)], [unit('hooper', owner, 2)]];
    m.boards[0][1].statuses.protected = true;
    m.timedEffects = [{ id: 'mary-shield', kind: 'church-protection', sourceInstanceId: foes[0].instanceId, targetInstanceId: foes[0].instanceId, owner: foes[0].owner, lane: 0, startsAtRound: 1, expiresAtRound: 5, expiration: 'round-start' }];
    const result = end(m);
    assert.equal(find(result, foes[0])?.powerModifier, 0);
    assert.equal(find(result, foes[1])?.powerModifier, -1); assert.equal(find(result, foes[2])?.powerModifier, -1);
    assert.equal(find(result, mary)?.basePower, 4);
  });
  test(`${owner}: online reconnect and both seat presentations keep the charge, form and neutral departure`, () => {
    const { m, mary } = fixture(owner, 12), result = end(m);
    const member = (userId: string) => ({ userId, name: userId, ready: false, deck: { ...decks[0], cards: [...decks[0].cards] } });
    const room = { ...joinOnlineRoom(createOnlineRoom(member('a'), 'player', 0), member('b'), 0), match: result };
    const view = onlineRoomView(clone(room), 'MARY', owner === 'player' ? 'a' : 'b', 10);
    const publicMary = view.boards.flat().find(c => c.instanceId === mary.instanceId)!;
    assert.equal(publicMary.maryCents, 15); assert(publicMary.maryElephant); assert.equal(asCard(publicMary).cost, 4);
    const vanish = view.events.find(e => e.participants?.some(p => p.departureCause === 'transformation'))!;
    for (const seat of ['player', 'cpu'] as const) {
      const effect = toPresentationEffect(vanish, seat, [])!;
      assert(isNeutralDeparture(effect.source!));
    }
    assert(!JSON.stringify(view).includes('replay')); assert(!JSON.stringify(view).includes('playerHand'));
  });
}

test('delayed arrival chooses weakest lane with capacity and ignores story location locks', () => {
  const { m, mary } = fixture('player', 12);
  // All three lanes are story-locked. A delayed form does not consult normal movement legality.
  m.storyRuntime = { activePhaseIndex: -1, appliedEffectIds: [], lanePowerBonuses: [], laneLocks: [{owner: 'player', lanes: [0, 1, 2]}] };
  const result = end(m); assert.equal(find(result, mary)?.lane, 0);
  assert.equal(getDistrictResults(result)[0].player, 6);
  assert(!getCharacterDistrictMarks(result).some(mark => mark.text.includes('elephant landing')));
});

test('same-round retry cannot collect twice, and destruction removes the ongoing collector', () => {
  const {m,mary}=fixture('player');const first=end(m);
  const repeated=end({...first,round:1});assert.equal(find(repeated,mary)?.maryCents,9);assert(!find(repeated,mary)?.maryElephant);
  const destroyed={...m,boards:m.boards.map(cs=>cs.filter(c=>c.instanceId!==mary.instanceId)) as Match['boards']};
  assert(!end(destroyed).creativeMarks?.some(x=>x.kind==='sl-mary-return'));
});

test('full lanes preserve a pending elephant and land when space opens without exceeding capacity', () => {
  const {m,mary}=fixture('player',12);const first=end(m);
  const vanish=first.effectLog.find(e=>e.source?.departureCause==='transformation')!;
  const pending={...m,...clone(vanish.replay.after),phase:'resolved' as const};
  pending.boards=([0,1,2] as Lane[]).map(lane=>Array.from({length:4},(_,index)=>unit('hooper','player',lane,index+lane*4))) as Match['boards'];
  const delayed=end(pending);assert(!find(delayed,mary));assert(delayed.creativeMarks?.some(x=>x.kind==='sl-mary-return'));
  const reopened={...delayed,boards:delayed.boards.map((cs,lane)=>lane===1?cs.slice(1):cs) as Match['boards']};
  const arrived=end(reopened);assert.equal(find(arrived,mary)?.lane,1);assert.equal(arrived.boards[1].filter(c=>c.owner==='player').length,4);
  assert(!arrived.creativeMarks?.some(x=>x.kind==='sl-mary-return'));
});

test('training happens after a real collection, carries into elephant, and never repeats', () => {
  const {m,mary}=fixture('player',12);
  m.abilityUpgradeSnapshot=createAbilityUpgradeSnapshot(['ms-mary-mack'],[],{player:{'ms-mary-mack':{level:8,xp:2800,moveTier:3}}});
  const result=end(m);assert.equal(find(result,mary)?.basePower,4);assert.equal(find(result,mary)?.powerModifier,5);
  assert(find(result,mary)?.waveTrainingUsed);assert.equal(find(end(result),mary)?.powerModifier,5);
});

test('a returned elephant costs 4 and stays 4 Hands instead of resetting to the human print',()=>{
  const {m,mary}=fixture('player',12);const transformed=end(m);
  const hatter=createCardInstance('madhatter','player','mary-return',0);
  const returned=playTurnCard({...transformed,playerHand:[hatter],playerMotion:20,phase:'player'},'player',hatter.instanceId,0);
  const inHand=returned.playerHand.find(c=>c.instanceId===mary.instanceId)!;
  assert(inHand);assert(inHand.maryElephant);assert.equal(inHand.cost,4);assert.equal(inHand.basePower,4);assert.equal(inHand.maryCents,15);
});

test('protection which expires at the return boundary cannot survive invisibly off-board',()=>{
  const {m,mary}=fixture('player',12);mary.statuses.protected=true;
  m.timedEffects=[{id:'mary-own-shield',kind:'church-protection',sourceInstanceId:mary.instanceId,targetInstanceId:mary.instanceId,owner:'player',lane:0,startsAtRound:1,expiresAtRound:2,expiration:'round-start'}];
  assert.equal(find(end(m),mary)?.statuses.protected,false);
});
