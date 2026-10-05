import { BLOCKBUSTERS } from '../../../lib/squabblemon-engine/src/blockbusterWave';
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { cardCatalog, decks, getCardImage } from "./data";
import characterRevisions from './characterRevisions.json';

const CHARACTER_DIRECTORY = fileURLToPath(
  new URL("../public/assets/characters/", import.meta.url),
);
const MIN_CHARACTER_WIDTH = 512;
const MIN_CHARACTER_HEIGHT = 512;
const TRANSPARENT_ALPHA_MAX = 16;
const VISIBLE_ALPHA_MIN = 128;
const MIN_TRANSPARENT_COVERAGE = 0.2;
const MIN_VISIBLE_COVERAGE = 0.1;
const SUMMON_ARTWORK_IDS = ['guyana', 'steward'] as const;
const SQUABBLEHOUSE_SUPPLIED_ARTWORK = [
  {
    engineId: 'squabblehouse-bus-boy',
    artworkId: 'squabblehouse-bus-boy',
    source: '13317d89-fd08-4259-a13b-abc9c748d296_1790802321353.png',
    width: 1086,
    height: 1448,
    hasAlpha: true,
  },
  {
    engineId: 'waffle-warlord',
    artworkId: 'waffle-warlord',
    source: 'ChatGPT_Image_Sep_30,_2026,_01_54_16_PM_(Edited)_1790802321353.png',
    width: 493,
    height: 654,
    hasAlpha: true,
  },
] as const;
const MINIMUM_ARTWORK_DIMENSIONS: Record<string, [number, number]> = {
  'waffle-warlord': [493, 654],
  'a-side-of-hands': [659, 373],
};

type WebpMetadata = {
  width: number;
  height: number;
  hasAlpha: boolean;
};

const readUint24LE = (bytes: Buffer, offset: number) =>
  bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);

function readWebpMetadata(bytes: Buffer): WebpMetadata {
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF", "must be a RIFF file");
  assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP", "must be a WebP file");
  const chunk = bytes.subarray(12, 16).toString("ascii");
  if (chunk === 'VP8 ') {
    return {
      hasAlpha: false,
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff,
    };
  }
  assert.equal(chunk, "VP8X", "must use a supported extended or opaque WebP format");

  return {
    hasAlpha: (bytes[20] & 0x10) !== 0,
    width: readUint24LE(bytes, 24) + 1,
    height: readUint24LE(bytes, 27) + 1,
  };
}

function assertUsefulCutout(filename: string, alpha: Uint8Array): void {
  const pixelCount = alpha.length;
  const transparentPixels = alpha.reduce(
    (count, value) => count + Number(value <= TRANSPARENT_ALPHA_MAX),
    0,
  );
  const visiblePixels = alpha.reduce(
    (count, value) => count + Number(value >= VISIBLE_ALPHA_MIN),
    0,
  );
  const transparentCoverage = transparentPixels / pixelCount;
  const visibleCoverage = visiblePixels / pixelCount;

  assert(
    visibleCoverage >= MIN_VISIBLE_COVERAGE,
    `${filename} is nearly empty or fully transparent (${(visibleCoverage * 100).toFixed(2)}% visible pixels)`,
  );
  assert(
    transparentCoverage >= MIN_TRANSPARENT_COVERAGE,
    `${filename} is effectively opaque (${(transparentCoverage * 100).toFixed(2)}% transparent pixels)`,
  );
}

async function readAlphaChannel(bytes: Buffer): Promise<Uint8Array> {
  const { data, info } = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = new Uint8Array(info.width * info.height);

  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    alpha[pixel] = data[pixel * info.channels + info.channels - 1];
  }

  return alpha;
}

test("character cutout validation rejects unusable alpha coverage with the filename", () => {
  assert.throws(
    () => assertUsefulCutout("empty.webp", new Uint8Array(100)),
    /empty\.webp is nearly empty or fully transparent/,
  );
  assert.throws(
    () => assertUsefulCutout("boxed.webp", new Uint8Array(100).fill(255)),
    /boxed\.webp is effectively opaque/,
  );

  const almostOpaqueAlpha = new Uint8Array(100).fill(255);
  almostOpaqueAlpha.fill(0, 0, 19);
  assert.throws(
    () => assertUsefulCutout("almost-boxed.webp", almostOpaqueAlpha),
    /almost-boxed\.webp is effectively opaque/,
  );

  const almostEmptyAlpha = new Uint8Array(100);
  almostEmptyAlpha.fill(255, 0, 9);
  assert.throws(
    () => assertUsefulCutout("almost-empty.webp", almostEmptyAlpha),
    /almost-empty\.webp is nearly empty or fully transparent/,
  );

  const usefulAlpha = new Uint8Array(100).fill(255);
  usefulAlpha.fill(0, 0, 50);
  assert.doesNotThrow(() => assertUsefulCutout("cutout.webp", usefulAlpha));
});

