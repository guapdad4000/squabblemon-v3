const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const origin = 'http://localhost:4179/squabblemon/';
(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    for(const [name,width,height] of [['desktop',1440,1000],['phone',390,844]]) {
      const page = await browser.newPage({viewport:{width,height}});
      const errors=[], missing=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('response',r=>{if(r.status()>=400 && /guap\.(webp|mp4)/.test(r.url()))missing.push(r.url());});
      await page.addInitScript(()=>{
        localStorage.setItem('squabblemon_e2e_user','signed-in');
        window.guapVideos=[];const create=document.createElement.bind(document);
        document.createElement=function(tag,...args){const el=create(tag,...args);if(tag==='video')window.guapVideos.push(el);return el;};
      });
      await page.goto(origin+'game/collection',{waitUntil:'domcontentloaded'});
      await page.getByRole('searchbox',{name:'Search collection'}).fill('GUAP');
      const control=page.getByTestId('collection-card-control').filter({hasText:'GUAP'});
      await control.click();
      const dialog=page.getByRole('dialog',{name:'GUAP card details'});
      await dialog.waitFor();
      assert.match(await dialog.innerText(),/Mythical/i);
      assert.match(await dialog.innerText(),/FINNAM!/);
      const portrait=page.locator('img[src*="/characters/guap.webp"]').first();
      await portrait.evaluate(img=>img.decode());
      assert(await portrait.evaluate(img=>img.naturalWidth===1024 && img.naturalHeight===1536));
      await page.screenshot({path:'screenshots/guap-card-'+name+'.png'});
      await page.goto(origin+'game/decks/block',{waitUntil:'domcontentloaded'});
      await page.getByTestId('deck-collection-grid').waitFor();
      await page.getByRole('button',{name:'Replace Cornball',exact:true}).click();
      await page.getByRole('button',{name:'Add GUAP',exact:true}).click();
      await page.getByRole('button',{name:'Save & test crew',exact:true}).click();
      await page.getByTestId('battle-arena').waitFor();
      await page.locator('[data-card-zone="hand"][data-card-id="guap"]').first().waitFor();
      const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('squabblemon.preview-decks.v1'))[0]);
      assert(saved.cardIds.includes('guap') && saved.valid);
      await page.goto(origin+'e2e/wave3-moves.fixture.html?card=guap',{waitUntil:'domcontentloaded'});
      const attack=page.getByTestId('character-attack'); await attack.waitFor();
      assert.equal(await attack.getAttribute('data-character'),'guap');
      assert.equal(await attack.evaluate(el=>getComputedStyle(el).getPropertyValue('--attack-color').trim()),'#f5c542');
      await page.evaluate(()=>window.wave3Fixture.impact());
      assert.equal(await attack.getAttribute('data-impact'),'true');
      assert.match(await page.locator('.attack-delta.is-gain').innerText(),/\+2/);
      assert.match(await page.locator('.attack-delta.is-loss').innerText(),/1/);
      await page.locator('[data-move-id="char91"] canvas[data-ready="true"]').waitFor();
      await page.waitForFunction(()=>window.guapVideos.some(v=>v.src.includes('char91_chroma.mp4') && v.currentTime>=5.2));
      const alpha=await page.locator('[data-move-id="char91"] canvas').evaluate(canvas=>{const d=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let visible=0;for(let i=3;i<d.length;i+=4)if(d[i]>128)visible++;return visible;});
      assert(alpha>1000,'finisher remains visible');
      await page.screenshot({path:'screenshots/guap-battle-'+name+'.png'});
      await page.evaluate(()=>window.wave3Fixture.ready());
      assert.equal(await page.getByTestId('character-attack').count(),0);
      assert(await page.evaluate(()=>window.guapVideos.every(v=>!v.src.includes('char91_chroma.mp4'))),'skip unloads GUAP video');
      await page.goto(origin+'moves?card=guap',{waitUntil:'domcontentloaded'});
      assert.equal(await page.getByLabel('Card',{exact:true}).inputValue(),'guap');
      assert.equal(await page.getByLabel('Animation',{exact:true}).inputValue(),'char91');
      await page.locator('canvas[data-ready="true"]').waitFor();
      await page.getByRole('button',{name:'Play with sound',exact:true}).click();
      await page.waitForFunction(()=>window.guapVideos.some(v=>v.src.includes('char91_chroma.mp4') && !v.muted && !v.paused));
      await page.getByRole('button',{name:'Mute preview',exact:true}).click();
      assert(await page.evaluate(()=>window.guapVideos.filter(v=>v.src.includes('char91_chroma.mp4')).every(v=>v.muted)));
      assert.deepEqual(errors,[]); assert.deepEqual(missing,[]);
      console.log(name+': GUAP portrait, Mythical inspector, deck save, battle deltas, gold effect, cleanup, full FINNAM video, audio/mute, and cleanup verified.');
      await page.close();
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
