import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, DataTexture } from 'three';
import { surfacePlacements, SURFACE_TILES, createAnimeSurfaces } from '../src/anime-surfaces.js';

test('painted windows cover only the two housing blocks retained in the scene', () => {
  const windows = surfacePlacements().filter(p => p.name.includes('window'));
  assert.equal(windows.length, 66);
  for (const window of windows) {
    assert.ok(window.position[2] > -7 && window.position[2] < 18);
    assert.ok(window.position.every(Number.isFinite));
    assert.ok(SURFACE_TILES[window.tile]);
  }
});

test('the atlas uses one draw and leaves the park dojo and garage passage open', async () => {
  const scene = new Scene();
  const texture = new DataTexture(new Uint8Array([255,255,255,255]),1,1);
  const surfaces = await createAnimeSurfaces({parent:scene,texture});
  assert.equal(surfaces.group.children.length, 1);
  assert.equal(surfaces.stats.drawCalls, 1);
  assert.equal(surfaces.stats.textures, 1);
  assert.equal(surfaces.stats.doorways, 7);
  assert.equal(surfaces.panels.some(p=>/^(fade-park|dojo|open-garage) painted doorway/.test(p.name)),false);
  const parkSigns = surfaces.panels.filter(p => p.tile === 'park-sign');
  assert.equal(parkSigns.length, 1, 'the park has one compact sign, without a duplicate garden billboard');
  const sign = parkSigns[0];
  assert.ok(sign.size[0] <= 1.5 && sign.size[1] < 1.1);
  assert.ok(sign.position[1] - sign.size[1] / 2 > 2.5, 'the sign stays above the walkable opening');
  const [u0, v0, u1, v1] = sign.crop;
  assert.ok(Math.abs(sign.size[0] / sign.size[1] - (u1 - u0) / (v1 - v0)) < .000001, 'painted sign artwork keeps its source proportions');
  const uv = surfaces.group.children[0].geometry.attributes.uv;
  assert.ok(Array.from(uv.array).every(value=>Number.isFinite(value)&&value>=0&&value<=1));
  surfaces.dispose();texture.dispose();
  assert.equal(scene.children.length,0);
});
