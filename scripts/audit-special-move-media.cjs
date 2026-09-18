const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { clips } = require('../artifacts/squabblemon/src/specialMoves.json');
function boxes(bytes, start, end) {
  const result = [];
  for (let offset = start; offset + 8 <= end;) {
    const rawSize = bytes.readUInt32BE(offset);
    const header = rawSize === 1 ? 16 : 8;
    const size = rawSize === 1 ? Number(bytes.readBigUInt64BE(offset + 8)) : rawSize || end - offset;
    if (size < header || offset + size > end) throw new Error('Invalid MP4 box');
    result.push({ type: bytes.toString('ascii', offset + 4, offset + 8), start: offset + header, end: offset + size });
    offset += size;
  }
  return result;
}
for (const [id, clip] of Object.entries(clips)) {
  const bytes = fs.readFileSync(`artifacts/squabblemon/public/assets/special-moves/${clip.file}`);
  const moov = boxes(bytes, 0, bytes.length).find(box => box.type === 'moov');
  assert.ok(moov, `${id}: movie metadata`);
  const hasAudio = boxes(bytes, moov.start, moov.end).filter(box => box.type === 'trak').some(track => {
    const media = boxes(bytes, track.start, track.end).find(box => box.type === 'mdia');
    const handler = media && boxes(bytes, media.start, media.end).find(box => box.type === 'hdlr');
    return handler && bytes.toString('ascii', handler.start + 8, handler.start + 12) === 'soun';
  });
  assert.ok(hasAudio, `${id}: native audio track`);
}
console.log(`Native audio tracks present in all ${Object.keys(clips).length} MP4s.`);
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:4179/squabblemon/e2e/special-moves.fixture.html', { waitUntil: 'domcontentloaded' });
    const results = await page.evaluate(async clips => {
      const results = [];
      for (const [id, clip] of Object.entries(clips)) {
        const video = document.createElement('video'); video.muted = true; video.preload = 'auto';
        try {
          await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('decode timeout')), 8000);
            video.onerror = () => { clearTimeout(timer); reject(new Error('decode error')); };
            video.onloadedmetadata = () => { video.currentTime = clip.startSeconds; };
            video.onseeked = () => { clearTimeout(timer); resolve(); };
            video.src = `/squabblemon/assets/special-moves/${clip.file}?v=${clip.revision}`;
          });
          const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 128;
          const ctx = canvas.getContext('2d'); ctx.drawImage(video,0,0,96,128);
          const pixels = ctx.getImageData(0,0,96,128).data;
          let cyan = 0, green = 0;
          for(let i=0;i<pixels.length;i+=4) {
            if(Math.min(pixels[i+1],pixels[i+2])-pixels[i]>70)cyan++;
            if(pixels[i+1]-Math.max(pixels[i],pixels[i+2])>70)green++;
          }
          results.push({ id, duration: video.duration, width: video.videoWidth, height: video.videoHeight, cyan, green,
            excerptFits: video.duration >= clip.startSeconds + clip.durationMs / 1000 * clip.playbackRate });
        } catch(error) { results.push({ id, error: error.message }); }
        finally { video.removeAttribute('src'); video.load(); }
      }
      return results;
    }, clips);
    fs.writeFileSync('screenshots/special-move-media-audit.json', JSON.stringify(results,null,2));
    assert.deepEqual(results.filter(item => item.error), []);
    console.log(`Decoded and sought all ${results.length} clips successfully.`);
    console.log('Short excerpts:', JSON.stringify(results.filter(item => !item.excerptFits)));
    console.log('Green backdrops:', JSON.stringify(results.filter(item => item.green > item.cyan && item.green > 2000)));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
