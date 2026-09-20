import assert from 'node:assert/strict';
import test from 'node:test';
import { cards, catalogCardById, validateCardAbilityUpgrades, decks } from '@workspace/squabblemon-engine/data';
import { createCardInstance, createMatch, playCard, nextRound, getDistrictResults, getEffectiveCardPower, type Match, type Lane, type Owner, type CardInstance } from '@workspace/squabblemon-engine/gameEngine';
import { DISTRICT_CATALOG, type DistrictSnapshot } from '@workspace/squabblemon-engine/districts';
import { createOnlineRoom, joinOnlineRoom, applyOnlineCommand, onlineRoomView } from '@workspace/squabblemon-engine/multiplayer';

const bombs = (m: Match) => m.boards.flat().filter(c => c.cardId === 'smile-bomb');
const kyle = (m: Match) => m.boards.flat().find(c => c.cardId === 'kyle')!;
const enemyOf = (owner: Owner): Owner => owner === 'player' ? 'cpu' : 'player';
function reveal(owner: Owner = 'player', round = 3) {
  const actor = createCardInstance('kyle', owner, 'kyle-test', 0);
  const match = { ...createMatch('block', 'slide'), round, phase: owner === 'player' ? 'player' : 'cpu-reveal', playerMotion: 9, cpuMotion: 9,
    playerHand: owner === 'player' ? [actor] : [], cpuHand: owner === 'cpu' ? [actor] : [] } as Match;
  return playCard(match, owner, actor.instanceId, 0);
}
function target(owner: Owner, index: number, power: number, lane: Lane = 1): CardInstance {
  return { ...createCardInstance('edgar', owner, 'targets', index), lane, basePower: power };
}
function focused(m: Match, targets: CardInstance[], count = 4): Match {
  return { ...m, boards: [[kyle(m)], [...bombs(m).slice(0, count).map(c => ({ ...c, lane: 1 as Lane })), ...targets], []] };
}
const advance = (m: Match) => nextRound({ ...m, phase: 'resolved' });
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

test('KYLE is a collectible Legendary with the supplied portrait and valid upgrade path', () => {
  assert.equal(catalogCardById.kyle.rarity, 'Legendary');
  assert.equal(cards.kyle.cost, 4); assert.equal(cards.kyle.power, 4);
  assert.equal(cards.kyle.artworkLayout, 'portrait');
  validateCardAbilityUpgrades({ kyle: cards.kyle });
  assert.equal(catalogCardById['smile-bomb'], undefined);
});

for (const owner of ['player', 'cpu'] as const) {
  test(owner + ': four unique bombs land only on the opponent side and survive JSON save/reload', () => {
    const m = reveal(owner), planted = bombs(m);
    assert.equal(planted.length, 4);
    assert.equal(new Set(planted.map(c => c.instanceId)).size, 4);
    assert(planted.every(c => c.owner === enemyOf(owner) && c.lane !== null && c.smileBomb?.detonatesAtRound === 4));
    assert.deepEqual(reveal(owner).boards, m.boards, 'placement must replay exactly');
    const noBombs = { ...m, boards: m.boards.map(l => l.filter(c => !c.hazard)) as Match['boards'] };
    assert.deepEqual(getDistrictResults(m), getDistrictResults(noBombs), 'bombs give the enemy no lane score');
    assert.deepEqual(advance(m), advance(clone(m)), 'persisted fuse and random outcomes match');
    assert.equal(bombs(advance(m)).length, 0, 'empty-lane bombs fizzle next round');
  });
}

