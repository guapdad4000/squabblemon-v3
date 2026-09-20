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
  assert.equal(
    bytes.subarray(12, 16).toString("ascii"),
    "VP8X",
    "must use extended WebP so transparency and dimensions are explicit",
  );

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
    assert(
      metadata.width >= MIN_CHARACTER_WIDTH &&
        metadata.height >= MIN_CHARACTER_HEIGHT,
      `${expectedFile} is unexpectedly small (${metadata.width}x${metadata.height})`,
    );

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
  assert.deepEqual(cardCatalog.filter(card => card.artworkLayout === 'portrait').map(card => card.artworkId), ['church-auntie', 'simmy', 'captain-jigga', 'kyle', 'stockz']);
});
