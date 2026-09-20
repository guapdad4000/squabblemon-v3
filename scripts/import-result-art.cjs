const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '../artifacts/squabblemon/public/assets');
const entries = {
  'rewards/style-hanger': 'ChatGPT Image Sep 19, 2026, 04_09_44 PM.png',
  'rewards/clout-token': 'ChatGPT Image Sep 19, 2026, 04_08_56 PM (1).png',
  'rewards/clout-stack': 'ChatGPT Image Sep 19, 2026, 04_08_56 PM (2).png',
  'rewards/clout-bag': 'ChatGPT Image Sep 19, 2026, 04_08_56 PM (3).png',
  'rewards/medallion': 'ChatGPT Image Sep 19, 2026, 04_08_56 PM (4).png',
  'rewards/medallions': 'ChatGPT Image Sep 19, 2026, 04_08_56 PM (5).png',
  'rewards/squabble-chain': 'ChatGPT Image Sep 19, 2026, 04_08_56 PM (6).png',
  'rewards/clout-ticket': 'ChatGPT Image Sep 19, 2026, 04_15_35 PM (1).png',
  'rewards/fight-ticket': 'ChatGPT Image Sep 19, 2026, 04_17_19 PM.png',
  'results/win-wide': 'ChatGPT Image Sep 19, 2026, 03_55_31 PM (1).png',
  'results/win-wide-centered': 'ChatGPT Image Sep 19, 2026, 03_55_31 PM (2).png',
  'results/win-portrait': 'ChatGPT Image Sep 19, 2026, 02_54_33 PM.png',
  'results/loss-wide': 'ChatGPT Image Sep 19, 2026, 03_55_37 PM (1).png',
  'results/loss-wide-harbor': 'ChatGPT Image Sep 19, 2026, 03_55_37 PM (2).png',
  'results/loss-portrait': '60bb052c-f3a5-4455-ab79-a9880699ad40.png',
  'results/win-scene-wide': 'c1b482be-a50d-473b-85f7-3c6bb07ae9be.png',
  'results/win-scene-portrait': '86f4b823-fbee-493d-b047-259818fb261e.png',
  'results/loss-scene-wide': '17549757-851d-4cac-bff5-1145f33e8883.png',
  'results/loss-scene-portrait': 'ChatGPT Image Sep 19, 2026, 02_52_08 PM.png',
};
(async () => {
  for (const [name, file] of Object.entries(entries)) {
    const source = path.join(process.argv[2] || 'E:/Downloads', file);
    const target = path.join(root, `${name}.webp`);
    const metadata = await sharp(source).metadata();
    await fs.mkdir(path.dirname(target), { recursive: true });
    await sharp(source).resize({ width: name.startsWith('rewards/') ? 512 : 1672, withoutEnlargement: true }).webp({ quality: 88, alphaQuality: 100 }).toFile(target);
    console.log(`${name}: ${metadata.width}x${metadata.height}, alpha=${metadata.hasAlpha}`);
  }
})();
