import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import sharp from "sharp";
import { storyContent, storySeasons } from "@workspace/squabblemon-engine/story";
import portraitRevisions from './lib/storyPortraitRevisions.json';

const publicRoot = new URL("../public/", import.meta.url);
const theaterArt = [
  "theater.webp", "curtain-left.webp", "curtain-right.webp", "season-one.webp",
  "season-two.webp", "sherlock.webp", "rooftop.webp", "evidence.webp",
];

test("theater artwork is real, optimized and within the complete scene budget", async () => {
  let bytes = 0;
  for (const name of theaterArt) {
    const path = new URL(`assets/story/theater/${name}`, publicRoot);
    const buffer = await readFile(path);
    const metadata = await sharp(buffer).metadata();
    assert.equal(metadata.format, "webp", name);
    assert.ok((metadata.width ?? 0) >= 400 && (metadata.height ?? 0) >= 400, `${name} is too small`);
    assert.ok(buffer.length < 700_000, `${name} exceeds its 700 KB budget`);
    if (name.startsWith("curtain-")) assert.equal(metadata.hasAlpha, true, `${name} must be a compositable curtain`);
    bytes += buffer.length;
  }
  assert.ok(bytes < 3_500_000, `The entire reusable theater art set is ${bytes} bytes`);
});

test("cinema props preserve transparency and proportion within a one-megabyte art budget", async () => {
  const manifest = JSON.parse(await readFile(new URL("assets/story/theater/cinema-decor-manifest.json", publicRoot), "utf8"));
  let bytes = 0;
  for (const asset of manifest.assets) {
    const buffer = await readFile(new URL(`assets/story/theater/${asset.output}`, publicRoot));
    const metadata = await sharp(buffer).metadata();
    const stats = await sharp(buffer).stats();
    assert.equal(metadata.hasAlpha, true, `${asset.output} must remain transparent`);
    assert.equal(stats.isOpaque, false, `${asset.output} cannot have a flattened matte`);
    assert.equal(metadata.width, asset.width);
    assert.equal(metadata.height, asset.height);
    assert.ok(buffer.length < 250_000, `${asset.output} exceeds its individual budget`);
    bytes += buffer.length;
  }
  const curtain = manifest.assets.find((asset: { output: string }) => asset.output === "cinema-curtain.webp");
  assert.ok(curtain.height / curtain.width > 3, "The supplied curtain must not be stretched or widened");
  const hall = await readFile(new URL("assets/story/theater/cinema-hall.webp", publicRoot));
  bytes += hall.length;
  assert.ok(bytes < 1_000_000, `Cinema art is ${bytes} bytes`);
});

