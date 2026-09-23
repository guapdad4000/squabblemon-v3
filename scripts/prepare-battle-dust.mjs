/**
 * Preserve real VP9 alpha as a one-shot, mobile-safe animated WebP.
 * Requires ffmpeg with libvpx-vp9 and the web app's existing sharp package.
 * FFmpeg's default VP9 decoder silently discards the separate alpha plane.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { stat } from 'node:fs/promises';
import assert from 'node:assert/strict';

const sharp = createRequire(new URL('../artifacts/squabblemon/package.json', import.meta.url))('sharp');
const source = fileURLToPath(new URL('../artifacts/squabblemon/public/assets/effects/battle-start-smoke.webm', import.meta.url));
const target = source.replace(/\.webm$/, '.webp');
const result = spawnSync('ffmpeg', [
  '-v', 'error', '-y', '-c:v', 'libvpx-vp9', '-i', source,
  '-f', 'lavfi', '-i', 'color=c=black@0.0:s=480x270:r=12:d=0.083333,format=rgba',
  '-filter_complex', '[0:v]fps=12,scale=480:270:flags=lanczos,format=rgba[dust];[dust][1:v]concat=n=2:v=1:a=0[out]',
  '-map', '[out]', '-an', '-c:v', 'libwebp_anim', '-quality', '72',
  '-loop', '1', '-fps_mode', 'vfr', target,
], { stdio: 'inherit' });
assert.equal(result.status, 0, 'Dust conversion failed');

const metadata = await sharp(target, { animated: true }).metadata();
assert.equal(metadata.loop, 1, 'Dust must play only once');
const durationMs = metadata.delay.reduce((total, delay) => total + delay, 0);
assert.ok(durationMs <= 6200, 'Update the runtime deadline if source duration changes');
const { data, info } = await sharp(target, { page: metadata.pages - 1 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let i = 3; i < data.length; i += info.channels) {
  assert.equal(data[i], 0, 'The last frame must be completely transparent');
}
console.log(JSON.stringify({
  path: target, bytes: (await stat(target)).size, frames: metadata.pages,
  width: metadata.width, height: metadata.pageHeight, durationMs,
  loop: metadata.loop, lastFrameAlpha: [0, 0],
}));