test("every catalog card and deck hero has one valid local character image", async () => {
  const artworkIds = cardCatalog.map((card) => card.artworkId);
  assert.equal(
    new Set(artworkIds).size,
    artworkIds.length,
    "catalog cards must not share artwork IDs",
  );

  const artworkIdSet = new Set(artworkIds);
  for (const deck of decks) {
    assert(
      artworkIdSet.has(deck.hero),
      `deck ${deck.id} hero ${deck.hero} must resolve through the card artwork mapping`,
    );
  }

  const rosterFiles = new Set(await readdir(CHARACTER_DIRECTORY));
  const contentOwners = new Map<string, string>();

  for (const artworkId of artworkIds) {
    const expectedFile = `${artworkId}.webp`;
    assert.equal(
      getCardImage(artworkId),
      `/assets/characters/${expectedFile}?v=${(characterRevisions as Record<string, string>)[artworkId]}`,
      `${artworkId} must use the shared local artwork mapping`,
    );
    assert(rosterFiles.has(expectedFile), `missing character artwork: ${expectedFile}`);

    const bytes = await readFile(join(CHARACTER_DIRECTORY, expectedFile));
    const metadata = readWebpMetadata(bytes);
    // Foodz retains the supplied portrait; Simmy's rose aura is a transparent cutout.
    const suppliedPortrait = cardCatalog.find(card => card.artworkId === artworkId)?.artworkLayout === 'portrait';
    if (!suppliedPortrait || artworkId === 'simmy') {
      assert(metadata.hasAlpha, `${expectedFile} must retain transparency`);
      assertUsefulCutout(expectedFile, await readAlphaChannel(bytes));
    }
    const [minWidth, minHeight] = MINIMUM_ARTWORK_DIMENSIONS[artworkId] ?? [
      MIN_CHARACTER_WIDTH,
      MIN_CHARACTER_HEIGHT,
    ];
    assert(metadata.width >= minWidth && metadata.height >= minHeight,
      `${expectedFile} is unexpectedly small (${metadata.width}x${metadata.height})`);

    const digest = createHash("sha256").update(bytes).digest("hex");
    assert.equal((characterRevisions as Record<string, string>)[artworkId], digest.slice(0, 16), `${expectedFile}: run scripts/sync-character-revisions.cjs after replacing artwork`);
    const existingOwner = contentOwners.get(digest);
    assert.equal(
      existingOwner,
      undefined,
      `${expectedFile} duplicates roster artwork from ${existingOwner}`,
    );
    contentOwners.set(digest, expectedFile);
  }
});

test('Unchanged Squabblehouse portraits preserve their supplied artwork and alpha', async () => {
  for (const asset of SQUABBLEHOUSE_SUPPLIED_ARTWORK) {
    const catalogCard = cardCatalog.find(card => card.engineId === asset.engineId);
    assert.ok(catalogCard, `${asset.engineId} must be registered in the catalog`);
    assert.equal(catalogCard.artworkId, asset.artworkId);

    const expectedFile = `${asset.artworkId}.webp`;
    const revision = (characterRevisions as Record<string, string>)[asset.artworkId];
    assert.ok(revision, `${expectedFile} must have a cache revision`);
    assert.equal(getCardImage(asset.engineId), `/assets/characters/${expectedFile}?v=${revision}`);

    const targetPath = join(CHARACTER_DIRECTORY, expectedFile);
    const sourcePath = fileURLToPath(new URL(`../../../attached_assets/${asset.source}`, import.meta.url));
    const source = await readFile(sourcePath);
    const imported = await readFile(targetPath);
    const metadata = readWebpMetadata(imported);
    assert.deepEqual([metadata.width, metadata.height], [asset.width, asset.height]);
    assert.equal(metadata.hasAlpha, asset.hasAlpha, `${expectedFile} should retain its supplied alpha channel`);

    if (asset.hasAlpha) {
      const sourceAlpha = await sharp(source).extractChannel('alpha').raw().toBuffer();
      const importedAlpha = await sharp(imported).extractChannel('alpha').raw().toBuffer();
      assert.deepEqual(importedAlpha, sourceAlpha, `${expectedFile} must preserve supplied transparency exactly`);
      assertUsefulCutout(expectedFile, await readAlphaChannel(imported));
    }

    const digest = createHash('sha256').update(imported).digest('hex').slice(0, 16);
    assert.equal(revision, digest, `${expectedFile} revision should match the optimized WebP`);
  }
});

