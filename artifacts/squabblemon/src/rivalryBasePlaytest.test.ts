import assert from 'node:assert/strict';
import test from 'node:test';
import { createRivalryRoom, applyRivalryCommand, rivalryRecipes, type RivalryCommand } from '../../../scripts/src/rivalry-online-model';
import { decks, cards } from '@workspace/squabblemon-engine/data';
import { greedyBalancePolicy, listLegalBalancePlays, evaluateBalanceState } from '@workspace/squabblemon-engine/balanceLab';
import { recommendedWorkshopCrews } from './lib/deckWorkshop';
const routes=decks.find(d=>d.id==='fitness-routes')!.cards;
const circuit=decks.find(d=>d.id==='fitness-circuit')!.cards;
const pairs=[['Blood/Crips',rivalryRecipes],...(['blue','red'] as const).flatMap(side=>[
 [`${side}/Inmate`,{blue:rivalryRecipes[side],red:recommendedWorkshopCrews.cellblock}],
 [`${side}/Routes`,{blue:rivalryRecipes[side],red:routes}],
 [`${side}/Circuit`,{blue:rivalryRecipes[side],red:circuit}],
] as const)] as const;
for(const [name,recipes] of pairs)for(const first of ['blue','red'] as const)test(`${name}, ${first} opens: base-only full match, seat-swapped draws, authority and replay`,()=>{
 const settings={recipes,first,tier:0,seed:`base-playtest-${name}`};
 const initial=createRivalryRoom(settings);let room=initial;
 const swapped=createRivalryRoom({...settings,first:first==='blue'?'red':'blue'});
 assert.deepEqual(initial.match!.playerCardIds,swapped.match!.cpuCardIds);
 assert.deepEqual(initial.match!.cpuCardIds,swapped.match!.playerCardIds);
 for(const side of ['player','cpu'] as const) {
  for(const progress of initial.match!.abilityUpgradeSnapshot[side])assert.deepEqual([progress.level,progress.moveTier,progress.upgradeIds.length],[1,0,0]);
  for(const card of initial.match![side==='player'?'playerHand':'cpuHand'])assert.equal(card.basePower,cards[card.cardId].power);
 }
 const commands:RivalryCommand[]=[];
 while(room.status==='active') {
  assert(commands.length<256);const match=room.match!,owner=room.activeSeat;
  const opener=match.round%2===1?'player':'cpu';
  assert.equal(owner,room.turnsEnded===0?opener:opener==='player'?'cpu':'player');
  const search={...match,[owner==='player'?'cpuHand':'playerHand']:[],playerCardIds:[],cpuCardIds:[],playerDrawIndex:0,cpuDrawIndex:0};
  const legal=listLegalBalancePlays(search,owner,true);
  const chosen=greedyBalancePolicy({match:search,owner,legalPlays:legal,actionIndex:commands.length,seed:settings.seed,evaluate:evaluateBalanceState});
  const command:RivalryCommand=chosen?{kind:'play',owner,id:chosen.instanceId,lane:chosen.lane,squabble:chosen.squabble}:{kind:'pass',owner};
  room=applyRivalryCommand(room,command);commands.push(command);
 }
 assert.equal(room.match!.round,6);assert(commands.some(c=>c.kind==='play'));assert.equal(room.match!.phase,'complete');
 assert.deepEqual(commands.reduce(applyRivalryCommand,createRivalryRoom(settings)),room);
 assert(!room.match!.effectLog.some(e=>e.abilityMetadata));
});
