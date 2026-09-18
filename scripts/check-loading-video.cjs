const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const [name, width, height] of [['desktop',1280,900],['phone',390,844]]) {
      const page = await browser.newPage({viewport:{width,height}});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto('http://localhost:4179/squabblemon/e2e/loading.fixture.html',{waitUntil:'domcontentloaded'});
      await page.locator('video[data-playing="true"]').waitFor();
      const properties=await page.locator('video').evaluate(v=>({muted:v.muted,loop:v.loop,inline:v.playsInline,duration:v.duration,width:v.videoWidth,height:v.videoHeight}));
      assert.ok(properties.muted && properties.loop && properties.inline);console.log(name,JSON.stringify(properties));
      await page.getByRole('button',{name:'Pause background'}).click();
      assert.equal(await page.locator('video').evaluate(v=>v.paused),true);
      await page.getByRole('button',{name:'Play background'}).click();
      await page.screenshot({path:`screenshots/loading-screen-${name}.png`});
      await page.evaluate(()=>{window.loadingVideo=document.querySelector('video'); window.finishLoading();});
      await page.getByText('Ready',{exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>window.loadingVideo.paused),true);
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.reload({waitUntil:'domcontentloaded'});
      await page.getByRole('status',{name:'Loading Squabblemon'}).waitFor();
      assert.equal(await page.locator('video').count(),0);
      await page.emulateMedia({reducedMotion:'no-preference'});
      await page.route('**/loading-scenes.webm',route=>route.abort());
      await page.reload({waitUntil:'domcontentloaded'});
      await page.getByRole('status',{name:'Loading Squabblemon'}).waitFor();
      assert.ok(await page.locator('.brand-loader__poster').evaluate(async img=>{await img.decode();return img.naturalWidth>0}));
      assert.deepEqual(errors,[]);
      await page.close();
    }
    console.log('Loading background: desktop/phone playback, pause/resume, cleanup, reduced motion and failed-video poster passed.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exit(1)});
