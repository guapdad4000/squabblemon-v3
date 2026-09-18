const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true});
 try {
  const page = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await page.route('**/api/player/bootstrap', route => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  const errors=[];page.on('pageerror', e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('squabblemon_e2e_user','signed-in'));
  for (const [width,height] of [[1440,1000],[1280,800],[390,844],[844,390]]) {
   await page.setViewportSize({width,height});
   await page.goto('http://localhost:4179/squabblemon/game/decks/block');
   await page.getByLabel('Deck name',{exact:true}).waitFor();
   await page.evaluate(async () => { await document.fonts.ready; await Promise.race([Promise.allSettled([...document.images].filter(image => image.complete).map(image => image.decode())), new Promise(resolve => setTimeout(resolve, 2000))]); });
   await page.screenshot({animations: 'disabled', path:'screenshots/arsenal-builder-'+width+'.png'});
   const bounds=await page.evaluate(()=>({
    width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
    libraryHeight:document.querySelector('.deck-workbench__library').getBoundingClientRect().height,
    actions:document.querySelector('.deck-workbench__actions').getBoundingClientRect().toJSON(),
    nav:document.querySelector('.fan-nav').getBoundingClientRect().toJSON()
   }));
   console.log(width,bounds);
   assert.ok(bounds.scrollWidth<=width,'No horizontal page overflow');
   if (width >= 1000) assert.ok(bounds.libraryHeight >= 150,'Desktop collection has usable browsing height');
   await page.getByRole('button',{name:'Focus view',exact:true}).click();
   assert.equal(await page.locator('.fan-nav').isVisible(),false);
   await page.screenshot({animations: 'disabled', path:'screenshots/arsenal-focus-'+width+'.png'});
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('.fan-nav').isVisible(),true);
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('http://localhost:4179/squabblemon/game/decks/block');
  await page.getByRole('button',{name:'Save deck',exact:true}).click();
  await page.waitForURL(/\/game\/decks\/[a-f0-9-]{36}$/);
  await page.getByRole('button',{name:'Back to my decks',exact:true}).click();
  await page.getByTestId('deck-archive-control').first().waitFor();
  await page.evaluate(async () => { await document.fonts.ready; await Promise.race([Promise.allSettled([...document.images].filter(image => image.complete).map(image => image.decode())), new Promise(resolve => setTimeout(resolve, 2000))]); });
  await page.screenshot({animations: 'disabled', path:'screenshots/arsenal-crews-1440.png'});
  await page.locator('.arsenal-archive__examples summary').click();
  await page.screenshot({animations: 'disabled', path:'screenshots/arsenal-examples-1440.png'});
  await page.goto('http://localhost:4179/squabblemon/game/collection');
  await page.getByTestId('collection-card-control').first().waitFor();
  await page.evaluate(async () => { await document.fonts.ready; await Promise.race([Promise.allSettled([...document.images].filter(image => image.complete).map(image => image.decode())), new Promise(resolve => setTimeout(resolve, 2000))]); });
  await page.screenshot({animations: 'disabled', path:'screenshots/arsenal-collection-1440.png'});
  await page.getByRole('button',{name:'Filters',exact:true}).click();
  await page.screenshot({animations: 'disabled', path:'screenshots/arsenal-filters-1440.png'});
  await page.getByRole('button',{name:'Fire',exact:true}).click();
  assert.ok(await page.getByTestId('collection-card-control').count()>0);
  await page.getByLabel('Search collection',{exact:true}).fill('unlikely-no-match');
  assert.equal(await page.getByTestId('collection-card-control').count(),0);
  await page.getByRole('button',{name:'Clear filters',exact:true}).first().click();
  await page.getByRole('button',{name:'Filters',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({animations: 'disabled', path:'screenshots/arsenal-collection-390.png'});
  await page.getByTestId('collection-card-control').first().click();
  await page.screenshot({animations:'disabled',path:'screenshots/arsenal-inspector-390.png'});
  await page.getByTestId('button-close-inspector').click();
  await page.setViewportSize({width:1440,height:1000});
  await page.getByTestId('collection-card-control').first().click();
  await page.screenshot({animations:'disabled',path:'screenshots/arsenal-inspector-1440.png'});
  await page.getByTestId('button-close-inspector').click();
  assert.deepEqual(errors,[]);
  console.log('Screenshots and screen, focus, filter, inspector checks passed.');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
