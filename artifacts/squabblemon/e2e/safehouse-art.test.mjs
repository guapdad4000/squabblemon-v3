import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const images = [
  ...['calendar','cork','events-title','fist-stamp','punch','wood-borders'].map(name => `assets/events/supplied/${name}`),
  'scenes/safehouse/concept',
];
for(const image of images) {
  test(`lossless Safehouse artwork preserves dimensions, visible RGB and transparency: ${image}`,async()=>{
    const png = new URL(`../public/${image}.png`,import.meta.url);
    const webp = new URL(`../public/${image}.webp`,import.meta.url);
    const original = await sharp(fileURLToPath(png)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const optimized = await sharp(fileURLToPath(webp)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.equal(optimized.info.width,original.info.width);
    assert.equal(optimized.info.height,original.info.height);
    assert.equal(optimized.info.channels,4);
    let changedPixels=0;
    for(let i=0;i<original.data.length;i+=4) {
      const a=original.data,b=optimized.data;
      // RGB in fully transparent pixels has no visual meaning; every visible
      // color channel and every alpha value must be identical.
      if(a[i+3]!==b[i+3] || a[i+3] && (a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])) changedPixels++;
    }
    assert.equal(changedPixels,0);
    assert.ok((await stat(webp)).size < (await stat(png)).size,'optimized file is smaller');
  });
}
