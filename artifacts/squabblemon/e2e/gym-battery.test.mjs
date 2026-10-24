import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../public/scenes/shared/three.module.js';

// Verbatim production sections from main 56f48cd; no reimplementation of its math.
const before = JSON.parse(readFileSync(new URL('./fixtures/gym-dents.before-battery.json', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../public/scenes/gym/scene.js', import.meta.url), 'utf8');
const after = {
  dent: source.slice(source.indexOf('    function dentHeavyBag('), source.indexOf('\n    function applyOmen(')),
  recovery: source.slice(source.indexOf('      if (heavyBagMesh && bagOriginalPositions'), source.indexOf('\n\n      if (finale && !finale.done)', source.indexOf('      if (heavyBagMesh && bagOriginalPositions'))),
  geometry: source.slice(source.indexOf('      const bagRadius ='), source.indexOf('      const bagTex =')),
};

function model(code) {
  const counts = { dentReads: 0, writes: 0, normals: 0 };
  const context = vm.createContext({ THREE });
  const state = vm.runInContext(`
    let bagOriginalPositions, bagVertexDents;
    const activeBagDents = new Set();
    ${code.geometry}
    const heavyBagMesh = { geometry: bagGeo };
    ${code.dent}
    const recover = delta => { ${code.recovery} };
    ({ dent: dentHeavyBag, recover, geometry: bagGeo, original: bagOriginalPositions,
       dents: bagVertexDents, active: activeBagDents,
       observe: observer => { bagVertexDents = observer(bagVertexDents); } });
  `, context);
  state.observe(array => new Proxy(array, {
    get(target, key) {
      if (typeof key === 'string' && /^\d+$/.test(key)) counts.dentReads++;
      return Reflect.get(target, key, target);
    },
  }));
  const position = state.geometry.attributes.position;
  const setZ = position.setZ.bind(position);
  position.setZ = (...args) => { counts.writes++; return setZ(...args); };
  const compute = state.geometry.computeVertexNormals.bind(state.geometry);
  state.geometry.computeVertexNormals = () => { counts.normals++; return compute(); };
  return { ...state, counts };
}

function same(a, b, message) {
  assert.deepEqual(b.geometry.attributes.position.array, a.geometry.attributes.position.array, `${message}: positions`);
  assert.deepEqual(b.geometry.attributes.normal.array, a.geometry.attributes.normal.array, `${message}: normals`);
  assert.deepEqual(new Uint8Array(b.dents.buffer), new Uint8Array(a.dents.buffer), `${message}: Float32 dents/residuals`);
  assert.equal(b.geometry.attributes.position.version, a.geometry.attributes.position.version, `${message}: uploads`);
  assert.equal(b.counts.writes, a.counts.writes, `${message}: vertex updates`);
  assert.equal(b.counts.normals, a.counts.normals, `${message}: normal updates`);
}

test('idle gym eliminates full recovery scans without geometry or upload changes', t => {
  const a = model(before), b = model(after), frames = 600;
  for (let frame = 0; frame < frames; frame++) { a.recover(1 / 60); b.recover(1 / 60); }
  same(a, b, 'idle');
  assert.equal(a.counts.dentReads, a.geometry.attributes.position.count * frames);
  assert.equal(b.counts.dentReads, 0);
  assert.equal(b.counts.normals, 0);
  t.diagnostic(`${frames} idle frames: dent reads ${a.counts.dentReads} -> ${b.counts.dentReads}`);
});

test('every recovery frame is byte-identical through repeated punches, low deltas and settling', t => {
  const a = model(before), b = model(after);
  const deltas = [1 / 60, 1 / 120, .04, 0, 1 / 30];
  for (let frame = 0; frame < 800; frame++) {
    if (frame < 140 && frame % 7 === 0) {
      const y = [.1, 1.9, -1.75, 0][(frame / 7) % 4];
      const intensity = .22 + (frame % 13) * .025;
      a.dent(y, intensity); b.dent(y, intensity);
    }
    a.recover(deltas[frame % deltas.length]); b.recover(deltas[frame % deltas.length]);
    same(a, b, `frame ${frame}`);
  }
  assert.equal(b.active.size, 0);
  assert.ok(b.dents.some(value => value !== 0 && Math.abs(value) <= .001), 'keep original final residual, do not snap to zero');
  assert.ok(b.counts.dentReads < a.counts.dentReads / 3);
  t.diagnostic(`repeated-punch trace: dent reads ${a.counts.dentReads} -> ${b.counts.dentReads}; identical ${b.counts.normals} normal updates`);
});

test('below-threshold hits and reactivation never lose a dent or add normal updates', () => {
  const a = model(before), b = model(after);
  for (const strength of [.0005, .001, .25, .00001, .47]) {
    a.dent(.1, strength); b.dent(.1, strength);
    for (let i = 0; i < 300; i++) {
      a.recover(.04); b.recover(.04);
      same(a, b, `strength ${strength}, step ${i}`);
    }
    assert.equal(b.active.size, 0);
  }
});

test('punch selection and frame gate/timing remain unchanged outside the tracked recovery set', () => {
  assert.equal(after.dent.replace('          activeBagDents.add(i);\n', ''), before.dent);
  assert.equal(after.geometry.replace('      activeBagDents.clear();\n', ''), before.geometry);
  assert.ok(source.includes('if(lastDraw&&now-lastDraw<1000/quality.fps)return;'));
  assert.ok(source.indexOf('if (hitStopRemaining > 0)') < source.indexOf(after.recovery));
  assert.ok(source.includes('const delta = Math.min(clock.getDelta(), 0.04);'));
});
