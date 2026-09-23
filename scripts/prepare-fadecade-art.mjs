import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const sharp = createRequire(new URL('../artifacts/squabblemon/package.json', import.meta.url))('sharp');
const root = fileURLToPath(new URL('../', import.meta.url));
const sourceDir = path.join(root, 'attached_assets');
const outputDir = path.join(root, 'artifacts/squabblemon/public/assets/fadecade');

const sources = {
  room: 'ChatGPT_Image_Sep_23,_2026,_04_33_10_AM_1790163409738.png',
  covers: 'ChatGPT_Image_Sep_23,_2026,_03_44_51_AM_1790162282920.png',
  flagship: 'ChatGPT_Image_Sep_23,_2026,_03_45_00_AM_1790162282919.png',
  logo: 'ChatGPT_Image_Sep_23,_2026,_03_57_31_AM_(3)_1790162282919.png',
  roads: 'ChatGPT_Image_Sep_23,_2026,_03_57_31_AM_(4)_1790162282919.png',
  fight: 'ChatGPT_Image_Sep_23,_2026,_03_57_32_AM_(6)_1790162282919.png',
  clear: 'ChatGPT_Image_Sep_23,_2026,_03_57_32_AM_(7)_1790162282919.png',
  defeat: 'b24867ba-3e4e-414e-922f-2b2ece0cac66_1790162282918.png',
  runner: 'fadecade_topdown_run_sheet_clean_1790162145579.png',
  runnerDuplicate: 'fadecade_topdown_run_sheet_clean_1790162282919.png',
};

const manifest = {
  generatedBy: 'scripts/prepare-fadecade-art.mjs',
  sourceRunnerUploadsDeduplicated: true,
  images: {},
  atlases: {},
  covers: {},
  roadTiles: [],
};

const source = (name) => path.join(sourceDir, sources[name]);
const destination = (name) => path.join(outputDir, name);

async function assertDuplicateRunnerUploads() {
  const digest = async (file) => createHash('sha256').update(await readFile(file)).digest('hex');
  const [canonical, duplicate] = await Promise.all([
    digest(source('runner')),
    digest(source('runnerDuplicate')),
  ]);
  if (canonical !== duplicate) {
    throw new Error('The two runner uploads no longer match; refusing to choose one silently.');
  }
}

// The supplied transparent sheets use alpha 251–253 for visually solid pixels and
// contain a very faint generated fringe. Snap only those extremes; retain the
// useful antialiasing between them and never key pixels by color (black is artwork).
async function cleanAlpha(input, clearRects = [], keepLargestComponent = false) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * 4;
      const inClearRect = clearRects.some(
        (rect) => x >= rect.left && x < rect.left + rect.width
          && y >= rect.top && y < rect.top + rect.height,
      );
      if (inClearRect || data[offset + 3] <= 8) {
        data[offset + 3] = 0;
      } else if (data[offset + 3] >= 250) {
        data[offset + 3] = 255;
      }
    }
  }
  if (keepLargestComponent) {
    const pixelCount = info.width * info.height;
    const visited = new Uint8Array(pixelCount);
    const components = [];
    for (let start = 0; start < pixelCount; start += 1) {
      if (visited[start] || data[start * 4 + 3] <= 8) continue;
      const pixels = [];
      const queue = [start];
      visited[start] = 1;
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const pixel = queue[cursor];
        pixels.push(pixel);
        const x = pixel % info.width;
        const y = Math.floor(pixel / info.width);
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            if (offsetX === 0 && offsetY === 0) continue;
            const nextX = x + offsetX;
            const nextY = y + offsetY;
            if (nextX < 0 || nextX >= info.width || nextY < 0 || nextY >= info.height) continue;
            const next = nextY * info.width + nextX;
            if (!visited[next] && data[next * 4 + 3] > 8) {
              visited[next] = 1;
              queue.push(next);
            }
          }
        }
      }
      components.push(pixels);
    }
    components.sort((a, b) => b.length - a.length);
    const keep = new Uint8Array(pixelCount);
    for (const pixel of components[0] ?? []) keep[pixel] = 1;
    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      if (!keep[pixel]) data[pixel * 4 + 3] = 0;
    }
  }
  return { data, info };
}

function rawImage(cleaned) {
  return sharp(cleaned.data, {
    raw: {
      width: cleaned.info.width,
      height: cleaned.info.height,
      channels: 4,
    },
  });
}

function alphaBounds(cleaned, threshold = 8) {
  const { data, info } = cleaned;
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] > threshold) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }
  if (right < left) throw new Error('No visible pixels found while trimming artwork.');
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function encode(image, filename, options = {}) {
  const result = await image
    .webp({ quality: options.quality ?? 93, alphaQuality: 100, effort: 6 })
    .toFile(destination(filename));
  manifest.images[filename] = { width: result.width, height: result.height };
  return result;
}

