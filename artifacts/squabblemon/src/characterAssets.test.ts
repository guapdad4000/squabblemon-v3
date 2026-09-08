import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { cardCatalog, decks, getCardImage } from "./data";

const CHARACTER_DIRECTORY = fileURLToPath(
  new URL("../public/assets/characters/", import.meta.url),
);
const MIN_CHARACTER_WIDTH = 512;
const MIN_CHARACTER_HEIGHT = 512;

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
      `/assets/characters/${expectedFile}`,
      `${artworkId} must use the shared local artwork mapping`,
    );
    assert(rosterFiles.has(expectedFile), `missing character artwork: ${expectedFile}`);

    const bytes = await readFile(join(CHARACTER_DIRECTORY, expectedFile));
    const metadata = readWebpMetadata(bytes);
    assert(metadata.hasAlpha, `${expectedFile} must retain transparency`);
    assert(
      metadata.width >= MIN_CHARACTER_WIDTH &&
        metadata.height >= MIN_CHARACTER_HEIGHT,
      `${expectedFile} is unexpectedly small (${metadata.width}x${metadata.height})`,
    );

    const digest = createHash("sha256").update(bytes).digest("hex");
    const existingOwner = contentOwners.get(digest);
    assert.equal(
      existingOwner,
      undefined,
      `${expectedFile} duplicates roster artwork from ${existingOwner}`,
    );
    contentOwners.set(digest, expectedFile);
  }
});