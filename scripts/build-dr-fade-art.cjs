
const fs = require('fs');
const sharp = require('../artifacts/squabblemon/node_modules/sharp');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'artifacts/squabblemon/reference/dr-fade');
const target = path.join(root, 'artifacts/squabblemon/public/assets/cards/dr-fade');
const layers = [
  { name: 'chain', source: 'metal-chain.png', x: 204, y: 0, width: 293, height: 184 },
  { name: 'bag', source: 'punching-bag.png', x: 79, y: 15, width: 508, height: 1204 },
  { name: 'fighter', source: 'man.png', x: 308, y: 296, width: 700, height: 1466 },
];
// These cropped, transparent layers were supplied by the artist. Registration
// matches their visible pixels to original.png; no generated replacement artwork.
(async () => {
  fs.mkdirSync(target, { recursive: true });
  const positioned = [];
  for (const layer of layers) {
    const buffer = await sharp(path.join(source, layer.source)).webp({ quality: 90, alphaQuality: 100 }).toBuffer();
    const revision = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 12);
    fs.writeFileSync(path.join(target, layer.name + '.webp'), buffer);
    positioned.push({ ...layer, asset: 'assets/cards/dr-fade/' + layer.name + '.webp?v=' + revision });
  }
  const portrait = await sharp({ create: { width: 1008, height: 1792, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers.map(layer => ({ input: path.join(source, layer.source), left: layer.x, top: layer.y })))
    .webp({ quality: 90, alphaQuality: 100 }).toBuffer();
  fs.writeFileSync(path.join(root, 'artifacts/squabblemon/public/assets/characters/dr-fade.webp'), portrait);
  fs.writeFileSync(path.join(root, 'artifacts/squabblemon/src/drFadeLayers.json'), JSON.stringify({ width: 1008, height: 1792, layers: positioned }, null, 2) + '\n');
  console.log('Compiled Dr. Fade: ' + portrait.length + ' bytes, three registered layers.');
})();
