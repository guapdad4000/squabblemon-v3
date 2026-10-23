import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { onlineBattleProjection, onlinePresentationBoards } from '../components/MultiplayerBattle';
import { toPresentationEffect, onlineEffectPlan, useOnlineEffectPresenter, ONLINE_EFFECT_TIMING } from './useOnlineEffectPresenter';
import { ONLINE_BATTLE_SPEED } from '../battleSpeed';
import { effectsRoom, effectsView, effectsPlay } from '../../e2e/pvp-effects.scenarios';
import type { OnlineRoomView } from '@workspace/squabblemon-engine/multiplayer';

function scenario() {
  const initial = effectsRoom(), before = effectsView(initial), after = effectsView(effectsPlay(initial,'roaster'));
  const base = onlineBattleProjection(before), live = onlineBattleProjection(after);
  const events = after.events.flatMap(e => toPresentationEffect(e, after.seat, live.presentation.scores) ?? []);
  return { initial, before, after, base, live, events };
}
test('public knockout preserves targets through queued windup and hands off to death art at impact', () => {
  const { base, live, events } = scenario();
  const known = new Map(base.match.boards.flat().map(c => [c.instanceId,c]));
  const dead = events.flatMap(e => e.targets).find(p => p.before && !p.after && !p.departureCause)!;
  assert.ok(dead);
  const untouched = JSON.stringify(live.match.boards);
  const pending = onlinePresentationBoards(live.match.boards, events, known);
  assert.ok(pending.flat().some(c => c.instanceId === dead.cardInstanceId));
  const ability = events.find(e => e.targets.some(p => p.cardInstanceId === dead.cardInstanceId && !p.after))!;
  assert.ok(onlinePresentationBoards(live.match.boards,[ability],known).flat().some(c => c.instanceId === dead.cardInstanceId));
  assert.ok(!onlinePresentationBoards(live.match.boards,[{...ability,impact:true}],known).flat().some(c => c.instanceId === dead.cardInstanceId));
  assert.equal(JSON.stringify(live.match.boards),untouched,'server snapshot is never changed by presentation');
  assert.strictEqual(onlinePresentationBoards(live.match.boards,[],known),live.match.boards);
});
test('2x PvP preserves complete contact/ghost and only budgets a special once per fighter', () => {
  const { events } = scenario();
  const ability = events.find(e => e.type === 'ability')!;
  const plan = onlineEffectPlan(ability);
  assert.equal(ONLINE_BATTLE_SPEED,2);
  assert.equal(plan.impactMs,Math.ceil((plan.contactMs + 2760 + 80)/2));
  assert.ok(plan.playKey);
  const played = new Set([plan.playKey!]);
  const replay = onlineEffectPlan(ability,played);
  assert.equal(replay.playKey,null); assert.equal(replay.impactMs,2880);
  const noDeath = {...ability,targets:ability.targets.map(p=>({...p,after:p.before}))};
  assert.equal(onlineEffectPlan(noDeath,played).impactMs,325);
});
test('recorded Squabble aura persists for both seats after Hands change and on reconnect', () => {
  const room = effectsPlay(effectsRoom(),'hooper',2,true);
  const instance = room.match!.boards[2].find(c=>c.owner==='player')!;
  instance.powerModifier -= 1;
  // More than the 24-event wire window, without changing the original play.
  const last = room.match!.effectLog.at(-1)!;
  room.match!.effectLog.push(...Array.from({length:30},(_,i)=>({...last,sequence:last.sequence+i+1,type:'pass' as const,note:'Turn ended.'})));
  assert.ok(!effectsView(room).events.some(e=>e.note.includes('SQUABBLE')));
  for(const seat of ['player','cpu'] as const) {
    const projection = onlineBattleProjection(effectsView(room,seat));
    assert.ok(projection.presentation.squabbledIds?.has(instance.instanceId));
    assert.equal(projection.presentation.squabbledIds?.size,1);
    assert.equal(projection.match.boards[2].find(c=>c.instanceId===instance.instanceId)?.owner,seat==='player'?'player':'cpu');
  }
});
test('online queue orders arriving effects without restarting timers, drops hidden work and resets per game', async t => {
  const { before, after } = scenario();
  const timers = new Map<number,{ms:number;run:()=>void}>(); let id = 0;
  const document = Object.assign(new EventTarget(),{hidden:false});
  const replacements = { document, window: {setTimeout:(run:()=>void,ms:number)=>{timers.set(++id,{run,ms});return id;},clearTimeout:(key:number)=>timers.delete(key)}, IS_REACT_ACT_ENVIRONMENT:true };
  const original = Object.fromEntries(Object.keys(replacements).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value] of Object.entries(replacements))Object.defineProperty(globalThis,key,{configurable:true,value});
  let current!:ReturnType<typeof useOnlineEffectPresenter>;
  function Harness({room,disabled=false}:{room:OnlineRoomView;disabled?:boolean}) {
    current=useOnlineEffectPresenter(room,[],disabled);return null;
  }
  let view!:ReturnType<typeof create>;
  await act(async()=>{view=create(<Harness room={before}/>);});
  t.after(async()=>{await act(async()=>view.unmount());for(const [key,value]of Object.entries(original)){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}});
  const advance=async()=>{const [key,timer]=[...timers][0];timers.delete(key);await act(async()=>timer.run());return timer.ms;};
  await act(async()=>view.update(<Harness room={after}/>));
  assert.equal(current.effect?.type,'play');assert.equal(current.effect?.impact,false);
  assert.equal(timers.size,1);const existing=[...timers.keys()][0];
  const appended={...after,events:[...after.events,{...after.events.at(-1)!,sequence:after.events.at(-1)!.sequence+1}]};
  await act(async()=>view.update(<Harness room={appended}/>));
  assert.equal([...timers.keys()][0],existing,'receiving the next event must not restart the current beat');
  assert.equal(await advance(),ONLINE_EFFECT_TIMING.windupMs);assert.equal(current.effect?.impact,true);
  await advance();assert.equal(current.effect?.type,'ability');
  await advance();const plan=onlineEffectPlan(current.effect!);assert.equal(await advance(),plan.impactMs);
  assert.ok(current.playedSpecialMoves.has(plan.playKey!));assert.equal(current.effect?.impact,false);
  assert.equal(onlineEffectPlan(current.effect!,current.playedSpecialMoves).playKey,null);
  document.hidden=true;await act(async()=>{document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(current.effect,null);assert.equal(timers.size,0);assert.equal(current.pendingEffects.length,0);
  document.hidden=false;
  await act(async()=>view.update(<Harness room={{...before,gameNumber:before.gameNumber+1}}/>));
  assert.equal(current.playedSpecialMoves.size,0);assert.equal(current.effect,null);
  await act(async()=>view.update(<Harness room={{...after,gameNumber:before.gameNumber+1}} disabled/>));
  assert.equal(current.effect,null);assert.equal(timers.size,0);
});
