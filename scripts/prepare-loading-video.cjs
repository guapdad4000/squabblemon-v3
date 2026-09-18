const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
  const temporarySource = path.resolve(__dirname, '../artifacts/squabblemon/public/brand/loading-scenes.mp4');
  fs.copyFileSync(path.resolve(__dirname, '../attached_assets/openart-fde21c7c-25d_7c34ced1_1788824842195_1788825466448.mp4'), temporarySource);
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:4179/squabblemon/brand/loading-scenes.mp4', { waitUntil: 'domcontentloaded' });
    const output = await page.evaluate(async () => {
      const video = document.querySelector('video'); video.muted = true; video.pause();
      if (video.readyState < 2) await new Promise(resolve => video.addEventListener('loadeddata', resolve, { once: true }));
      const canvas = document.createElement('canvas'); canvas.width = 540; canvas.height = 960;
      const context = canvas.getContext('2d');
      await new Promise(resolve => { video.addEventListener('seeked', resolve, { once: true }); video.currentTime = 1; });
      context.drawImage(video, 0, 0, 540, 960);
      const poster = canvas.toDataURL('image/webp', .8).split(',')[1];
      await new Promise(resolve => { video.addEventListener('seeked', resolve, { once: true }); video.currentTime = 0; });
      const stream = canvas.captureStream(24);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 1200000 });
      const chunks = []; recorder.ondataavailable = event => chunks.push(event.data);
      const finished = new Promise(resolve => { recorder.onstop = resolve; });
      let frame;
      const draw = () => { context.drawImage(video, 0, 0, 540, 960); frame = requestAnimationFrame(draw); };
      draw(); recorder.start();
      video.onended = () => { cancelAnimationFrame(frame); recorder.stop(); stream.getTracks().forEach(track => track.stop()); };
      await video.play(); await finished;
      const blob = new Blob(chunks, { type: 'video/webm' });
      const encoded = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.readAsDataURL(blob); });
      return { poster, encoded, bytes: blob.size };
    });
    fs.writeFileSync('artifacts/squabblemon/public/brand/loading-scenes.webm', Buffer.from(output.encoded, 'base64'));
    fs.writeFileSync('artifacts/squabblemon/public/brand/loading-scenes.webp', Buffer.from(output.poster, 'base64'));
    console.log(`Prepared muted loading montage: ${(output.bytes / 1024 / 1024).toFixed(1)} MiB plus still poster.`);
  } finally { await browser.close(); fs.unlinkSync(temporarySource); }
})().catch(error => { console.error(error); process.exit(1); });
