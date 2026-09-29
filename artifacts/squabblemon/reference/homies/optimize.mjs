// Rebuild the transparent runtime frames from the retained generated masters.
// Usage: node artifacts/squabblemon/reference/homies/optimize.mjs
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../../public/assets/homies');
mkdirSync(out, { recursive: true });

const frames = {
  phone: {
    master: 'squabble-phone-master.png',
    crop: '648x1024+188+0',
    canvas: null,
    width: 960,
    height: 1500,
    // Intentionally inset from the generated ink outline, not including it.
    aperture: { x: 86, y: 160, width: 791, height: 1239 },
    safeControls: { x: 102, y: 180, width: 759, height: 1199 },
  },
  tablet: {
    master: 'squabble-tablet-master.png',
    crop: '1010x695+8+167',
    canvas: '1112x695',
    width: 1600,
    height: 1000,
    aperture: { x: 189, y: 114, width: 1226, height: 770 },
    safeControls: { x: 206, y: 132, width: 1192, height: 734 },
  },
};

for (const [name, frame] of Object.entries(frames)) {
  const args = [resolve(here, frame.master), '-crop', frame.crop, '+repage'];
  if (frame.canvas) args.push('-background', 'none', '-gravity', 'center', '-extent', frame.canvas);
  args.push(
    '-filter', 'Lanczos', '-resize', `${frame.width}x${frame.height}!`,
    '-alpha', 'on',
    // Clear only the straight, unpainted central screen. Preserve all exterior contours.
    '(', '-size', `${frame.width}x${frame.height}`, 'xc:none',
    '-fill', 'white', '-stroke', 'none',
    '-draw', `rectangle ${frame.aperture.x},${frame.aperture.y} ${frame.aperture.x + frame.aperture.width - 1},${frame.aperture.y + frame.aperture.height - 1}`,
    ')', '-compose', 'DstOut', '-composite',
    '-define', 'webp:lossless=false', '-quality', '88',
    resolve(out, `squabble-${name}.webp`),
  );
  execFileSync('magick', args);
}

writeFileSync(resolve(out, 'safe-control-bounds.json'), JSON.stringify({
  coordinateSystem: 'pixel coordinates in whole image, origin top left; x/y inclusive, width/height dimensions',
  scaling: 'Scale all coordinates with the image; position HTML within safeControls; frame must not use object-fit: cover.',
  frames: Object.fromEntries(Object.entries(frames).map(([name, { width, height, aperture, safeControls }]) => [
    name, { image: `squabble-${name}.webp`, width, height, aperture, safeControls },
  ])),
}, null, 2) + '\n');