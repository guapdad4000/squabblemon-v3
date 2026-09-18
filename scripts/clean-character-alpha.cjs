// Explicitly selected background regions; never apply a global white color key.
// Run without --apply to review previews, then --apply to replace the game sprites.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const assert = require('assert/strict');

const root = 'screenshots/alpha-audit';
function chunks(bytes) {
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  const result = [];
  for (let offset = 12; offset < bytes.length;) {
    const size = bytes.readUInt32LE(offset + 4), end = offset + 8 + size + (size % 2);
    result.push({ type: bytes.toString('ascii', offset, offset + 4), bytes: bytes.subarray(offset, end) });
    offset = end;
  }
  return result;
}
function replaceAlpha(original, encoded) {
  const originalChunks = chunks(original);
  assert(originalChunks.some(chunk => chunk.type === 'VP8 '), 'Expected existing compressed RGB');
  assert(originalChunks.some(chunk => chunk.type === 'ALPH'), 'Expected existing alpha');
  const alpha = chunks(encoded).find(chunk => chunk.type === 'ALPH');
  assert(alpha, 'The mask encoder must produce an ALPH chunk');
  const body = Buffer.concat(originalChunks.map(chunk => chunk.type === 'ALPH' ? alpha.bytes : chunk.bytes));
  const header = Buffer.from(original.subarray(0, 12));
  header.writeUInt32LE(body.length + 4, 4);
  return Buffer.concat([header, body]);
}
const selected = {
  'all-jokes-roaster': [0, 1, 2, 3, 4, 5],
  'baby-momma': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  'closet-nerd': [0, 1, 2, 3, 4],
  'gamer-unemployed': [0, 1, 2, 3, 4],
  'gamer': [0, 1],
  'hooper': [0],
  'live-streamer': [0, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
  'plug': [0, 1, 2, 3],
  'snow-bunny': [0, 1, 2, 3, 4, 5, 7, 10, 11, 18],
};
const extraSeeds = {
  // Small holes between stroller spokes, below the component audit's 20px cutoff.
  'baby-momma': [[487, 1137], [510, 1142], [511, 1147], [512, 1154], [485, 1207], [483, 1208], [141, 1218], [140, 1222], [84, 1246], [128, 1259]],
};

(async () => {
  fs.mkdirSync(`${root}/corrected`, { recursive: true });
  const regions = JSON.parse(fs.readFileSync(`${root}/regions.json`));
  const report = [];
  for (const character of regions) {
    const { name, width: w, height: h, parts } = character;
    const source = `${root}/originals/${name}.webp`;
    const { data } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const output = Buffer.from(data), n = w * h;
    const mask = new Uint8Array(n), queue = new Int32Array(n);
    const neighbors = p => {
      const x = p % w, y = Math.floor(p / w);
      return [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
    };
    const background = p => {
      const k = p * 4, rgb = [data[k], data[k + 1], data[k + 2]];
      return data[k + 3] > 0 && Math.min(...rgb) >= 226 && Math.max(...rgb) - Math.min(...rgb) <= 24;
    };
    const seeds = [...selected[name].map(index => parts[index].seed), ...(extraSeeds[name] ?? [])];
    for (const [x, y] of seeds) {
      const seed = y * w + x;
      assert(background(seed), `${name}: invalid background seed ${x},${y}`);
      if (mask[seed]) continue;
      let head = 0, tail = 1; queue[0] = seed; mask[seed] = 1;
      while (head < tail) {
        const p = queue[head++];
        for (const next of neighbors(p)) {
          if (next >= 0 && !mask[next] && background(next)) { mask[next] = 1; queue[tail++] = next; }
        }
      }
    }
    // A one-pixel alpha transition removes white antialias fringes without
    // eroding the dark ink boundary or modifying any RGB values.
    let cleared = 0, feathered = 0;
    for (let p = 0; p < n; p++) {
      const k = p * 4;
      if (mask[p]) { output[k + 3] = 0; cleared++; continue; }
      if (!data[k + 3] || !neighbors(p).some(j => j >= 0 && mask[j])) continue;
      const min = Math.min(data[k], data[k + 1], data[k + 2]);
      const max = Math.max(data[k], data[k + 1], data[k + 2]);
      if (min < 120 || max - min > 55) continue;
      output[k + 3] = Math.round(data[k + 3] * Math.min(1, (255 - min) / 135));
      if (output[k + 3] < data[k + 3]) feathered++;
    }
    const destination = `${root}/corrected/${name}.webp`;
    // Only replace the independent alpha chunk. Keep the original compressed
    // RGB chunk byte-for-byte, avoiding both recompression damage and file bloat.
    const encodedMask = await sharp(output, { raw: { width: w, height: h, channels: 4 } }).webp({ quality: 80, alphaQuality: 100, effort: 6 }).toBuffer();
    fs.writeFileSync(destination, replaceAlpha(fs.readFileSync(source), encodedMask));
    const decoded = await sharp(destination).ensureAlpha().raw().toBuffer();
    let preserved = 0;
    for (let k = 0; k < data.length; k += 4) {
      assert.equal(decoded[k + 3], output[k + 3], `${name}: alpha mismatch`);
      if (decoded[k + 3] > 0) {
        assert.equal(decoded[k], data[k]); assert.equal(decoded[k + 1], data[k + 1]); assert.equal(decoded[k + 2], data[k + 2]);
        preserved++;
      }
    }
    for (const bg of ['#a13487', '#152832']) {
      await sharp(destination).flatten({ background: bg }).resize(600).png().toFile(`${root}/${name}-after-${bg.slice(1)}.png`);
    }
    if (process.argv.includes('--apply')) {
      const target = path.join('artifacts/squabblemon/public/assets/characters', `${name}.webp`);
      const current = fs.readFileSync(target);
      assert(current.equals(fs.readFileSync(source)) || current.equals(fs.readFileSync(destination)), `${name}: game asset changed since audit; refusing to overwrite`);
      fs.copyFileSync(destination, target);
    }
    report.push({ name, cleared, feathered, preservedPixelsWithExactRGB: preserved, width: w, height: h, bytes: fs.statSync(destination).size, extraSeeds: extraSeeds[name] ?? [], regions: selected[name].map(i => parts[i]) });
  }
  fs.writeFileSync(`${root}/cleanup-results.json`, JSON.stringify(report, null, 2));
  console.log(report.map(({ regions, ...summary }) => summary));
})();
