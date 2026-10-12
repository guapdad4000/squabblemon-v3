import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArcadeGauge, ArcadeObjective, ArcadeMilestones } from './components/fadecade/ArcadePolish';
test('arcade health reads confirmed values and clamps invalid display bounds',()=>{
 for(const [value,max,expected] of [[42,100,42],[-3,48,0],[112,100,100]]){
  const html=renderToStaticMarkup(createElement(ArcadeGauge,{value,max,label:'Fighter',className:'arc-health'}));
  assert.ok(html.includes(`aria-valuenow="${expected}"`));
  assert.ok(html.includes('aria-label="Fighter health"'));
  assert.ok(html.includes('arcade-gauge__trail'));
 }
});
test('past ticket milestones remain earned without overfilling accessible progress',()=>{
 const html=renderToStaticMarkup(createElement(ArcadeObjective,{chapter:'Floor 4',title:'Waffles',detail:'Watch the plate',value:42,max:30,banked:150}));
 assert.ok(html.includes('aria-valuenow="30"'));
 assert.ok(html.includes('CLOUT BANKED'));
 const milestones=renderToStaticMarkup(createElement(ArcadeMilestones,{steps:[{at:12,label:'First ticket'},{at:30,label:'Second ticket'}],value:42}));
 assert.equal((milestones.match(/data-earned="true"/g)??[]).length,2);
});
