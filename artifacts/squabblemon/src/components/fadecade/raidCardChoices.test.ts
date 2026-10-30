import test from 'node:test';
import assert from 'node:assert/strict';
import { createBossRaid, applyBossAction, type BossRaidMode } from '@workspace/squabblemon-engine/bossRaid';
import { decks, engineIdsToCatalogIds } from '@workspace/squabblemon-engine/data';
import { createCardInstance } from '../../gameEngine';
import { legacyRaidCardQuote, raidCardChoices, raidExtraChoice } from './raidCardChoices';
const ids=engineIdsToCatalogIds(decks.find(deck=>deck.id==='block')!.cards);
for (const mode of ['precinct','kumite'] as BossRaidMode[]) for (const taxed of [false,true]) {
  for (const [id,squabble,investment] of [
    ['cornball',false,0],['cornball',true,0],['homelessguy',false,0],['homelessguy',false,2],['homelessguy',false,4],
    ['the-dice-game',false,0],['the-dice-game',false,2],['the-dice-game',false,3],['the-concert',false,0],['the-concert',false,1],
  ] as const) test(`${mode} native cost: ${id} squabble=${squabble} choice=${investment} RICO=${taxed}`,()=>{
    const run=createBossRaid('quote','2026-10-29',ids,'Native quote',undefined,mode);
    const card=createCardInstance(id,'player','quote',0);
    run.match.playerHand=[card];run.match.cpuMotion=9;
    if(taxed) run.match.boards[0]=[{...createCardInstance('raid-feds','cpu','tax',0),lane:0,playedRound:1}];
    const quote=legacyRaidCardQuote(run,card,0,squabble,investment);
    assert.equal(quote,card.cost + (taxed?1:0) + (id==='the-dice-game' ? investment||1 : id==='homelessguy' ? investment : 0));
    run.match.playerMotion=quote+1;
    const next=applyBossAction(run,{type:'play',instanceId:card.instanceId,lane:0,squabble,investment});
    if(id==='the-dice-game'){
      const dice=next.match.diceResult!;assert.equal(dice.wager,investment||1);
      const payout=dice.winner==='player'?dice.wager*2:dice.winner==='draw'?dice.wager:0;
      assert.equal(next.match.playerMotion,payout?Math.min(9,1+payout):1,'native charge before confirmed dice payout equals displayed quote');
    } else assert.equal(next.match.playerMotion,1,'native action charges exactly the displayed quote');
    if(taxed){assert.ok(next.used.includes('tax:0'));assert.equal(legacyRaidCardQuote(next,card,0,false,investment),quote-1,'RICO is charged only once per lane');}
  });
}
test('common optional choices expose only native supported values and clear ordinary choices',()=>{
  assert.deepEqual(raidCardChoices(createCardInstance('homelessguy','player'))?.options.map(option=>option.value),[0,1,2,3,4]);
  assert.deepEqual(raidCardChoices(createCardInstance('the-dice-game','player'))?.options.map(option=>option.value),[0,2,3]);
  assert.deepEqual(raidCardChoices(createCardInstance('the-concert','player'))?.options.map(option=>option.value),[0,1]);
  const ordinary=createCardInstance('cornball','player');assert.equal(raidCardChoices(ordinary),null);assert.equal(raidExtraChoice(ordinary,4),0);
});
