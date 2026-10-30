import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAnunakiRaid, applyAnunakiRaidAction, ANUNAKI_RAID_LOANER } from '@workspace/squabblemon-engine/anunakiRaid';
import { createCardInstance } from '../../gameEngine';
import { anunakiRaidCardCost, anunakiRaidCanPlay, anunakiRaidChoices, makeAnunakiRaidViewAdapter } from './anunakiRaidPresentation';

const create = () => createAnunakiRaid('view-contract', 'standard', ANUNAKI_RAID_LOANER);
test('Anu shares the boss raid view with the exact native match and district identity', () => {
  const raid = create(), original = structuredClone(raid), adapter = makeAnunakiRaidViewAdapter(raid);
  assert.equal(adapter.status.run?.match, raid.match);
  assert.equal(adapter.status.run?.revision, raid.revision);
  assert.deepEqual(adapter.identity.lanes, ['Tablet Archive','Arrival Gate','Celestial Conduit']);
  assert.equal(adapter.targetLane, raid.targetLane);
  assert.deepEqual(raid, original, 'presenting a raid cannot mutate authoritative state');
  assert.equal(adapter.mode, 'anunaki');
});
test('Anu legal targets and prices are the native rules for every initial hand card', () => {
  const raid = create();
  for (const card of raid.match.playerHand) for (const lane of [0,1,2] as const) for (const squabble of [false,true]) {
    let legal = true;
    try { applyAnunakiRaidAction(raid,{type:'play',instanceId:card.instanceId,lane,squabble}); } catch { legal = false; }
    assert.equal(anunakiRaidCanPlay(raid,card,lane,squabble,0),legal);
    if (legal) {
      const next = applyAnunakiRaidAction(raid,{type:'play',instanceId:card.instanceId,lane,squabble});
      assert.equal(raid.match.playerMotion - next.match.playerMotion,anunakiRaidCardCost(raid,card,lane,squabble,0));
    }
  }
});
test('ordinary fighter intents and quotes cannot inherit a hidden Homeless Guy investment', () => {
  const raid = create();
  const investor = createCardInstance('homelessguy','player','investment',0);
  const ordinary = createCardInstance('cornball','player','investment',1);
  raid.match.playerHand = [investor,ordinary]; raid.match.playerMotion = 6;
  assert.equal(anunakiRaidCardCost(raid,investor,0,false,2), investor.cost + 2);
  assert.equal(anunakiRaidCardCost(raid,ordinary,0,false,2), ordinary.cost);
  assert.equal(anunakiRaidCanPlay(raid,ordinary,0,false,9),true);
});
test('Anu preview uses native formation Hands and protection, with no precinct armor or multiplier', () => {
  const raid = create();
  const fighter = createCardInstance('cornball','player','preview',0);
  raid.match.boards[1] = [fighter];
  const open = makeAnunakiRaidViewAdapter(raid).preview;
  assert.equal(open.total,Math.max(0,open.hands[1]) * 2);
  raid.protection = true;
  const protectedPreview = makeAnunakiRaidViewAdapter(raid).preview;
  assert.equal(protectedPreview.total,Math.floor(open.total / 2));
  assert.deepEqual(protectedPreview.armor,[0,0,0]);
});
test('Anu tablet discount remains visible and legal through the shared raid controls', () => {
  const raid = create();
  const anu = createCardInstance('anu','player','discount',0);
  raid.match.playerHand = [anu];
  raid.match.ancientTablets = [{ owner:'player', lane:0 }];
  raid.match.playerMotion = Math.max(0,anu.cost - 2);
  const quote = anunakiRaidCardCost(raid,anu,2,false,0);
  assert.equal(quote,Math.max(0,anu.cost - 2));
  assert.equal(anunakiRaidCanPlay(raid,anu,2,false,0),true);
  const next = applyAnunakiRaidAction(raid,{type:'play',instanceId:anu.instanceId,lane:2});
  assert.equal(next.match.playerMotion,0);
  assert.equal(next.match.ancientTablets?.length ?? 0,0,'native play spends the quoted tablet');
});

test('Dice default wager and all displayed wager choices quote the native affordability gate', () => {
  for (const investment of [0,2,3]) {
    const raid = create(), dice = createCardInstance('the-dice-game','player','dice',0);
    raid.match.playerHand = [dice]; raid.match.cpuMotion = 9;
    const cost = anunakiRaidCardCost(raid,dice,0,false,investment);
    assert.equal(cost,dice.cost + (investment || 1));
    raid.match.playerMotion = cost;
    assert.equal(anunakiRaidCanPlay(raid,dice,0,false,investment),true);
    assert.doesNotThrow(()=>applyAnunakiRaidAction(raid,{type:'play',instanceId:dice.instanceId,lane:0,investment}));
    raid.match.playerMotion = cost - 1;
    assert.equal(anunakiRaidCanPlay(raid,dice,0,false,investment),false);
  }
  const choices = anunakiRaidChoices(createCardInstance('the-dice-game','player','choices',0));
  assert.deepEqual(choices?.options.map(option=>option.value),[0,2,3]);
});
test('Concert offers both native modes at the same base price', () => {
  for (const investment of [0,1]) {
    const raid = create(), concert = createCardInstance('the-concert','player','concert',0);
    raid.match.playerHand = [concert]; raid.match.playerMotion = concert.cost;
    raid.match.boards[1] = [createCardInstance('cornball','player','ally',0),{...createCardInstance('cornball','cpu','enemy',0),powerModifier:6}];
    assert.equal(anunakiRaidCardCost(raid,concert,1,false,investment),concert.cost);
    assert.equal(anunakiRaidCanPlay(raid,concert,1,false,investment),true);
    const next = applyAnunakiRaidAction(raid,{type:'play',instanceId:concert.instanceId,lane:1,investment});
    assert.equal(next.match.boards[1].find(card=>card.owner==='player')?.powerModifier,investment ? -1 : 3);
    assert.equal(next.match.boards[1].find(card=>card.owner==='cpu')?.powerModifier,investment ? 3 : 7);
  }
});
