import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const sharp = createRequire(new URL('../artifacts/squabblemon/package.json', import.meta.url))('sharp');
const root = fileURLToPath(new URL('../', import.meta.url));
const assets = [
  ['ChatGPT_Image_Sep_22,_2026,_10_40_18_PM_1790142280716.png', 'bounty-hunter/hero.webp', 1280, 92],
  ['ChatGPT_Image_Sep_22,_2026,_10_40_23_PM_1790142280716.png', 'bounty-hunter/wall.webp', 1600, 85],
  ['ChatGPT_Image_Sep_22,_2026,_10_46_35_PM_(2)_1790142445913.png', 'bounty-hunter/yard.webp', 1600, 87],
  ['ChatGPT_Image_Sep_22,_2026,_10_43_29_PM_1790142457875.png', 'bounty-hunter/pistol-idle.webp', 1200, 92],
  ['ChatGPT_Image_Sep_22,_2026,_10_44_25_PM_1790142280715.png', 'bounty-hunter/pistol-fired.webp', 1200, 92],
  ['ChatGPT_Image_Sep_22,_2026,_10_40_30_PM_1790142280716.png', 'bounty-hunter/impact.webp', 640, 92],
  ['ChatGPT_Image_Sep_22,_2026,_10_19_12_PM_1790142284578.png', 'deck-workshop/gang-desktop.webp', 1600, 87],
  ['3b5cbc09-7264-43b8-afbd-e8e8499ce910_1790142284577.png', 'deck-workshop/gang-mobile.webp', 900, 87],
];

for (const [source, destination, width, quality] of assets) {
  const output = path.join(root, 'artifacts/squabblemon/public/assets', destination);
  await mkdir(path.dirname(output), { recursive: true });
  let image = sharp(path.join(root, 'attached_assets', source));
  const isPistol = destination.startsWith('bounty-hunter/pistol-');
  if (isPistol) {
    const metadata = await image.metadata();
    // Use the same crop for both poses so the weapon doesn't jump when fired.
    // Only remove the transparent side margins; retain all muzzle-flash headroom.
    image = image.extract({
      left: Math.round(metadata.width * 0.2),
      top: 0,
      width: Math.round(metadata.width * 0.6),
      height: metadata.height,
    });
  }
  const result = await image
    .resize({ width: isPistol ? Math.round(width * 0.6) : width, withoutEnlargement: true })
    .webp({ quality, alphaQuality: 100, effort: 5 })
    .toFile(output);
  console.log(`${destination}: ${result.width}×${result.height}, ${(result.size / 1024).toFixed(0)} KiB`);
}