test('each of four explosions damages exactly one random enemy in its own lane, once', () => {
  let m = focused(reveal(), [target('cpu', 1, 10), target('cpu', 2, 10), target('cpu', 3, 10)]);
  m.boards[2].push(target('cpu', 4, 10, 2));
  assert(m.boards.flat().every(c => c.powerModifier === 0), 'no immediate damage');
  const beforeSequence = m.nextEventSequence;
  const after = advance(m);
  const explosions = after.effectLog.filter(e => e.sequence >= beforeSequence && /Smile Bomb hit/.test(e.note));
  assert.equal(explosions.length, 4);
  for (const event of explosions) {
    const hits = event.targets.filter(t => t.owner === 'cpu' && t.cardId !== 'smile-bomb' && t.before?.powerModifier !== t.after?.powerModifier);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].before!.powerModifier - hits[0].after!.powerModifier, 2);
    assert.equal(hits[0].before!.lane, 1);
    assert.equal(event.lane,1,"explosion cues use the bomb lane even when KYLE is elsewhere");
    const frame = { ...after, ...event.replay.after };
    assert.deepEqual(getDistrictResults(frame).map(({lane,player,cpu})=>({lane,player,cpu})), event.scores.after);
  }
  assert.equal(after.boards[1].reduce((n,c)=>n+c.powerModifier,0), -8);
  assert.equal(after.boards[2][0].powerModifier, 0);
  assert.equal(kyle(after).powerModifier, 4, 'each successful hit gives KYLE +1 Hands');
  assert.equal(bombs(after).length, 0);
  const again = advance(after);
  assert.equal(again.boards[1].reduce((n,c)=>n+c.powerModifier,0), -8, 'consumed bombs never fire twice');
});

test('four kills award exactly +8 persistent Hands to their KYLE, with no collateral damage', () => {
  const m = focused(reveal(), [1,2,3,4].map(i => target('cpu',i,1)));
  const after = advance(m);
  assert.equal(after.boards[1].length,0);
  assert.equal(kyle(after).powerModifier,8);
  assert.equal(getEffectiveCardPower(kyle(after)),12);
  assert.equal(kyle(advance(after)).powerModifier,8);
});

test('protection blocks bombs while mitigation absorbs one point without awarding a knockout', () => {
  for (const defense of ['church-protection','nail-mitigation','uncounterable','wifey'] as const) {
    const victim = target('cpu',1,2);
    let m = focused(reveal(), [victim], 1);
    if (defense === 'uncounterable') victim.statuses.uncounterable = true;
    else if (defense === 'wifey') {
      m.boards[1] = m.boards[1].filter(c => c.hazard);
      m.boards[1].push({...createCardInstance('wifey','cpu','defense',0),lane:1,basePower:1});
    } else m.timedEffects.push({id:defense,kind:defense,sourceInstanceId:victim.instanceId,targetInstanceId:victim.instanceId,owner:'cpu',lane:1,startsAtRound:3,expiresAtRound:7,expiration:'match-complete'});
    const after = advance(m);
    assert.equal(after.boards[1].length,1,defense);
    assert.equal(after.boards[1][0].powerModifier, defense === 'nail-mitigation' ? -1 : 0, defense);
    assert.equal(kyle(after).powerModifier, defense === 'nail-mitigation' ? 1 : 0, defense);
  }
});

test('Freeze is not a kill: underlying Hands must reach zero from bomb damage', () => {
  const victim = target('cpu',1,3); victim.statuses.frozen=true;
  const after = advance(focused(reveal(), [victim],1));
  assert.equal(after.boards[1][0].powerModifier,-2);
  assert.equal(kyle(after).powerModifier,1);
});

test('planted bombs keep their fuse after KYLE leaves, and removed bombs cannot detonate', () => {
  const m = focused(reveal(), [target('cpu',1,10)],2);
  m.boards[0]=[];
  m.boards[1]=m.boards[1].filter((c,i)=>i!==0);
  const after = advance(m);
  assert.equal(after.boards[1][0].powerModifier,-2);
  assert.equal(after.boards.flat().some(c=>c.cardId==='kyle'),false);
});

