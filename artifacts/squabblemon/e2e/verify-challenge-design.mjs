import {chromium,expect} from '@playwright/test';
import {openFadecade} from './fadecade.fixture.ts';
import {mkdir} from 'node:fs/promises';
const out=process.env.REVIEW_OUTPUT??'/tmp/challenge-design-review';await mkdir(out,{recursive:true});
async function choose(page, selector, value) {
 if(await selector.evaluate(el=>el.tagName==='SELECT')) { await selector.selectOption(value); return; }
 await selector.click();await page.locator(`[role=option][data-value="${value}"]`).click();
}
async function choices(page, selector) {
 if(await selector.evaluate(el=>el.tagName==='SELECT')) return selector.locator('option').evaluateAll(a=>a.map(i=>i.value));
 await selector.click();const values=await page.getByRole('option').evaluateAll(a=>a.map(i=>i.getAttribute('data-value')));await page.keyboard.press('Escape');return values;
}
const browser=await chromium.launch();
try {
for(const [viewport,width,height] of [['desktop',1440,1000],['phone',390,844],['short-phone',360,640]]) {
 const page=await browser.newPage({baseURL:process.env.REVIEW_BASE_URL??'http://localhost:4199',viewport:{width,height},reducedMotion:'reduce'});
 await page.routeWebSocket('**',s=>s.close());const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const api=await openFadecade(page,{activeRun:true});await page.route('**/api/player/stockz',r=>r.fulfill({json:{active:null,roundsToday:2,recent:[]}}));
 await expect(page.locator('.fadecade-hub')).toBeVisible();await page.screenshot({path:`${out}/${viewport}-hub.png`});
 for(const [key,name] of [['road',''],['daily','Open daily bounties'],['weekly','Open weekly bounties'],['training','Open training circuit'],['events','Open street events'],['stockz','Play Stockz']]) {
  const opener=key==='road'?page.locator('[data-testid="fadecade-flagship"] button'):page.getByRole('button',{name,exact:true});
  await opener.click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  const box=await dialog.boundingBox();if(box.x<0||box.y<0||box.x+box.width>width+1||box.y+box.height>height+1)throw Error(`${viewport}/${key} outside viewport`);
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  if(key==='training') {
   const selector=page.getByRole('combobox',{name:'Select Training Mode'});const values=await choices(page,selector);
   for(const value of values){await choose(page,selector,value);await expect(page.getByRole('button',{name:/^Practice /})).toBeEnabled();}
   await choose(page,selector,'auto');await expect(dialog.locator('.challenge-crew-cards img')).toHaveCount(10);
  }
  if(key==='events') {
   await dialog.locator('.draft-card-btn').first().click();await expect(dialog.locator('.challenge-drafted img')).toHaveCount(1);await page.getByRole('button',{name:'Undo last pick'}).click();
   for(let i=0;i<10;i++)await dialog.locator('.draft-card-btn').first().click();await expect(page.getByRole('button',{name:'Enter draft run'})).toBeEnabled();await page.getByRole('button',{name:'Restart draft'}).click();
   await page.getByRole('button',{name:'View Events'}).click();await expect(page.getByRole('button',{name:'View Events'})).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('button',{name:'Play neighborhood event'})).toBeEnabled();
   const selector=page.getByRole('combobox',{name:'Select Event'});await choose(page,selector,'boss');await expect(page.getByRole('button',{name:'Play boss event'})).toBeEnabled();
   await page.getByRole('button',{name:'View Draft'}).click();
  }
  if(key==='road'){await page.getByRole('button',{name:'End run',exact:true}).click();await expect(page.getByRole('button',{name:'End run now'})).toBeEnabled();await page.getByRole('button',{name:'Keep run'}).click();}
  if(key==='stockz'){await expect(page.getByRole('button',{name:'Bet 25 Clout'})).toBeEnabled();await page.getByRole('button',{name:'↘ Down'}).click();await expect(page.getByRole('button',{name:'↘ Down'})).toHaveAttribute('aria-pressed','true');}
  const last=dialog.locator('button:enabled').last();await last.scrollIntoViewIfNeeded();await last.focus();await page.keyboard.press('Tab');expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);
  await dialog.locator('.fadecade-dialog-scroll-body').evaluate(el=>el.scrollTop=0);await page.screenshot({path:`${out}/${viewport}-${key}.png`});
  const broken=await dialog.locator('img').evaluateAll(a=>a.filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.src));expect(broken,`${viewport}/${key} broken images`).toEqual([]);
  await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await expect(opener).toBeFocused();
 }
 expect(api.requests.starts).toHaveLength(0);expect(api.requests.abandons).toBe(0);expect(errors).toEqual([]);console.log(`${viewport}: six popups, eight drills, ten-pick draft + undo, two events, road confirmation, Stockz selection and keyboard focus passed.`);await page.close();
}
} finally {await browser.close();}
