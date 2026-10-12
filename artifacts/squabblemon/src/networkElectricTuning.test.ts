import test from 'node:test';
import assert from 'node:assert/strict';
import {cards} from '../../../lib/squabblemon-engine/src/data';
import {createMatch,createCardInstance,playTurnCard,nextRound,type Match} from './gameEngine';
for(const owner of ['player','cpu'] as const){
 const key=owner==='player'?'playerMotion':'cpuMotion',hand=owner==='player'?'playerHand':'cpuHand';
 test(`${owner}: Techbro borrows one, repays unspent funding and cannot borrow twice after return`,()=>{
  const source=createCardInstance('techbro',owner,'funding',1);
  const initial:Match={...createMatch('block','block'),round:3,phase:owner==='player'?'player':'cpu-reveal',boards:[[],[],[]],playerHand:[],cpuHand:[],[hand]:[source],[key]:3};
  const after=playTurnCard(initial,owner,source.instanceId,0);
  assert.equal(after[key],1);
  const next=nextRound({...after,phase:'resolved'});
  assert.equal(next[key],4,'unspent loan is repaid without reducing next round');
  const body=after.boards.flat().find(c=>c.instanceId===source.instanceId)!;
  const replay=playTurnCard({...after,boards:[[],[],[]],[key]:3,[hand]:[{...body,lane:null}],phase:initial.phase},owner,source.instanceId,1);
  assert.equal(replay[key],0,'returning the same instance cannot repeat funding');
 });
 test(`${owner}: Boss Bae requires three Motion and keeps three Hands`,()=>{
  assert.equal(cards.bossbabe.cost,3);assert.equal(cards.bossbabe.power,3);
  const source=createCardInstance('bossbabe',owner,'network',2);
  const initial:Match={...createMatch('block','block'),phase:owner==='player'?'player':'cpu-reveal',boards:[[],[],[]],playerHand:[],cpuHand:[],[hand]:[source],[key]:2};
  assert.throws(()=>playTurnCard(initial,owner,source.instanceId,0),/Not enough Motion/);
  const after=playTurnCard({...initial,[key]:3},owner,source.instanceId,0);
  assert.ok(after.boards.flat().some(c=>c.instanceId===source.instanceId));assert.equal(after[key],0);
 });
}
