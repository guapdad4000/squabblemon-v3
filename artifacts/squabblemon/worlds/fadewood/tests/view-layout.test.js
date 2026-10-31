import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { fitViewFov } from '../src/view-layout.js';
import { characterCameraShot } from '../src/character-interactions.js';
import { ALL_CHARACTER_PLACEMENTS as CHARACTER_PLACEMENTS } from '../src/character-placements.js';

test('tall phone lenses widen the view without changing authored camera placement', () => {
  assert.equal(fitViewFov(58,{width:390,height:844}),80);
  assert.equal(fitViewFov(62,{width:320,height:568}),80);
  assert.equal(fitViewFov(fitViewFov(58,{width:390,height:844}),{width:390,height:844}),80);
  assert.equal(fitViewFov(58,{width:844,height:390}),58);
  assert.equal(fitViewFov(58,{width:1280,height:720}),58);
});

test('all twenty portrait close-ups keep the face above the dialogue sheet and inside narrow screens', () => {
  for(const viewport of [{width:320,height:568},{width:390,height:844},{width:430,height:932}]){
    for(const character of CHARACTER_PLACEMENTS){
      const shot=characterCameraShot(character,1,viewport);
      const camera=new PerspectiveCamera(shot.fov,viewport.width/viewport.height,.06,240);
      camera.position.copy(shot.position);camera.lookAt(shot.target);camera.rotateZ(shot.roll);camera.updateMatrixWorld(true);
      const face=new Vector3(...character.position);
      if(character.pose){face.x-=.7;face.y+=.4;}else face.y+=character.height*.85;
      face.project(camera);
      const screenY=(1-face.y)/2;
      assert.ok(Math.abs(face.x)<.85,`${character.id} face outside phone view`);
      assert.ok(screenY>.03&&screenY<.56,`${character.id} face covered by dialogue at ${screenY}`);
      const desktop=characterCameraShot(character,1);
      if(!character.pose)assert.deepEqual(shot.position,desktop.position,'portrait framing retains safe authored camera location');
    }
  }
});
