import test from 'node:test';
import assert from 'node:assert/strict';
import {cards} from '../../../lib/squabblemon-engine/src/data';
import {createMatch,createCardInstance,playTurnCard,type Match} from './gameEngine';
for(const owner of ['player','cpu'] as const) test(`${owner}: Sneaker costs four and retains capped payoff plus Weaken`,()=>{
 const key=owner==='player'?'playerMotion':'cpuMotion',hand=owner==='player'?'playerHand':'cpuHand';
 const source=createCardInstance('sneaker',owner,'closer',1);
 const enemy={...createCardInstance('guap',owner==='player'?'cpu':'player','target',2),lane:0 as const};
 const m:Match={...createMatch('block','block'),round:4,boards:[[enemy],[],[]],playerHand:[],cpuHand:[],[hand]:[source],[key]:3,phase:owner==='player'?'player':'cpu-reveal'};
 assert.equal(cards.sneaker.cost,4);assert.equal(cards.sneaker.power,3);
 assert.throws(()=>playTurnCard(m,owner,source.instanceId,0),/Not enough Motion/);
 const after=playTurnCard({...m,[key]:4},owner,source.instanceId,0);
 assert.equal(after[key],0);
 assert.equal(after.boards.flat().find(c=>c.instanceId===source.instanceId)?.powerModifier,3);
 assert.equal(after.boards.flat().find(c=>c.instanceId===enemy.instanceId)?.statuses.weakened,true);
});
