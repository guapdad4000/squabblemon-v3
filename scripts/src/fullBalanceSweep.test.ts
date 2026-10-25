import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createCardInstance, createMatch, getLegalCardCost, playTurnCard, type Match } from '@workspace/squabblemon-engine/gameEngine';
import { listLegalBalancePlays } from '@workspace/squabblemon-engine/balanceLab';
import { CARD_BALANCE_VERSION, ONLINE_RULES_VERSION } from '@workspace/squabblemon-engine/multiplayer';
import {
  assertPlanFingerprint, assertSuccessfulSummary, auditSeedNamespace, competitiveSchedule,
  evaluatePublicState, evaluateSweepContinuation, inventory, listLegalSweepPlays,
  planFingerprint, runtimeProvenance, scenario, simulateSweepCase, sweepRoot, SWEEP_POLICY_VERSION,
} from './fullBalanceSweepCore';

for (const count of [1, 3, 4, 46]) test(`competitive schedule covers ${count} decks including mirrors and equal seed exposure`, () => {
  const ids=Array.from({length:count},(_,i)=>`deck-${i}`);
  const schedule=competitiveSchedule(ids,'current-test');
  assert.equal(schedule.cases.length,count*(count+1)/2*16);
  assert.equal(new Set(schedule.cases.map(value=>value.key)).size,schedule.cases.length);
  const perPair=new Map<string,number>();
  for(const value of schedule.cases) {const key=[...([value.a,value.b].sort()),value.policy,value.seat].join('|');perPair.set(key,(perPair.get(key)??0)+1);}
  for(const a of ids) {
    assert.equal(schedule.perDeck[a],count*4);
    const seen=new Set(schedule.cases.filter(value=>value.a===a||value.b===a).map(value=>value.seed));
    assert.deepEqual([...seen].sort(),[...schedule.seeds].sort());
    for(const b of ids) for(const policy of ['greedy','chain-two']) for(const seat of ['a-player','b-player']) {
      const pair=[a,b].sort();
      assert.equal(perPair.get([...pair,policy,seat].join('|')),4);
    }
  }
});

test('plan identity rejects changed schedules and legacy plans, independently of object-key order', () => {
  const source={schemaVersion:2,sourceHash:'source',cases:[{b:2,a:1}],runtime:{node:process.version}};
  const plan={...source,planHash:planFingerprint(source)};
  assert.doesNotThrow(()=>assertPlanFingerprint(plan));
  assert.equal(plan.planHash,planFingerprint({runtime:source.runtime,cases:[{a:1,b:2}],sourceHash:'source',schemaVersion:2}));
  const tampered={...plan,cases:[{a:1,b:3}]};
  assert.throws(()=>assertPlanFingerprint(tampered),/Plan changed/);
  assert.throws(()=>assertPlanFingerprint({...plan,schemaVersion:1}),/Legacy plans/);
  assert.notEqual(plan.planHash,planFingerprint({...source,runtime:{node:'different'}}));
});

test('runtime exports resolve to audited source and run namespaces require an explicit current label', () => {
  const runtime=runtimeProvenance();
  assert.equal(runtime.node,process.version);
  assert.equal(runtime.engineSources.gameEngine,'lib/squabblemon-engine/src/gameEngine.ts');
  assert.equal(auditSeedNamespace('20261025-test'),`base-pvp-b${CARD_BALANCE_VERSION}-r${ONLINE_RULES_VERSION}-20261025-test`);
  assert.throws(()=>auditSeedNamespace(undefined),/unique run label/);
  assert.throws(()=>auditSeedNamespace('../old'),/unique run label/);
});

test('freshness gate rejects partial, failed, mismatched and unversioned summaries', () => {
  const plan={planHash:'plan',sourceHash:'source',cases:[1,2],balanceVersion:63,rulesVersion:63,policyVersion:SWEEP_POLICY_VERSION};
  const summary={schemaVersion:2,planHash:'plan',sourceHash:'source',balanceVersion:63,rulesVersion:63,policyVersion:SWEEP_POLICY_VERSION,status:'complete',scheduled:2,completed:2,successful:2,failures:[]};
  assert.doesNotThrow(()=>assertSuccessfulSummary(plan,summary));
  for(const change of [{status:'failed'},{successful:1},{completed:1},{scheduled:3},{failures:['failure']},{planHash:'other'},{sourceHash:'old'},{policyVersion:'old'},{schemaVersion:1}])
    assert.throws(()=>assertSuccessfulSummary(plan,{...summary,...change}));
});

function investmentMatch(motion=9):Match {
  return {...createMatch('vibes','vibes'),phase:'player',playerMotion:motion,cpuMotion:9,
    playerHand:[createCardInstance('homelessguy','player','paid-test',0)],
    squabbleByOwner:{player:false,cpu:false}};
}

