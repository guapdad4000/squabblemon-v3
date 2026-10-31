import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { authoringFile } from './helpers/verify-assets.mjs';
import { parseGlb } from '../scripts/verify-mobile-characters.mjs';

const hash = (data) => createHash('sha256').update(data).digest('hex');
const bytes = (asset, index) => {
  const view = asset.json.bufferViews[index], start = view.byteOffset ?? 0;
  return asset.bin.subarray(start, start + view.byteLength);
};

test('the shipped world retains master geometry and animation data with the independently pixel-verified image payloads', { skip: !process.env.FADEWOOD_AUTHORING_ROOT ? 'External world master is optional authoring evidence and never ships.' : false }, async () => {
  // Keep npm test Node-only. The separate verify:world command independently
  // decodes all pixels with Pillow, and browser material checks cover GLTFLoader.
  const [masterRaw, runtimeRaw, auditRaw] = await Promise.all([
    readFile(authoringFile('work/slim/squabble-block-master.glb')),
    readFile(new URL('../public/assets/squabble-block.glb', import.meta.url)),
    readFile(authoringFile('outputs/slim/world-audit.json')),
  ]);
  const audit = JSON.parse(auditRaw), source = parseGlb(masterRaw), runtime = parseGlb(runtimeRaw);
  assert.equal(hash(masterRaw), '3ec72bf8ee013859b71e2d9141a27b63393973a4242a35dd49e48757b65aa50c');
  assert.equal(hash(runtimeRaw), audit.runtimeSha256);
  assert.equal(runtimeRaw.length, audit.runtimeBytes);
  assert.ok(runtimeRaw.length < 17000000);
  const expected = structuredClone(source.json), imageViews = new Set();
  expected.buffers = structuredClone(runtime.json.buffers);
  expected.bufferViews = structuredClone(runtime.json.bufferViews);
  for (const field of ['extensionsUsed', 'extensionsRequired']) expected[field] = [...(expected[field] ?? []), 'EXT_texture_webp'];
  let converted = 0;
  for (const [index, image] of source.json.images.entries()) {
    imageViews.add(image.bufferView);
    const oldData = bytes(source, image.bufferView), newData = bytes(runtime, image.bufferView);
    assert.equal(hash(oldData), audit.images[index].sourceSha256);
    assert.equal(hash(newData), audit.images[index].runtimeSha256);
    assert.equal(audit.images[index].pixelsIdentical, true);
    if (image.mimeType === 'image/png') {
      converted += 1;
      assert.equal(newData.toString('ascii', 0, 4), 'RIFF');
      assert.equal(newData.toString('ascii', 8, 16), 'WEBPVP8L', 'use lossless WebP payloads');
      expected.images[index].mimeType = 'image/webp';
      for (const texture of expected.textures) if (texture.source === index) {
        delete texture.source;
        texture.extensions = { EXT_texture_webp: { source: index } };
      }
    } else assert.deepEqual(newData, oldData, 'the profiled JPEG is unchanged');
  }
  assert.equal(converted, 6);
  assert.deepEqual(runtime.json, expected, 'scene data and samplers only permit texture routing/offset changes');
  const retained = [];
  for (const [index, view] of source.json.bufferViews.entries()) {
    if (imageViews.has(index)) continue;
    assert.deepEqual(bytes(runtime, index), bytes(source, index), `geometry/animation view ${index}`);
    const { byteOffset: oldOffset, ...oldProperties } = view;
    const { byteOffset: newOffset, ...newProperties } = runtime.json.bufferViews[index];
    assert.deepEqual(newProperties, oldProperties);
    retained.push(bytes(runtime, index));
  }
  assert.equal(hash(Buffer.concat(retained)), 'f109a353b8edd5bfbf6d9945ae371e0a6df91999e17c0e815cd16419bbb8ed29');
});