test('Cashier and A Side of Hands have clean transparent backdrops and revised artwork URLs', async () => {
  for (const [engineId, artworkId] of [['squabblehouse-cashier', 'squabblehouse-cashier'], ['sideofhands', 'a-side-of-hands']]) {
    const file = `${artworkId}.webp`;
    const bytes = await readFile(join(CHARACTER_DIRECTORY, file));
    const metadata = readWebpMetadata(bytes);
    assert(metadata.hasAlpha, `${file} must have an alpha channel`);
    const alpha = await readAlphaChannel(bytes);
    assertUsefulCutout(file, alpha);
    for (const corner of [0, metadata.width - 1, alpha.length - metadata.width, alpha.length - 1]) {
      assert.equal(alpha[corner], 0, `${file} backdrop must be fully transparent at every corner`);
    }
    assert(alpha[Math.floor(metadata.height / 2) * metadata.width + Math.floor(metadata.width / 2)] >= 250,
      `${file} must retain an opaque foreground`);
    const revision = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
    assert.equal(getCardImage(engineId), `/assets/characters/${file}?v=${revision}`);
  }
});

test('summoned characters have cache-busted transparent artwork', async () => {
  for (const artworkId of SUMMON_ARTWORK_IDS) {
    const expectedFile = `${artworkId}.webp`;
    const revision = (characterRevisions as Record<string, string>)[artworkId];
    assert(revision, `${expectedFile} must have a cache revision`);
    assert.equal(getCardImage(artworkId), `/assets/characters/${expectedFile}?v=${revision}`);

    const bytes = await readFile(join(CHARACTER_DIRECTORY, expectedFile));
    const metadata = readWebpMetadata(bytes);
    assert(metadata.hasAlpha, `${expectedFile} must retain transparency`);
    assertUsefulCutout(expectedFile, await readAlphaChannel(bytes));
    assert(
      metadata.width >= MIN_CHARACTER_WIDTH && metadata.height >= MIN_CHARACTER_HEIGHT,
      `${expectedFile} is unexpectedly small (${metadata.width}x${metadata.height})`,
    );
    assert.equal(createHash('sha256').update(bytes).digest('hex').slice(0, 16), revision);
  }
});

test('Simmy has no opaque black matte, while Foodz retains the supplied portrait', async () => {
  const simmy = await sharp(join(CHARACTER_DIRECTORY, 'simmy.webp')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alphaAt = (x: number, y: number) => simmy.data[(y * simmy.info.width + x) * simmy.info.channels + 3];
  assert.equal(alphaAt(0, 0), 0);
  assert.equal(alphaAt(simmy.info.width - 1, 0), 0);
  assert.equal(alphaAt(0, simmy.info.height - 1), 0);
  assert.equal(alphaAt(simmy.info.width - 1, simmy.info.height - 1), 0);
  assert(alphaAt(Math.floor(simmy.info.width / 2), Math.floor(simmy.info.height / 2)) >= VISIBLE_ALPHA_MIN);
  const original = await sharp(join(CHARACTER_DIRECTORY, '../../../reference/street-wave/foodz-original.png')).ensureAlpha().raw().toBuffer();
  const imported = await sharp(join(CHARACTER_DIRECTORY, 'foodz.webp')).ensureAlpha().raw().toBuffer();
  // Lossless WebP omits invisible RGB values under fully transparent pixels.
  for (let i = 0; i < original.length; i += 4) {
    if (original[i + 3] === 0) { original.fill(0, i, i + 3); imported.fill(0, i, i + 3); }
  }
  assert(imported.equals(original), 'foodz: importing must preserve visible pixels and the full alpha channel');
  assert.deepEqual(cardCatalog.filter(card => card.artworkLayout === 'portrait').map(card => card.artworkId), [
    'church-auntie',
    'simmy',
    'captain-jigga',
    'hair-stylist',
    'stylist',
    'demario',
    'luigion',
    'black-cowboy',
    'inmate-crafty',
    'inmate-boyfriend',
    'inmate-informant',
    'inmate-contraband',
    'lebron-james',
    'sugarfoot',
    'yn-gokarter',
    'yn-atv-lord',
    'janitor',
    'homeless-wiseman',
    'juneteenth-chair-guy',
    'squabble-house-manager',
    'riptide-bruiser',
    'stillwater-medic',
    'monsoon-anchor',
    'rainmaker',
    'battery-back',
    'circuit-captain',
    'wiretap',
    'livewire',
    'sprout',
    'root-nurse',
    'canopy-keeper',
    'garden-wall',
    'gust',
    'crosswind',
    'slipstream',
    'cloudbreak',
    'ganger-blue',
    'ganger-red',
    'snitch',
    'cracked-head',
    'triple-og-blue',
    'triple-og-red',
    'initiation',
    'block-spinner',
    'look-out',
    ...BLOCKBUSTERS.map(([id]) => id),
    'squabblehouse-security',
    'squabblehouse-teknician',
    'griddle-master',
    'inmate-reformed',
    'squabblehouse-bus-boy',
    'squabblehouse-cashier',
    'waffle-warlord',
    'cane-corso-red',
    'blue-nose-pit',
    'kyle',
    'stockz',
  ]);
});