async function tightTransparent(name, filename, clearRects = []) {
  const cleaned = await cleanAlpha(source(name), clearRects, true);
  const bounds = alphaBounds(cleaned);
  await encode(rawImage(cleaned).extract(bounds), filename);
  return bounds;
}

function splitEdges(length, count) {
  return Array.from({ length: count + 1 }, (_, index) => Math.round((length * index) / count));
}

async function normalizedAtlas(name, columns, rows, filename, clearRects = []) {
  const cleaned = await cleanAlpha(source(name), clearRects);
  const xEdges = splitEdges(cleaned.info.width, columns);
  const yEdges = splitEdges(cleaned.info.height, rows);
  const sourceCellWidth = Math.max(...xEdges.slice(1).map((edge, index) => edge - xEdges[index]));
  const sourceCellHeight = Math.max(...yEdges.slice(1).map((edge, index) => edge - yEdges[index]));
  const cells = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const width = xEdges[column + 1] - xEdges[column];
      const height = yEdges[row + 1] - yEdges[row];
      const rgba = await rawImage(cleaned)
        .extract({ left: xEdges[column], top: yEdges[row], width, height })
        .extend({
          right: sourceCellWidth - width,
          bottom: sourceCellHeight - height,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .raw()
        .toBuffer();
      cells.push({ data: rgba, info: { width: sourceCellWidth, height: sourceCellHeight } });
    }
  }

  // Crop every cell by the union of local occupancy. This keeps each source-cell
  // pivot fixed while removing only margins shared by the entire animation.
  const union = {
    left: sourceCellWidth,
    top: sourceCellHeight,
    right: -1,
    bottom: -1,
  };
  for (const cell of cells) {
    const bounds = alphaBounds(cell);
    union.left = Math.min(union.left, bounds.left);
    union.top = Math.min(union.top, bounds.top);
    union.right = Math.max(union.right, bounds.left + bounds.width - 1);
    union.bottom = Math.max(union.bottom, bounds.top + bounds.height - 1);
  }
  const frameWidth = union.right - union.left + 1;
  const frameHeight = union.bottom - union.top + 1;
  const atlas = sharp({
    create: {
      width: frameWidth * cells.length,
      height: frameHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });
  const frameBuffers = await Promise.all(cells.map((cell) => (
    sharp(cell.data, { raw: { width: cell.info.width, height: cell.info.height, channels: 4 } })
      .extract({ left: union.left, top: union.top, width: frameWidth, height: frameHeight })
      .png()
      .toBuffer()
  )));
  const result = await atlas
    .composite(frameBuffers.map((input, index) => ({ input, left: index * frameWidth, top: 0 })))
    .webp({ quality: 93, alphaQuality: 100, effort: 6 })
    .toFile(destination(filename));
  manifest.images[filename] = { width: result.width, height: result.height };
  manifest.atlases[filename] = {
    width: result.width,
    height: result.height,
    frameCount: cells.length,
    frameWidth,
    frameHeight,
  };
  return { frameBuffers, frameWidth, frameHeight };
}

function normalizedScreenBounds(screen, crop) {
  const round = (number) => Math.round(number * 10000) / 100;
  return {
    x: round((screen.left - crop.left) / crop.width),
    y: round((screen.top - crop.top) / crop.height),
    width: round(screen.width / crop.width),
    height: round(screen.height / crop.height),
  };
}

async function prepareCovers() {
  const covers = [
    ['daily.webp', { left: 0, top: 0, width: 768, height: 512 }, { left: 171, top: 143, width: 459, height: 258 }],
    ['weekly.webp', { left: 768, top: 0, width: 768, height: 512 }, { left: 923, top: 143, width: 457, height: 256 }],
    ['girl-fade.webp', { left: 0, top: 512, width: 768, height: 512 }, { left: 171, top: 648, width: 459, height: 255 }],
    ['funk-punk.webp', { left: 768, top: 512, width: 768, height: 512 }, { left: 922, top: 652, width: 456, height: 252 }],
  ];
  const cleaned = await cleanAlpha(source('covers'), covers.map(([, , screen]) => screen));
  for (const [filename, quadrant, screen] of covers) {
    const quadrantBuffer = await rawImage(cleaned).extract(quadrant).raw().toBuffer();
    const local = { data: quadrantBuffer, info: { width: quadrant.width, height: quadrant.height } };
    const localCrop = alphaBounds(local);
    const globalCrop = {
      left: quadrant.left + localCrop.left,
      top: quadrant.top + localCrop.top,
      width: localCrop.width,
      height: localCrop.height,
    };
    await encode(
      sharp(quadrantBuffer, { raw: { width: quadrant.width, height: quadrant.height, channels: 4 } }).extract(localCrop),
      filename,
    );
    manifest.covers[filename] = {
      innerScreenBoundsPercent: normalizedScreenBounds(screen, globalCrop),
      screenApertureTransparent: true,
    };
  }
}

async function prepareRoadTiles() {
  // Measured artwork rectangles exclude the 10–12 px gutters/separator rules.
  const x = [12, 219, 427, 634, 842, 1049, 1257, 1464];
  const y = [12, 215, 417, 620];
  const widths = [196, 197, 196, 197, 196, 197, 196, 196];
  const heights = [195, 192, 194, 309];
  let index = 0;
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      index += 1;
      const semanticName = index === 1 ? 'road.webp'
        : index === 17 ? 'sidewalk.webp'
          : index === 25 ? 'crossing.webp'
            : `road-tile-${String(index).padStart(2, '0')}.webp`;
      const crop = { left: x[column], top: y[row], width: widths[column], height: heights[row] };
      await encode(sharp(source('roads')).extract(crop), semanticName, { quality: 91 });
      manifest.roadTiles.push({
        file: semanticName,
        row: row + 1,
        column: column + 1,
        sourceCrop: crop,
      });
    }
  }
}

