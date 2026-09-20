import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
const report=[];
try {
 for(const [name,width,height,touch] of [['phone',390,844,true],['small-phone',320,568,true],['landscape',844,390,true],['desktop',1440,900,false],['desktop-portrait',900,1440,false],['tablet',820,1180,true]]) {
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});
  await context.addInitScript(()=>localStorage.setItem('squabblemon_e2e_user','signed-in'));
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(route.request().url().includes('multiplayer')?{rooms:[]}:{})}));
  await page.goto('http://127.0.0.1:4193/game/online');
  const lobby=page.getByRole('main',{name:'Fight night lobby'});await lobby.waitFor();
  await page.locator('.online-lineup img').first().waitFor();
  await page.getByRole('link',{name:'Solo training',exact:true}).click({trial:true});
  await page.screenshot({path:`../../screenshots/fight-${name}-top.jpg`,type:'jpeg',quality:80});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal page overflow');
  assert.equal(await lobby.evaluate(e=>e.scrollWidth>e.clientWidth+1),false,'no horizontal lobby overflow');
  if(await lobby.evaluate(e=>e.scrollHeight>e.clientHeight)) {
   if(touch) {
    const cdp=await context.newCDPSession(page);const x=width*.55,y=height*.8;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
    for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*height*.05,id:1}]});await page.waitForTimeout(20);}
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
   } else {await page.mouse.move(width/2,height/2);await page.mouse.wheel(0,550);}
   await page.waitForTimeout(400);assert.ok(await lobby.evaluate(e=>e.scrollTop)>0,'user gesture scrolls lobby');
  }
  const create=page.getByRole('button',{name:'Create friend fade',exact:true});await create.scrollIntoViewIfNeeded();
  await create.click({trial:true});
  const input=page.getByLabel('Have a room code?');await input.fill('ABC123ABC123');
  await page.getByRole('button',{name:'Join room',exact:true}).click({trial:true});
  await page.getByRole('heading',{name:'Your rooms',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:`../../screenshots/fight-${name}-bottom.jpg`,type:'jpeg',quality:80});
  await page.getByRole('link',{name:'Back to safehouse',exact:true}).click({trial:true});
  await page.getByRole('button',{name:'Open game navigation',exact:true}).click();
  await page.getByRole('dialog',{name:'Squabble Express'}).waitFor();
  await page.getByRole('button',{name:'Close game navigation',exact:true}).click();
  assert.deepEqual(errors,[]);report.push(`${name}: scroll gestures, create/join controls, rooms, sticky exit and train navigation pass`);console.log(report.at(-1));
  await context.close();
 }
}finally{await browser.close();await writeFile('../../screenshots/fight-verification.json',JSON.stringify(report,null,2));}
