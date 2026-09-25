import './components/fadecade/stockzArcade.test';
import assert from 'node:assert/strict';
import test from 'node:test';
import { cards, catalogCardById, validateCardAbilityUpgrades } from '@workspace/squabblemon-engine/data';
import { createCardInstance, createMatch, playCard, nextRound, type Match, type Lane } from '@workspace/squabblemon-engine/gameEngine';
test('STOCKZ is a collectible Rare with valid upgrades and supplied portrait', () => {
  assert.equal(catalogCardById.stockz.rarity, 'Rare');
  assert.equal(cards.stockz.cost, 3); assert.equal(cards.stockz.power, 3);
  assert.equal(cards.stockz.artworkLayout, 'portrait'); validateCardAbilityUpgrades({ stockz: cards.stockz });
});
const investor = () => createCardInstance('stockz','player','test',0);
function addPlay(match: Match, cardId: string, index: number, lane: Lane, owner: 'player' | 'cpu' = 'player') {
  const card=createCardInstance(cardId,owner,'test',index);
  return playCard({...match,phase:owner==='player'?'player':'cpu-reveal',[owner==='player'?'playerHand':'cpuHand']:[card],[owner==='player'?'playerMotion':'cpuMotion']:9},owner,card.instanceId,lane);
}
const growth = (match: Match) => match.boards.flat().find(c=>c.cardId==='stockz')!.powerModifier;
test('Compound Interest grows on every later friendly character across districts and rounds without a cap', () => {
  const stockz=investor();
  let match=playCard({...createMatch('block','slide'),playerHand:[stockz],playerMotion:9},'player',stockz.instanceId,0);
  assert.equal(growth(match),0,'does not count its own entry');
  for(let i=1;i<=5;i++){
    match=addPlay(match,'edgar',i,(i%3) as Lane);
    assert.equal(growth(match),i);
    match=nextRound({...match,phase:'resolved'});
    assert.equal(growth(match),i,'earned Hands persist between rounds');
  }
  match=addPlay(match,'edgar',6,2);
  assert.equal(growth(match),6,'still triggers in the final round');
});
test('STOCKZ ignores supports and enemy plays, and disabled abilities do not trigger', () => {
  const stockz={...investor(),lane:0 as const};
  let match:Match={...createMatch('block','slide'),boards:[[stockz],[],[]]};
  match=addPlay(match,'charger',1,1); assert.equal(growth(match),0);
  match=addPlay(match,'edgar',2,1,'cpu'); assert.equal(growth(match),0);
  for(const status of ['silenced','frozen'] as const){
    const disabled={...stockz,statuses:{...stockz.statuses,[status]:true}};
    match=addPlay({...match,boards:[[disabled],[],[]]},'edgar',3,1);
    assert.equal(growth(match),0);
  }
});
