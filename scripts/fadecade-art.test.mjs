import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

const sharp = createRequire(import.meta.url)('sharp');
const directory = new URL('../artifacts/squabblemon/public/assets/fadecade/', import.meta.url);
const image = async (name) => sharp(await readFile(new URL(name, directory)));

test('supplied Fadecade cutouts retain real alpha and opaque black artwork', async () => {
  for (const name of ['logo.webp', 'flagship.webp', 'daily.webp', 'weekly.webp', 'girl-fade.webp', 'funk-punk.webp', 'fighter-defeat.webp', 'flag-left.webp', 'flag-right.webp', 'stats-banner.webp', 'footer-banner.webp']) {
    const source = await image(name);
    const { data, info } = await source.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let transparent = 0;
    let ink = 0;
    let solid = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index + 3] === 0) transparent++;
      if (data[index + 3] > 240) {
        solid++;
        if (Math.max(data[index], data[index + 1], data[index + 2]) < 35) ink++;
      }
    }
    assert.ok(transparent > info.width * info.height * .02, `${name}: missing transparent cutout`);
    assert.ok(solid > info.width * info.height * .2, `${name}: artwork is not solid`);
    assert.ok(ink > 100, `${name}: background cleanup must preserve black outlines`);
  }
});

test('runner and fight atlases have equal complete cells, not raw multirow sheets', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
  for (const [name, count] of [['runner.webp', 16], ['fight.webp', 6], ['clear.webp', 6]]) {
    const atlas = manifest.atlases[name];
    assert.equal(atlas.frameCount, count, name);
    const source = await image(name);
    const metadata = await source.metadata();
    assert.equal(metadata.width, atlas.frameWidth * count, name);
    assert.equal(metadata.height, atlas.frameHeight, name);
    for (let index = 0; index < count; index++) {
      const frame = await source.clone().extract({
        left: index * atlas.frameWidth, top: 0, width: atlas.frameWidth, height: atlas.frameHeight,
      }).stats();
      assert.equal(frame.channels[3].min, 0, `${name}: frame ${index} has no transparency`);
      assert.equal(frame.channels[3].max, 255, `${name}: frame ${index} is empty or washed out`);
    }
  }
});

test('environment textures remain opaque instead of being incorrectly background-keyed', async () => {
  for (const name of ['room.webp', 'road.webp', 'crossing.webp', 'sidewalk.webp']) {
    assert.equal((await (await image(name)).stats()).isOpaque, true, name);
  }
});

test('bundled cabinet geometry matches the prepared artwork manifest', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
  const geometry = JSON.parse(await readFile(new URL('../artifacts/squabblemon/src/lib/fadecadeArt.json', import.meta.url), 'utf8'));
  for (const [name, cover] of Object.entries(manifest.covers)) {
    assert.deepEqual(geometry[name], { ...manifest.images[name], screen: cover.innerScreenBoundsPercent }, name);
  }
});

test('new flag and banner text areas stay inside the cropped artwork', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
  const geometry = JSON.parse(await readFile(new URL('../artifacts/squabblemon/src/lib/fadecadeChrome.json', import.meta.url), 'utf8'));
  for (const [name, { width, height, textArea }] of Object.entries(geometry)) {
    assert.deepEqual({ width, height }, manifest.images[name], name);
    assert.ok(textArea.x > 0 && textArea.y > 0 && textArea.width > 0 && textArea.height > 0, name);
    assert.ok(textArea.x + textArea.width < 100 && textArea.y + textArea.height < 100, name);
    const metadata = await (await image(name)).metadata();
    assert.equal(metadata.width, width, name);
    assert.equal(metadata.height, height, name);
  }
});