import assert from 'node:assert/strict';
import test from 'node:test';
import React, { Profiler } from 'react';
import { act, create } from 'react-test-renderer';
import { BattleArtEffects } from './BattleArtEffects';
import type { PresentationEffect } from './PlayLoop';

const bounds={left:0,top:0,right:400,bottom:600,width:400,height:600};
test('confirmed art cues position without a nested React update and empty cues read no geometry',async t=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,'IS_REACT_ACT_ENVIRONMENT');
  const css=Object.getOwnPropertyDescriptor(globalThis,'CSS');
  Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{configurable:true,value:true});
  Object.defineProperty(globalThis,'CSS',{configurable:true,value:{escape:(s:string)=>s}});
  const restore=()=>{if(original)Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',original);else delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;if(css)Object.defineProperty(globalThis,'CSS',css);else delete (globalThis as any).CSS;};
  let reads=0,commits=0;
  const style={display:'none',left:'',top:'',setProperty:(key:string,value:string)=>{(style as any)[key]=value;}};
  const zone={getBoundingClientRect:()=>{reads++;return{...bounds,left:10,right:110,top:100,bottom:300,width:100,height:200};}};
  const root={getBoundingClientRect:()=>{reads++;return bounds;},querySelector:()=>zone};
  const host={closest:()=>root,querySelectorAll:()=>[{style}]};
  const effect={artCues:[]} as unknown as PresentationEffect;
  const render=(next:PresentationEffect)=><Profiler id="cues" onRender={()=>commits++}><BattleArtEffects effect={next} reducedMotion={false}/></Profiler>;
  let renderer:ReturnType<typeof create>;
  await act(async()=>{renderer=create(render(effect),{createNodeMock:element=>(element.props as {className?:string}).className==='battle-art-effects'?host:null});});
  t.after(async()=>{await act(async()=>renderer.unmount());restore();});
  assert.equal(reads,0);assert.equal(commits,1);
  const cue={id:'one',kind:'impact',owner:'player',lane:0,artwork:'combat/test',label:'Hit'};
  await act(async()=>renderer.update(render({...effect,artCues:[cue]} as unknown as PresentationEffect)));
  assert.equal(commits,2,'a landed cue adds only its parent render');
  assert.equal(style.display,'');assert.equal(style.left,'60px');assert.equal(style.top,'200px');
  const positionedReads=reads;
  await act(async()=>renderer.update(render(effect)));
  assert.equal(reads,positionedReads,'empty effects must not measure the arena');
});


test('multi-target art reads every anchor before writing and preserves clipped and missing target fallbacks', async t => {
  const previous = Object.fromEntries(['IS_REACT_ACT_ENVIRONMENT', 'CSS'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
  Object.defineProperty(globalThis, 'CSS', { configurable: true, value: { escape: (value: string) => value } });
  const operations: string[] = [];
  const read = (name: string, box: typeof bounds) => () => { operations.push(`read:${name}`); return box; };
  const zone = { getBoundingClientRect: read('zone', { ...bounds, left: 10, right: 110, top: 100, bottom: 300, width: 100, height: 200 }) };
  const visible = { closest: () => zone, getBoundingClientRect: read('visible', { ...bounds, left: 20, right: 60, top: 140, bottom: 200, width: 40, height: 60 }) };
  const clipped = { closest: () => zone, getBoundingClientRect: read('clipped', { ...bounds, left: 20, right: 60, top: 350, bottom: 410, width: 40, height: 60 }) };
  const field = { getBoundingClientRect: read('field', { ...bounds, top: 50, bottom: 550, height: 500 }) };
  const invalidZone = { getBoundingClientRect: read('invalid-zone', { ...bounds, right: 0, bottom: 0, width: 0, height: 0 }) };
  const root = {
    getBoundingClientRect: read('arena', bounds),
    querySelector: (selector: string) => selector === '.battlefield-grid' ? field
      : selector.includes('instance-id="visible"') ? visible
      : selector.includes('instance-id="clipped"') ? clipped
      : selector.includes('lane-2-player-zone') ? invalidZone : null,
  };
  const values: Record<string, string>[] = [];
  const nodes = ['visible', 'clipped', 'invalid'].map(name => {
    const value: Record<string, string> = { display: 'none', left: '', top: '' };
    values.push(value);
    const style = new Proxy({ setProperty: (key: string, next: string) => { operations.push(`write:${name}:${key}`); value[key] = next; } }, {
      set: (_target, key, next) => { operations.push(`write:${name}:${String(key)}`); value[String(key)] = next; return true; },
    });
    return { style };
  });
  const host = { closest: () => root, querySelectorAll: () => nodes };
  const common = { kind: 'impact', owner: 'player', lane: 0, artwork: 'combat/test', label: 'Hit' };
  const effect = { artCues: [
    { ...common, id: 'one', targetId: 'visible' },
    { ...common, id: 'two', targetId: 'clipped', fromId: 'visible' },
    { ...common, id: 'three', targetId: 'missing', lane: 2 },
  ] } as unknown as PresentationEffect;
  let renderer: ReturnType<typeof create> | undefined;
  t.after(async () => {
    if (renderer) await act(async () => renderer!.unmount());
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  let commits = 0;
  await act(async () => { renderer = create(<Profiler id="multi-cues" onRender={() => commits++}><BattleArtEffects effect={effect} reducedMotion={false} /></Profiler>, {
    createNodeMock: element => (element.props as { className?: string }).className === 'battle-art-effects' ? host : null,
  }); });
  assert.equal(commits, 1, 'multiple cues still position within the original commit');
  assert.ok(operations.findLastIndex(operation => operation.startsWith('read:')) < operations.findIndex(operation => operation.startsWith('write:')), 'all target geometry is captured before any cue style changes');
  assert.equal(operations.filter(operation => operation === 'read:visible').length, 1, 'a reused source keeps the existing point cache');
  assert.deepEqual(values, [
    { display: '', left: '40px', top: '170px', '--cue-x': '0px', '--cue-y': '18px' },
    { display: '', left: '60px', top: '200px', '--cue-x': '-20px', '--cue-y': '-30px' },
    { display: 'none', left: '', top: '' },
  ], 'visible targets, clipped targets, source vectors and invalid zones keep their exact presentation');
});