test("every new chapter's rendered background, portrait, puzzle and poster exists", async () => {
  const assets = new Set(storySeasons.map(season => season.posterAssetId));
  for (const chapter of storyContent.chapters.filter(chapter => chapter.order > 8)) {
    assets.add(chapter.mapAssetId);
    for (const node of chapter.nodes) {
      assets.add(node.cinematic.environmentAssetId);
      if (node.puzzle) assets.add(node.puzzle.imageAssetId);
      const lines = node.kind === "battle" ? [...node.preDialogue, ...node.postDialogue] : node.scenes;
      for (const line of lines) assets.add(line.portraitAssetId);
      if (node.kind === "battle") assets.add(node.encounter.enemy.portraitAssetId);
    }
  }
  for (const asset of assets) {
    assert.ok(!asset.startsWith("/") && !asset.includes(".."), `Unsafe asset ID: ${asset}`);
    assert.ok((await stat(fileURLToPath(new URL(asset, publicRoot)))).isFile(), `Missing story art: ${asset}`);
  }
});
test('authored environments cover every new story scene with all 38 supplied locations', async () => {
  const environments = new Set<string>();
  for (const chapter of storyContent.chapters.filter(chapter => chapter.order >= 9)) {
    assert.match(chapter.mapAssetId, /^assets\/story\/environments\/backgrounds\//);
    for (const node of chapter.nodes) {
      const asset = node.cinematic.environmentAssetId;
      assert.match(asset, /^assets\/story\/environments\/backgrounds\//, node.id);
      if (node.kind === 'battle') assert.equal(node.battlefieldAssetId, asset);
      environments.add(asset);
    }
  }
  assert.equal(environments.size, 38);
  for (const asset of environments) {
    const buffer = await readFile(new URL(asset, publicRoot));
    const metadata = await sharp(buffer).metadata();
    assert.equal(metadata.format, 'webp');
    assert.ok(Math.abs(metadata.width! / metadata.height! - 16 / 9) < .01, asset);
    assert.ok(buffer.length < 600_000, `${asset} exceeds 600 KB`);
  }
});

test('all sixteen environment props retain transparent alpha', async () => {
  const manifest = JSON.parse(await readFile(new URL('../reference/story-environments.json', import.meta.url), 'utf8'));
  const props = manifest.records.filter((r: { asset: string }) => r.asset.includes('/props/'));
  assert.equal(props.length, 16);
  for (const prop of props) {
    const buffer = await readFile(new URL(prop.asset, publicRoot));
    const metadata = await sharp(buffer).metadata();
    assert.equal(metadata.hasAlpha, true, prop.asset);
    assert.equal((await sharp(buffer).stats()).isOpaque, false, prop.asset);
  }
});

test('every Season One speaker has a decoded portrait, including rewrite-only cast', async () => {
  const ids = storySeasons.find(season => season.id === 'season-1')!.chapterIds;
  const portraits = new Set(['assets/characters/player-rear.webp']);
  for (const chapter of storyContent.chapters.filter(chapter => ids.includes(chapter.id))) {
    for (const node of chapter.nodes) {
      for (const line of node.kind === 'battle' ? [...node.preDialogue, ...node.postDialogue] : node.scenes)
        portraits.add(line.portraitAssetId);
    }
  }
  for (const asset of portraits) {
    const buffer = await readFile(new URL(asset, publicRoot));
    const metadata = await sharp(buffer).metadata();
    assert.equal(metadata.format, 'webp', asset);
    assert.ok((metadata.width ?? 0) > 100 && (metadata.height ?? 0) > 100, asset);
    // Force full decoding rather than accepting only a valid image header.
    assert.ok((await sharp(buffer).raw().toBuffer()).length > 0, asset);
  }
});

test('Player artwork preserves supplied alpha and dark pixels; Rae remains distinct and transparent', async () => {
  const sources = {
    player: '../reference/story-player/side.png',
    'player-rear': '../reference/story-player/rear.png',
  };
  for (const [id, source] of Object.entries(sources)) {
    const buffer = await readFile(new URL(`assets/characters/${id}.webp`, publicRoot));
    const metadata = await sharp(buffer).metadata();
    assert.equal(metadata.hasAlpha, true);
    assert.equal(metadata.height, 1200);
    assert.ok(Math.abs(metadata.width! / metadata.height! - 941 / 1672) < .001);
    assert.ok(buffer.length < 250_000, `${id} must remain optimized`);
    const decoded = await sharp(buffer).ensureAlpha().raw().toBuffer();
    const original = await sharp(await readFile(new URL(source, import.meta.url)))
      .resize({ height: 1200, withoutEnlargement: true }).ensureAlpha().raw().toBuffer();
    let transparent = 0, darkOpaque = 0;
    for (let i = 0; i < decoded.length; i += 4) {
      assert.equal(decoded[i + 3], original[i + 3], `${id}: original alpha must survive`);
      if (decoded[i + 3] === 0) transparent++;
      else {
        assert.deepEqual(decoded.subarray(i, i + 3), original.subarray(i, i + 3),
          `${id}: no replacement artwork or removed black body pixels`);
        if (decoded[i + 3] > 240 && decoded[i] + decoded[i + 1] + decoded[i + 2] < 24) darkOpaque++;
      }
    }
    assert.ok(transparent > 100_000 && darkOpaque > 100_000, id);
    assert.equal(createHash('sha256').update(buffer).digest('hex').slice(0, 12),
      portraitRevisions[id as keyof typeof portraitRevisions]);
  }
  const rae = await readFile(new URL('assets/characters/rae.webp', publicRoot));
  assert.equal((await sharp(rae).metadata()).hasAlpha, true);
  assert.equal((await sharp(rae).stats()).isOpaque, false);
  assert.ok(rae.length < 250_000);
  assert.equal(createHash('sha256').update(rae).digest('hex').slice(0, 12), portraitRevisions.rae);
  assert.notEqual(portraitRevisions.rae, portraitRevisions.player);
});
