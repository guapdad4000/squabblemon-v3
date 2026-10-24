import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const origin = process.env.STORY_ORIGIN ?? 'http://127.0.0.1:4242';
const output = process.env.STORY_OUTPUT ?? 'screenshots/story-clarity';
await mkdir(output, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_EXECUTABLE ? {executablePath:process.env.CHROMIUM_EXECUTABLE} : {});
const report = [];
try {
  for (const [name,width,height] of [['desktop',1440,960],['phone',390,844],['small-phone',320,740],['short-phone',320,568],['landscape',844,390]]) {
    const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',hasTouch:width<600});
    const page=await context.newPage();await page.routeWebSocket('**',socket=>socket.close());
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${origin}/e2e/season-theater.fixture.html?scenario=season-two&theater=1`,{waitUntil:'domcontentloaded'});
    await page.locator('.cinema-poster[data-current=true]').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForFunction(()=>{const rail=document.querySelector('.theater-posters').getBoundingClientRect(),p=document.querySelector('.cinema-poster[data-current=true]').getBoundingClientRect();return Math.abs((p.left+p.right-rail.left-rail.right)/2)<3;});
    const expected=await page.evaluate(()=>{const c=window.storyClarityFixture.campaign(),n=c.nodes.find(n=>n.nodeId===c.recommendedNodeId);return {id:n.nodeId,title:n.title,chapter:c.chapters.find(ch=>ch.id===n.chapterId).title};});
    const ticket=page.getByTestId('button-continue-story');
    assert.ok((await ticket.innerText()).includes(expected.title));assert.ok((await ticket.innerText()).includes(expected.chapter));
    assert.equal(await page.locator('.cinema-poster[data-current=true]').getAttribute('data-testid'),'button-presentation-season-2');
    assert.equal(await page.locator('.cinema-poster[data-status=cleared]').count(),1);
    assert.ok(await page.locator('.cinema-poster[data-status=locked]').count()>0);
    const states=await page.locator('.cinema-poster').evaluateAll(posters=>posters.slice(0,3).map(p=>({state:p.getAttribute('data-status'),label:p.querySelector('.cinema-poster-status-badge').textContent,badge:getComputedStyle(p.querySelector('.cinema-poster-status-badge')).backgroundColor,border:getComputedStyle(p).borderColor})));
    assert.equal(new Set(states.map(s=>s.badge)).size,3,'Current, completed and locked badges remain distinct');
    const fits=await ticket.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;});
    assert.ok(fits,'Destination ticket fits the viewport');
    const art=await page.locator('.cinema-poster[data-current=true] .cinema-poster-art').boundingBox();
    assert.ok(art.height>100,'Authored cover retains a substantial uncropped area');
    await page.screenshot({path:join(output,`story-${name}-current.png`)});
    // Browse with a real touch gesture on phones, keyboard elsewhere, then
    // resize. Initial positioning must never take back control after browsing.
    if (width < 600) {
      const cdp=await context.newCDPSession(page), poster=await page.locator('.cinema-poster[data-current=true]').boundingBox();
      const y=poster.y+poster.height*.45, start=width*.78, end=width*.12;
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start,y}]});
      for(let step=1;step<=5;step++) {await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start+(end-start)*step/5,y}]});await page.waitForTimeout(25);}
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
      await page.waitForFunction(()=>{const rail=document.querySelector('.theater-posters').getBoundingClientRect(),p=document.querySelector('.cinema-poster[data-current=true]').getBoundingClientRect();return Math.abs((p.left+p.right-rail.left-rail.right)/2)>100;});
    } else {
      await page.locator('.cinema-poster[data-current=true]').focus();await page.keyboard.press('End');
      await page.waitForFunction(()=>document.querySelector('.cinema-poster:last-child').getAttribute('data-selected')==='true');
    }
    await page.setViewportSize({width:width+8,height});
    await page.waitForTimeout(250);
    const manual=await page.evaluate(()=>{const rail=document.querySelector('.theater-posters').getBoundingClientRect(),current=document.querySelector('.cinema-poster[data-current=true]').getBoundingClientRect(),selected=document.querySelector('.cinema-poster[data-selected=true]');return {selected:selected.getAttribute('data-testid'),currentDistance:Math.abs((current.left+current.right-rail.left-rail.right)/2),scrollLeft:document.querySelector('.theater-posters').scrollLeft};});
    assert.equal(manual.selected,width<600?'button-presentation-season-2':'button-presentation-special-squabble-house');assert.ok(manual.currentDistance>100,'Manual browsing remains away from the recommended season');
    await page.screenshot({path:join(output,`story-${name}-manual.png`)});
    // Continue always opens the destination printed on the ticket, even after
    // browsing a locked poster at the other end of the theater.
    await ticket.click();await page.waitForFunction(id=>new URLSearchParams(location.search).get('node')===id,expected.id);
    assert.deepEqual(errors,[]);report.push({name,expected,states,art,manual,input:width<600?'touch swipe':'keyboard',continueReachedPrintedNode:true,errors});
    await context.close();console.log(`${name}: current-season centering, manual browsing, distinct status, and exact Continue destination passed.`);
  }
} finally {await browser.close();await writeFile(join(output,'story-clarity-verification.json'),JSON.stringify(report,null,2));}
