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