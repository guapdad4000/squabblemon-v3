import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const ids=['church','nightmedic','piratedj','promoter','gamer','counter','conductor','captainjigga','ashlee','foodz'];
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 await mkdir('../../screenshots/element-decks',{recursive:true});
 for (const width of [320,390,1280]) {
  const page=await browser.newPage({viewport:{width,height:900},isMobile:width<600,hasTouch:width<600});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4206/e2e/element-preview.html');
  for (const id of ids) {
   await page.getByLabel('Inspect updated card').selectOption(id);
   await page.waitForFunction(()=>{const image=document.querySelector<HTMLImageElement>('.collector-portrait');return image?.complete&&image.naturalWidth>0;});
   const card=page.getByTestId('element-card');
   assert.equal(await card.locator('h4').count(),1);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'card overflows '+width+' '+id);
   if(['church','nightmedic','piratedj','promoter','gamer'].includes(id)) assert.equal(await card.locator('[data-card-rarity]').getAttribute('data-card-rarity'),'Epic');
   if(id==='ashlee') assert.equal(await page.getByTestId('element-type').textContent(),'Plant');
   if(id==='piratedj') await card.getByText(/refunds 1 Motion/).waitFor();
   if(id==='nightmedic') await card.getByText(/Weaken, and Lock/).waitFor();
   assert.equal(await page.locator('vite-error-overlay').count(),0);
   await page.screenshot({path:'../../screenshots/element-decks/'+id+'-'+width+'.png',fullPage:true});
  }
  assert.deepEqual(errors,[]);
  console.log(width+'px: all 10 portraits, element labels, Epic frames and expanded text passed.');
  await page.close();
 }
}finally{await browser.close();}
