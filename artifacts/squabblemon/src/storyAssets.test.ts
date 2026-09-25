import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import sharp from "sharp";
import { storyContent, storySeasons } from "@workspace/squabblemon-engine/story";

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