test('all legal Homeless Guy Squabble investments preserve exact authoritative preview and cost', () => {
  const match=investmentMatch(),options=listLegalSweepPlays(match,'player');
  for(const squabble of [false,true]) for(let investment=0;investment<=4;investment++) {
    const option=options.find(value=>value.cardId==='homelessguy'&&value.lane===0&&value.squabble===squabble&&value.investment===investment);
    assert.ok(option,`missing squabble=${squabble}, investment=${investment}`);
    assert.deepEqual(option.preview,playTurnCard(match,'player',option.instanceId,option.lane,squabble,investment));
    const ordinary=options.find(value=>value.lane===0&&value.squabble===squabble&&value.investment===0)!;
    assert.equal(option.cost,ordinary.cost+investment);
  }
  const tight=investmentMatch(2);
  for(const option of listLegalSweepPlays(tight,'player')) assert.ok(option.cost<=2,'candidate must fit available Motion');
});

test('Dice wagers include their mandatory cost and Concert alternatives remain free mode choices', () => {
  for(const cardId of ['the-dice-game','the-concert']) {
    const match={...investmentMatch(),playerHand:[createCardInstance(cardId,'player','paid-choices',0)]};
    const options=listLegalSweepPlays(match,'player').filter(option=>option.lane===0);
    assert.deepEqual(options.map(option=>option.investment),cardId==='the-dice-game'?[0,2,3]:[0,1]);
    const base=getLegalCardCost(match,'player',match.playerHand[0],0);
    for(const option of options) {
      assert.equal(option.cost,base+(cardId==='the-dice-game'?(option.investment||1):0));
      assert.deepEqual(option.preview,playTurnCard(match,'player',option.instanceId,0,false,option.investment));
    }
    if(cardId==='the-dice-game') {
      const restricted=listLegalSweepPlays({...match,cpuMotion:1},'player');
      assert.ok(restricted.every(option=>option.investment===0),'both participants must afford the wager');
    }
  }
});

test('chain second ply evaluates paid continuations, not only zero-investment plays', () => {
  const match=investmentMatch();
  const unpaid=Math.max(evaluatePublicState(match,'player'),...listLegalBalancePlays(match,'player',true).filter(option=>option.investment===0).map(option=>evaluatePublicState(option.preview,'player')));
  const paid=evaluateSweepContinuation(match,'player');
  assert.ok(paid>unpaid,'a paid Homeless Guy continuation has real extra public-board value');
  assert.equal(paid,Math.max(evaluatePublicState(match,'player'),...listLegalSweepPlays(match,'player').map(option=>evaluatePublicState(option.preview,'player'))));
});

test('current catalog is fully partitioned and compact previews preserve authoritative online outcomes', () => {
  const inv=inventory();
  assert.equal(inv.represented+inv.missing.length,inv.catalog.length);
  assert.ok(inv.catalog.every(card=>Number.isFinite(card.power)&&card.catalogId&&card.rarity&&card.effect));
  const decks=new Map(inv.decks.map(deck=>[deck.id,deck]));
  for(const policy of ['greedy','chain-two'] as const) for(const seat of ['a-player','b-player'] as const) {
    const value=scenario({stage:'test',a:'starter-block',b:'focused-red-set',policy,seed:'harness-current-parity',rotation:5,tierA:0,tierB:0,seat});
    assert.deepEqual(simulateSweepCase(value,decks),simulateSweepCase(value,decks,undefined,false));
  }
});

test('CLI initialization is current, refuses overwrites and rejects tampered plans before running matches', () => {
  const directory=mkdtempSync(path.join(tmpdir(),'current-balance-harness-'));
  const command=(...args:string[])=>spawnSync(process.execPath,['--import','tsx','src/fullBalanceSweep.ts',...args],{cwd:path.join(sweepRoot,'scripts'),encoding:'utf8'});
  try {
    const initialized=command('init-competitive-fresh',directory,'unit-current');
    assert.equal(initialized.status,0,initialized.stderr);
    const plan=JSON.parse(readFileSync(path.join(directory,'plan.json'),'utf8'));
    assert.equal(plan.balanceVersion,CARD_BALANCE_VERSION);assert.equal(plan.rulesVersion,ONLINE_RULES_VERSION);
    assert.equal(plan.policyVersion,SWEEP_POLICY_VERSION);assertPlanFingerprint(plan);
    assert.equal(plan.cases.length,plan.decks.length*(plan.decks.length+1)/2*16);
    assert.ok(command('init-competitive-fresh',directory,'unit-current').status!==0);
    plan.cases[0].seed='tampered';writeFileSync(path.join(directory,'plan.json'),JSON.stringify(plan));
    const worker=command('worker',directory,'0','4');
    assert.notEqual(worker.status,0);assert.match(worker.stderr,/Plan changed after initialization/);
  } finally {rmSync(directory,{recursive:true,force:true});}
});