async function makeContactSheet() {
  const files = [
    'flagship.webp', 'daily.webp', 'weekly.webp', 'girl-fade.webp', 'funk-punk.webp',
    'logo.webp', 'fighter-defeat.webp', 'fight.webp', 'clear.webp', 'runner.webp',
    'room.webp', 'road.webp', 'crossing.webp', 'sidewalk.webp',
  ];
  const tileWidth = 360;
  const tileHeight = 260;
  const checker = Buffer.alloc(tileWidth * tileHeight * 3);
  for (let y = 0; y < tileHeight; y += 1) {
    for (let x = 0; x < tileWidth; x += 1) {
      const value = ((Math.floor(x / 20) + Math.floor(y / 20)) % 2) ? 205 : 240;
      const offset = (y * tileWidth + x) * 3;
      checker[offset] = checker[offset + 1] = checker[offset + 2] = value;
    }
  }
  const tiles = await Promise.all(files.map(async (file) => {
    const artwork = await sharp(destination(file))
      .resize({ width: tileWidth - 20, height: tileHeight - 20, fit: 'inside' })
      .png()
      .toBuffer();
    const metadata = await sharp(artwork).metadata();
    return sharp(checker, { raw: { width: tileWidth, height: tileHeight, channels: 3 } })
      .composite([{
        input: artwork,
        left: Math.floor((tileWidth - metadata.width) / 2),
        top: Math.floor((tileHeight - metadata.height) / 2),
      }])
      .png()
      .toBuffer();
  }));
  await sharp({
    create: {
      width: tileWidth * 3,
      height: tileHeight * Math.ceil(tiles.length / 3),
      channels: 3,
      background: '#ffffff',
    },
  }).composite(tiles.map((input, index) => ({
    input,
    left: (index % 3) * tileWidth,
    top: Math.floor(index / 3) * tileHeight,
  }))).png().toFile('/tmp/fadecade-contact.png');
}

await assertDuplicateRunnerUploads();
await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

await encode(sharp(source('room')), 'room.webp', { quality: 90 });
await prepareCovers();
const flagshipScreen = { left: 140, top: 529, width: 818, height: 496 };
const flagshipCrop = await tightTransparent('flagship', 'flagship.webp', [flagshipScreen]);
manifest.covers['flagship.webp'] = {
  innerScreenBoundsPercent: normalizedScreenBounds(
    flagshipScreen,
    flagshipCrop,
  ),
  screenApertureTransparent: true,
};
await tightTransparent('logo', 'logo.webp');
await tightTransparent('defeat', 'fighter-defeat.webp');

// The final fight cell contains a detached red/yellow generation remnant in the
// lower-right corner. Clear only that exterior corner; all black linework remains.
await normalizedAtlas('fight', 3, 2, 'fight.webp', [
  { left: 1570, top: 858, width: 102, height: 83 },
]);
await normalizedAtlas('clear', 6, 1, 'clear.webp');
const runner = await normalizedAtlas('runner', 8, 2, 'runner.webp');
for (let index = 0; index < runner.frameBuffers.length; index += 1) {
  const filename = `runner-${String(index + 1).padStart(2, '0')}.webp`;
  await encode(sharp(runner.frameBuffers[index]), filename);
}
await encode(sharp(runner.frameBuffers[0]), 'idle.webp');
await prepareRoadTiles();

await writeFile(destination('manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const cabinetGeometry = Object.fromEntries(Object.entries(manifest.covers).map(([file, cover]) => [
  file, { ...manifest.images[file], screen: cover.innerScreenBoundsPercent },
]));
await writeFile(path.join(root, 'artifacts/squabblemon/src/lib/fadecadeArt.json'), `${JSON.stringify(cabinetGeometry, null, 2)}\n`);
await makeContactSheet();
await import('./prepare-fadecade-chrome.mjs');

console.log(`Prepared Fadecade artwork in ${path.relative(root, outputDir)}`);
console.log('Inspection sheet: /tmp/fadecade-contact.png');