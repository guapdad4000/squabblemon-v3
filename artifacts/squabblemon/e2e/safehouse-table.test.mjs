import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../public/scenes/shared/three.module.js';
import {createDominoTable,TABLE_SURFACE,TABLE_RADIUS} from '../public/scenes/safehouse/domino-table.js';

test('table props rest on the surface, fit inside the rim and do not overlap',()=>{
  const {cup,ash,remote,lamp}=createDominoTable(new T.Scene());
  const props=[cup,ash,remote,lamp];
  for(const p of props){
    const b=new T.Box3().setFromObject(p);
    assert.ok(b.min.y>=TABLE_SURFACE-1e-6,`${p.name} clips into the table`);
    assert.ok(b.min.y<=TABLE_SURFACE+.001,`${p.name} floats`);
    assert.ok(Math.hypot(p.position.x,p.position.z)+p.userData.footprintRadius<TABLE_RADIUS-.03,`${p.name} overhangs the rim`);
    for(const q of props.filter(q=>q!==p)){
      assert.ok(Math.hypot(p.position.x-q.position.x,p.position.z-q.position.z)>p.userData.footprintRadius+q.userData.footprintRadius,`${p.name} overlaps ${q.name}`);
    }
  }
  // The deck's existing world-space footprint extends toward the front edge.
  assert.ok(new T.Box3().setFromObject(cup).max.z<1.08,'cup intersects deck footprint');
});

test('mushroom lamp is a small warm practical without an extra shadow pass',()=>{
  const {lamp}=createDominoTable(new T.Scene());
  const size=new T.Box3().setFromObject(lamp).getSize(new T.Vector3());
  assert.ok(size.y<.5&&size.x<.5);
  const lights=[];lamp.traverse(o=>{if(o.isLight)lights.push(o);});
  assert.equal(lights.length,1);assert.equal(lights[0].castShadow,false);
  assert.ok(lights[0].color.r>lights[0].color.b);
});
