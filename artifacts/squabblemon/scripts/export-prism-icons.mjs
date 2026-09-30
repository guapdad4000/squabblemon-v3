import sharp from 'sharp';
import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';

const root = 'public/brand/prismatic/';
const source = 'public/brand/source-sm-gold/';
const marks = `${root}marks/`;
const icons = 'public/icons/';
const background = '#080a11';
await mkdir(marks, { recursive: true });
await mkdir(icons, { recursive: true });

// Rebuild all supplied artwork from checked-in source assets, never attached_assets.
const suppliedMarks = [
  ['impact-sm-gold.webp', 'impact-crest-sm-gold.png'],
  ['favicon-sm-gold.webp', 'fist-badge-sm-gold.png'],
  ['app-sm-gold.webp', 'app-icon-sm-gold.png'],
];
for (const [output, input] of suppliedMarks) {
  await sharp(`${source}${input}`)
    .webp({ quality: 93, alphaQuality: 100, effort: 6 })
    .toFile(`${marks}${output}`);
}
await sharp(`${source}illustrated-not-found-sm-gold.png`)
  .resize({ width: 1200, withoutEnlargement: true })
  .webp({ quality: 93, alphaQuality: 100, effort: 6 })
  .toFile('public/brand/not-found-sm-gold.webp');

const iconAssets = [
  {
    name: 'favicon-sm-gold-16.png',
    compatibility: ['favicon-16.png', 'favicon-gold-16.png'],
    source: 'fist-badge-sm-gold.png',
    size: 16,
    fit: 'contain',
  },
  {
    name: 'favicon-sm-gold-32.png',
    compatibility: ['favicon-32.png', 'favicon-gold-32.png'],
    source: 'fist-badge-sm-gold.png',
    size: 32,
    fit: 'contain',
  },
  {
    name: 'apple-touch-icon-sm-gold.png',
    compatibility: ['apple-touch-icon.png', 'apple-touch-icon-gold.png'],
    source: 'app-icon-sm-gold.png',
    size: 180,
    fit: 'cover',
  },
  {
    name: 'icon-sm-gold-192.png',
    compatibility: ['icon-192.png', 'icon-gold-192.png'],
    source: 'app-icon-sm-gold.png',
    size: 192,
    fit: 'cover',
  },
  {
    name: 'icon-sm-gold-512.png',
    compatibility: ['icon-512.png', 'icon-gold-512.png'],
    source: 'app-icon-sm-gold.png',
    size: 512,
    fit: 'cover',
  },
  {
    name: 'icon-sm-gold-maskable-512.png',
    compatibility: ['icon-maskable-512.png', 'icon-gold-maskable-512.png'],
    source: 'app-icon-sm-gold.png',
    size: 512,
    fit: 'contain',
    padding: 96,
  },
];
for (const asset of iconAssets) {
  const padding = asset.padding ?? 0;
  const size = asset.size - padding * 2;
  const outputPath = `${icons}${asset.name}`;
  await sharp(`${source}${asset.source}`)
    .resize(size, size, { fit: asset.fit, background })
    .flatten({ background })
    .extend({ top: padding, bottom: padding, left: padding, right: padding, background })
    .png()
    .toFile(outputPath);
  for (const alias of asset.compatibility) await copyFile(outputPath, `${icons}${alias}`);
}

// Multi-size ICO with real 16px and 32px image entries.
const faviconImages = await Promise.all([
  readFile(`${icons}favicon-sm-gold-16.png`),
  readFile(`${icons}favicon-sm-gold-32.png`),
]);
const icoHeaderSize = 6 + faviconImages.length * 16;
let icoOffset = icoHeaderSize;
const icoEntries = faviconImages.map((image, index) => {
  const size = index === 0 ? 16 : 32;
  const entry = Buffer.alloc(16);
  entry[0] = size;
  entry[1] = size;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(image.length, 8);
  entry.writeUInt32LE(icoOffset, 12);
  icoOffset += image.length;
  return entry;
});
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(faviconImages.length, 4);
await writeFile('public/favicon.ico', Buffer.concat([icoHeader, ...icoEntries, ...faviconImages]));

const mark = `${marks}impact-sm-gold.webp`;
await sharp(`${root}logos/squabblemon-lockup-standard-gold.webp`)
  .resize(1100, 550, { fit: 'contain', background: '#070707' })
  .flatten({ background: '#070707' })
  .extend({ top: 40, bottom: 40, left: 50, right: 50, background: '#070707' })
  .jpeg({ quality: 92 })
  .toFile('public/brand/squabblemon-standard-gold-share.jpg');
await copyFile('public/brand/squabblemon-standard-gold-share.jpg', 'public/brand/squabblemon-share.jpg');
await copyFile(mark, 'public/brand/squabblemon-crest.webp');

// A self-contained legacy logo URL also works when embedded as an <img>.
const wordmark = await readFile(`${root}logos/squabblemon-wordmark-standard-gold.webp`);
const { width, height } = await sharp(wordmark).metadata();
await writeFile('public/logo.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title"><title id="title">Squabblemon — standard gold</title><image width="${width}" height="${height}" href="data:image/webp;base64,${wordmark.toString('base64')}"/></svg>\n`);
