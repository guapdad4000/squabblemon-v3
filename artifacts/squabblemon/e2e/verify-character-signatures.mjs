import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const origin=process.env.UI_ORIGIN??'http://127.0.0.1:43248';
assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const output=process.env.SIGNATURE_PROOF_DIR??'screenshots/character-signatures';
const audit=JSON.parse(await readFile(process.env.SIGNATURE_AUDIT??new URL('../reference/cosmetics/generated-signatures-v4.json',import.meta.url),'utf8'));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:320,height:740},reducedMotion:'reduce'});
const page=await context.newPage();const errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400&&r.url().includes('/assets/cosmetics/'))errors.push(r.status()+' '+r.url())});
async function loaded(card){
 await page.goto(origin+'/e2e/character-signatures.fixture.html?card='+card,{waitUntil:'networkidle'});
 await page.getByTestId('character-styles').waitFor();
 const banner=page.locator('.character-banner__artwork').first(),cover=page.locator('.style-deck-cover img');
 await banner.evaluate(im=>im.decode());await cover.scrollIntoViewIfNeeded();await cover.evaluate(im=>im.decode());
 assert((await banner.getAttribute('src')).includes('/'+card+'/banner-v4.webp'),card+' dedicated banner');
 assert((await cover.getAttribute('src')).includes('/'+card+'/deck-cover-v4.webp'),card+' dedicated deck cover');
 const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,banner:(()=>{const e=document.querySelector('.character-banner');const r=e.getBoundingClientRect();return r.width/r.height})()}));
 assert(layout.scroll<=layout.width+2,card+' horizontal overflow '+JSON.stringify(layout));assert(Math.abs(layout.banner-3)<.04,card+' banner frame aspect');
}
try{
 for(const c of audit.missing){await loaded(c.id);checks.push('320px: '+c.name+' banner and cover load without overflow');}
 for(const width of [390,768,1440]){
  await page.setViewportSize({width,height:900});
  for(const card of ['franklin-duke','squabble-house-manager','he-just-a-friend','ms-mary-mack']){
   await loaded(card);await page.screenshot({path:output+'/'+card+'-'+width+'.png',fullPage:true});checks.push(width+'px: '+card+' framing');
  }
 }
 await page.goto(origin+'/e2e/character-signatures.fixture.html?card=franklin-duke&tab=stickers');
 await page.getByTestId('character-styles').waitFor();assert.equal(await page.getByRole('button',{name:/Sticker pack/}).count(),0);assert.equal(await page.locator('.style-sticker-sheet').count(),0);
 await page.getByRole('button',{name:'Equip banner',exact:true}).click();await page.getByRole('button',{name:'Equipped',exact:true}).waitFor();checks.push('New base banner equips locally without buying an empty sticker pack');
 await page.goto(origin+'/e2e/character-signatures.fixture.html?card=kyle');await page.getByTestId('character-styles').waitFor();assert.equal(await page.locator('.style-sticker-sheet button').count(),8);checks.push('KYLE keeps all eight existing stickers');
 await page.goto(origin+'/e2e/character-signatures.fixture.html?card=franklin-duke&owned=false');await page.getByTestId('locked-character-style').waitFor();assert.equal(await page.getByRole('button',{name:'Equip banner',exact:true}).count(),0);checks.push('Card ownership gate retained');
 await page.goto(origin+'/e2e/character-signatures.fixture.html?view=decks');await page.locator('img[src*="deck-cover-v4.webp"]').first().waitFor();assert.equal(await page.locator('img[src*="deck-cover-v4.webp"]').count(),3);checks.push('Kumite deck carousel consumes all three new covers');
 assert.deepEqual(errors,[]);await writeFile(output+'/verification.json',JSON.stringify({complete:true,checks,errors},null,2));console.log(JSON.stringify({passed:checks.length,errors}));
}finally{await browser.close();}
