const fs = require('fs');
const sharp = require('sharp');

(async () => {
  const audit = JSON.parse(fs.readFileSync('screenshots/alpha-audit/audit.json'));
  const all = [];
  for (const { name } of audit.affected) {
    const source = `screenshots/alpha-audit/originals/${name}.webp`;
    const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width, h = info.height, n = w * h;
    const seen = new Uint8Array(n), q = new Int32Array(n), parts = [];
    const white = p => {
      const k = p * 4, rgb = [data[k], data[k + 1], data[k + 2]];
      return data[k + 3] >= 200 && Math.min(...rgb) >= 235 && Math.max(...rgb) - Math.min(...rgb) <= 12;
    };
    for (let s = 0; s < n; s++) {
      if (seen[s] || !white(s)) continue;
      let head = 0, tail = 1, minX = w, minY = h, maxX = 0, maxY = 0;
      q[0] = s; seen[s] = 1;
      while (head < tail) {
        const p = q[head++], x = p % w, y = Math.floor(p / w);
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        for (const j of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
          if (j >= 0 && !seen[j] && white(j)) { seen[j] = 1; q[tail++] = j; }
        }
      }
      if (tail >= 20) parts.push({ seed: [s % w, Math.floor(s / w)], area: tail, box: [minX, minY, maxX, maxY] });
    }
    parts.sort((a, b) => b.area - a.area);
    const svg = Buffer.from(`<svg width="${w}" height="${h}">${parts.map((c, i) => {
      const [x, y, r, b] = c.box;
      return `<rect x="${x - 3}" y="${y - 3}" width="${r - x + 6}" height="${b - y + 6}" fill="none" stroke="#00ffef" stroke-width="2"/><text x="${r + 3}" y="${y + 10}" font-size="17" font-family="Arial" fill="#00ffef" stroke="#000" stroke-width=".5">${i}</text>`;
    }).join('')}</svg>`);
    const annotated = await sharp(source).flatten({ background: '#993883' }).composite([{ input: svg }]).png().toBuffer();
    await sharp(annotated).resize(750).png().toFile(`screenshots/alpha-audit/${name}-regions.png`);
    all.push({ name, width: w, height: h, parts });
  }
  fs.writeFileSync('screenshots/alpha-audit/regions.json', JSON.stringify(all, null, 2));
  console.log(all.map(x => ({ name: x.name, regions: x.parts.length })));
})();
