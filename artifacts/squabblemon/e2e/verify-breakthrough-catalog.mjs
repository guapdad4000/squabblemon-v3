import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const output=process.env.BT_CATALOG_OUTPUT??'/tmp/bt-catalog-presentation';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto('http://127.0.0.1:5178/e2e/breakthrough-catalog.fixture.html');
 await page.waitForFunction(()=>window.catalogAcceptance);
 const cards=await page.evaluate(()=>window.catalogAcceptance.cards);
 const results=[];
 for(let i=0;i<cards.length;i++){
  const card=cards[i];
  await page.evaluate(id=>window.catalogAcceptance.show(id),card.id);
  const hand=page.locator('.bt-hand .bt-card');
  await hand.waitFor();
  await page.waitForFunction(name=>document.querySelector('.bt-hand .bt-card')?.getAttribute('aria-label')?.startsWith(name+','),card.name);
  assert.equal(await hand.count(),1);
  await page.waitForFunction(()=>{const img=document.querySelector('.bt-hand .bt-card img');return img?.complete&&img.naturalWidth>0;});
  const src=await hand.locator('img').getAttribute('src');assert.equal(src,card.art,card.id+': canonical portrait');
  await hand.click();
  const rules=page.locator('.bt-mini-explainer');await rules.waitFor();
  assert.equal(await rules.locator('strong').innerText(),card.name);
  assert((await rules.locator('.bt-ability-lead').innerText()).length>0);
  await rules.locator('summary').click();
  assert.equal(await rules.locator('details p').innerText(),card.description);
  assert.equal(await page.locator('.bt-deploy-zone').count(),3);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),card.id+': horizontal overflow');
  const box=await hand.boundingBox();assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=390&&box.y+box.height<=844,card.id+': hand reachable');
  if(i%40===0||card.id==='nabu'||card.id==='anu')await page.screenshot({path:output+'/'+card.id+'.png'});
  results.push({cardId:card.id,checks:['presentation'],portrait:src,viewport:'390x844'});
  if((i+1)%50===0)console.log(`${i+1}/${cards.length} cards rendered`);
 }
 for(const viewport of [{width:320,height:568},{width:844,height:390},{width:768,height:1024},{width:1440,height:900}]){
  await page.setViewportSize(viewport);await page.evaluate(()=>window.catalogAcceptance.show('nabu'));
  await page.waitForFunction(()=>document.querySelector('.bt-hand .bt-card')?.getAttribute('aria-label')?.startsWith('Nabu,'));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`${output}/arena-${viewport.width}x${viewport.height}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);
 await writeFile(output+'/evidence.json',JSON.stringify({cards:results,viewports:[ '320x568','390x844','844x390','768x1024','1440x900'],errors},null,2));
 console.log(JSON.stringify({cards:results.length,status:'passed',output}));
}finally{await browser.close();}
