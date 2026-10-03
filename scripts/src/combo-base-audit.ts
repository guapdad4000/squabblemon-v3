import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { getMatchWinner } from '@workspace/squabblemon-engine/gameEngine';
import { evaluateBalanceState, greedyBalancePolicy, listLegalBalancePlays } from '@workspace/squabblemon-engine/balanceLab';
import { createRivalryRoom, applyRivalryCommand, rivalryRecipes } from './rivalry-online-model';
import { chainBalancePolicy, pairedSeededPolicy } from './rivalry-audit-policies';
import { allRankingDecks } from './all-decks-ranking-decks';
import { root, sourceHash } from './all-decks-ranking';
const label = process.argv[2];
assert(label && /^[a-z0-9-]+$/.test(label));
const output = root + '/scripts/results/combo-base/' + label + '.json';
assert(!existsSync(output));
const prefix = process.argv[3] ?? 'combo-base';
const decks = allRankingDecks();
const subjectId = process.argv[6] ?? 'starter-combo';
const baseCombo = decks.find(d => d.id === subjectId);
assert(baseCombo, `Unknown subject deck: ${subjectId}`);
const replacements = process.argv[5] ? JSON.parse(process.argv[5]) as Record<string,string> : {};
const combo = {...baseCombo, cardIds:baseCombo.cardIds.map(id=>replacements[id]??id)};
assert.equal(new Set(combo.cardIds).size,10);
const standardRivals = [
 { id:'blue', cardIds:rivalryRecipes.blue }, { id:'red', cardIds:rivalryRecipes.red },
 ...decks.filter(d => ['starter-block','starter-vibes'].includes(d.id))
];
const requestedIds = process.argv[4]?.split(',').filter(Boolean);
const rivals = requestedIds?.length ? requestedIds.map(id => {
 const deck = decks.find(d => d.id === id);
 assert(deck, `Unknown rival deck: ${id}`);
 return deck;
}) : standardRivals;
const hash = sourceHash();
const rows: any[] = [];
for (const rival of rivals) for (const policyName of ['greedy','chain','paired-seeded']) {
 for (let i=0;i<4;i++) for (const first of ['blue','red'] as const) for (const openingSeat of ['player','cpu'] as const) {
  const seed = prefix + '-' + i;
  const recipes = {blue:combo.cardIds, red:rival.cardIds};
  let room = createRivalryRoom({first,openingSeat,seed,tier:0,recipes});
  const policy = policyName === 'greedy' ? greedyBalancePolicy : policyName === 'chain' ? chainBalancePolicy : pairedSeededPolicy(seed);
  const actions: any[]=[];
  while(room.status !== 'complete') {
   const match=room.match!, owner=room.activeSeat;
   const legalPlays=listLegalBalancePlays(match,owner,true);
   const chosen=policy({match,owner,legalPlays,actionIndex:actions.length,seed,evaluate:evaluateBalanceState});
   const next=applyRivalryCommand(room,chosen ? {kind:'play',owner,id:chosen.instanceId,lane:chosen.lane,squabble:chosen.squabble}:{kind:'pass',owner});
   if(chosen) assert.deepEqual(next.match,chosen.preview);
   actions.push({round:match.round,combo:owner===(first==='blue'?'player':'cpu'),card:chosen?.cardId??null,hand:(owner==='player'?match.playerHand:match.cpuHand).map(c=>c.cardId)});
   room=next; assert(actions.length<100);
  }
  const winner=getMatchWinner(room.match!);
  const comboOwner = first === 'blue' ? 'player' : 'cpu';
  const board = room.match!.boards.map((lane, index) => ({
   lane:index,
   combo:lane.filter(card=>card.owner===comboOwner).map(card=>({id:card.cardId,hands:card.power+card.powerModifier,statuses:card.statuses})),
   rival:lane.filter(card=>card.owner!==comboOwner).map(card=>({id:card.cardId,hands:card.power+card.powerModifier,statuses:card.statuses})),
  }));
  rows.push({rival:rival.id,policy:policyName,seed,first,openingSeat,score:winner==='draw'?.5:winner===comboOwner?1:0,actions,board});
 }
 console.log(label+': '+rival.id+' '+policyName+' '+rows.length);
}
assert.equal(hash,sourceHash());
const score=(rs:typeof rows)=>({games:rs.length,score:rs.reduce((sum,r)=>sum+r.score,0)/rs.length});
const summary=rivals.map(r=>({rival:r.id,...score(rows.filter(x=>x.rival===r.id)),policies:Object.fromEntries(['greedy','chain','paired-seeded'].map(p=>[p,score(rows.filter(x=>x.rival===r.id&&x.policy===p))]))}));
mkdirSync(root+'/scripts/results/combo-base',{recursive:true});
writeFileSync(output,JSON.stringify({hash,excludedCardIds:['guap','folks'],tier:0,combo,rivals,summary,rows},null,2)+'\n');
console.log(JSON.stringify(summary));
