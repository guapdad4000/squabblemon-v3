import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const base = process.env.KUMITE_FILMS_ORIGIN ?? 'http://127.0.0.1:4207';
const output = fileURLToPath(new URL('../../deliverables/kumite-anime-arc-20261015/arc-expansion/qa/player/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const report = [];
try {
  for (const [name, width, height, reduced] of [['desktop',1440,900,false],['tablet',768,1024,false],['phone',390,844,false],['small-phone',320,568,true],['landscape-phone',844,390,true]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    const errors = [], media = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if(request.url().includes('/films/v1/'))media.push(request.url()); });
    await page.goto(`${base}/e2e/kumite-films.fixture.html`, { waitUntil: 'networkidle' });
    assert.equal(media.length, 0, 'No film or poster fetch until requested');
    const opener = page.getByRole('button', { name: 'Watch Undercova Brotha Kumite film', exact: true });
    await opener.click();
    const player = page.locator('dialog.kumite-film');
    await player.waitFor();
    if(reduced){ assert.equal(await player.locator('video').evaluate(v=>v.paused),true);await player.getByRole('button',{name:'Play film',exact:true}).click(); }
    await page.waitForFunction(()=>document.querySelector('dialog video')?.currentTime>.2);
    const bounds = await player.boundingBox();
    assert.ok(bounds.x>=-1 && bounds.y>=-1 && bounds.x+bounds.width<=width+1 && bounds.y+bounds.height<=height+1);
    for(const button of await player.getByRole('button').all()) {
      const b = await button.boundingBox();assert.ok(b.y>=0 && b.y+b.height<=height+1 && b.height>=44);
    }
    assert.equal(await player.locator('video').getAttribute('playsinline'),'');
    assert.ok((await player.locator('video').getAttribute('src')).includes(height>width?'portrait':'landscape'));
    await player.locator('video').evaluate(v=>{v.pause();v.currentTime=3.8;});
    await page.waitForFunction(()=>{const v=document.querySelector('dialog video');return v&&!v.seeking&&v.readyState>=2;});
    await page.waitForTimeout(400);
    await page.screenshot({path:`${output}${name}.png`});
    await player.getByRole('button',{name:'Replay',exact:true}).click();
    await page.waitForFunction(()=>{const v=document.querySelector('dialog video');return v&&!v.paused&&v.currentTime<2;});
    const src=await player.locator('video').getAttribute('src');
    await page.setViewportSize({width:height,height:width});
    assert.equal(await player.locator('video').getAttribute('src'),src,'Rotation preserves the edit and playhead');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog[open]').count(),0);
    assert.equal(await opener.evaluate(b=>document.activeElement===b),true,'Focus restored');
    await opener.click();await player.getByRole('button',{name:'Skip / close'}).click();
    assert.equal(await page.locator('dialog[open]').count(),0);
    await page.getByRole('button',{name:'Open parent panel'}).click();
    await page.getByRole('dialog',{name:'Parent fixture panel'}).getByRole('button',{name:'Watch Undercova Brotha Kumite film'}).click();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog',{name:'Parent fixture panel'}).count(),1,'Escape closes only the film');
    assert.deepEqual(errors,[]);
    report.push({name,viewport:[width,height],reducedMotion:reduced,playback:true,skip:true,replay:true,focusRestored:true,rotationPreserved:true,errors});
    await context.close();console.log(name+' passed');
  }
  const page=await browser.newPage();
  await page.goto(`${base}/e2e/kumite-films.fixture.html?locked`,{waitUntil:'networkidle'});
  assert.equal(await page.getByRole('button',{name:/Watch .* Kumite film/}).count(),0);
  await page.goto(`${base}/e2e/kumite-films.fixture.html`,{waitUntil:'networkidle'});
  await page.evaluate(()=>document.documentElement.dataset.reduceMotion='true');
  await page.getByRole('button',{name:'Watch Undercova Brotha Kumite film'}).click();
  assert.equal(await page.locator('dialog video').evaluate(v=>v.paused),true,'Game reduced-motion setting is respected');
  await page.getByRole('button',{name:'Skip / close'}).click();
  await page.route('**/films/v1/*.mp4',r=>r.abort());
  await page.goto(`${base}/e2e/kumite-films.fixture.html`,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Watch Undercova Brotha Kumite film'}).click();
  await page.getByRole('alert').waitFor();
  await page.getByRole('button',{name:'Skip / close'}).click();
  assert.equal(await page.locator('dialog[open]').count(),0);
  report.push({lockedNoReplay:true,failedMediaCanClose:true,gameReducedMotionRespected:true});
} finally {await browser.close();await writeFile(`${output}verification.json`,JSON.stringify(report,null,2));}