test('multiple KYLEs receive only their own bombs kill credit', () => {
  const m=focused(reveal(),[target('cpu',1,1),target('cpu',2,1)],2);
  const second={...createCardInstance('kyle','player','second',0),lane:0 as Lane};
  m.boards[0].push(second);
  bombs(m)[1].smileBomb!.sourceInstanceId=second.instanceId;
  const after=advance(m);
  assert.deepEqual(after.boards[0].map(c=>c.powerModifier),[2,2]);
});

test('hazards do not gain Hands or change gang-based district scoring', () => {
  const m=focused(reveal(),[target('cpu',1,3)]);
  for(const location of DISTRICT_CATALOG) {
    const snapshot:DistrictSnapshot={version:1,locations:[location,location,location]};
    const withBombs={...m,districtSnapshot:snapshot};
    const clean={...withBombs,boards:m.boards.map(l=>l.filter(c=>!c.hazard)) as Match['boards']};
    assert.deepEqual(getDistrictResults(withBombs),getDistrictResults(clean),location.id);
  }
  const rapper=createCardInstance('failedrapper','cpu','followup',0);
  const after=playCard({...m,phase:'cpu-reveal',cpuMotion:9,cpuHand:[rapper]},'cpu',rapper.instanceId,1);
  assert(bombs(after).every(c=>c.powerModifier===0));
});

test('silenced KYLE plants no bombs, and final-round fuses cannot create a seventh round', () => {
  const actor=createCardInstance('kyle','player','silent',0);actor.statuses.silenced=true;
  const m=playCard({...createMatch('block','slide'),playerHand:[actor],playerMotion:9},'player',actor.instanceId,0);
  assert.equal(bombs(m).length,0);
  const late=advance(focused(reveal('player',6),[target('cpu',1,1)]));
  assert.equal(late.phase,'complete');assert.equal(late.round,6);
  assert.equal(kyle(late).powerModifier,0,'there is no next round after round six');
});

test('host and guest see the same bomb placement, fuse, hits and kill rewards after both humans end the round', () => {
  for(const owner of ['player','cpu'] as const) {
    const member=(userId:string)=>({userId,name:userId,ready:false,deck:{...decks[0],cards:['kyle',...decks[0].cards.slice(0,9)]}});
    let room=createOnlineRoom(member('a'),owner,0);room=joinOnlineRoom(room,member('b'),0);
    room=applyOnlineCommand(room,'player',{type:'ready'},1);room=applyOnlineCommand(room,'cpu',{type:'ready'},2);
    const actor=createCardInstance('kyle',owner,'online-kyle',0);
    room.match={...room.match!,round:3,playerMotion:9,cpuMotion:9,playerHand:owner==='player'?[actor]:[],cpuHand:owner==='cpu'?[actor]:[],boards:[[],[],[]]};
    room=applyOnlineCommand(room,owner,{type:'play',instanceId:actor.instanceId,lane:0,squabble:false},3);
    const host=onlineRoomView(room,'KYLE','a',4),guest=onlineRoomView(room,'KYLE','b',4);
    assert.deepEqual(host.boards,guest.boards);
    assert.equal(host.boards.flat().filter(c=>c.cardId==='smile-bomb').length,4);
    assert(host.boards.flat().filter(c=>c.cardId==='smile-bomb').every(c=>c.smileBomb?.sourceOwner===owner));
    room.match=focused(room.match!,[1,2,3,4].map(i=>target(enemyOf(owner),i,1)));
    room=applyOnlineCommand(room,owner,{type:'end-turn'},5);
    assert.equal(bombs(room.match!).length,4,'first human ending does not detonate');
    const stored=clone(room);
    room=applyOnlineCommand(room,enemyOf(owner),{type:'end-turn'},6);
    assert.deepEqual(room,applyOnlineCommand(stored,enemyOf(owner),{type:'end-turn'},6));
    assert.equal(bombs(room.match!).length,0);
    assert.equal(kyle(room.match!).powerModifier,8);
    assert.deepEqual(onlineRoomView(room,'KYLE','a',7).boards,onlineRoomView(room,'KYLE','b',7).boards);
  }
});
