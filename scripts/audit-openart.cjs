const fs = require('fs');
const sharp = require('sharp');
(async () => {
  const dir = 'E:/Downloads/openart-download (3)';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
  const tiles = await Promise.all(files.map(async (f, i) => ({
    input: await sharp(await sharp(`${dir}/${f}`).resize(220, 220, { fit: 'contain', background: '#303038' }).png().toBuffer())
      .extend({ bottom: 26, background: '#303038' }).composite([{ input: Buffer.from(`<svg width="220" height="26"><text x="8" y="20" fill="white" font-size="18">${i}</text></svg>`), top: 220, left: 0 }]).png().toBuffer(),
    left: (i % 6) * 220, top: Math.floor(i / 6) * 246,
  })));
  await sharp({ create: { width: 1320, height: Math.ceil(files.length / 6) * 246, channels: 3, background: '#303038' } }).composite(tiles).png().toFile('screenshots/openart-layer-audit.png');
  fs.writeFileSync('screenshots/openart-layer-index.json', JSON.stringify(files, null, 2));
})();
