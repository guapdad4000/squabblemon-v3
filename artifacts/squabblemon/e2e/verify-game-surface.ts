import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const output = process.env.SURFACE_OUTPUT ?? '/tmp/game-surface-review';
await mkdir(output, {recursive:true});
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
const results:unknown[]=[];
try {
  for (const [name,width,height,touch] of [['phone',390,844,true],['landscape',844,390,true],['desktop',1440,1000,false]] as const) {
    const context=await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch});
    const page=await context.newPage(), errors:string[]=[];
    page.on('pageerror',e=>errors.push(e.message));
    // tsx keeps local function names; browser-evaluated closures need the helper.
    await page.addInitScript('window.__name = (value) => value');
    await page.goto(`${process.env.REVIEW_BASE_URL ?? 'http://127.0.0.1:4319'}/e2e/game-surface.fixture.html`);
    await expect(page.locator('html')).toHaveAttribute('data-game-surface','active');
    await expect(page.locator('#game-copy')).toHaveCSS('user-select','none');
    await expect(page.locator('#portal-label')).toHaveCSS('user-select','none');
    await expect(page.locator('#game-copy')).toHaveCSS('cursor','default');
    await expect(page.locator('#edit-field')).toHaveCSS('user-select','text');
    await expect(page.locator('#game-image')).toHaveCSS('-webkit-user-drag','none');
    const events=await page.evaluate(()=>{
      const cancelled=(id:string,type:string)=>!document.getElementById(id)!.dispatchEvent(new Event(type,{bubbles:true,cancelable:true}));
      return {
        imageMenu:cancelled('game-image','contextmenu'), portalMenu:cancelled('portal-image','contextmenu'),
        imageDrag:cancelled('game-image','dragstart'), labelSelect:cancelled('game-copy','selectstart'),
        inputSelect:cancelled('edit-field','selectstart'), inputMenu:cancelled('edit-field','contextmenu'),
        notesSelect:cancelled('edit-notes','selectstart'), editableSelect:cancelled('editable','selectstart'),
        codeSelect:cancelled('copy-code','selectstart'), selectMenu:cancelled('native-select','contextmenu'),
        puzzleDrag:cancelled('puzzle-handle','dragstart'),
        puzzleIconDrag:!document.querySelector('#puzzle-handle svg')!.dispatchEvent(new Event('dragstart',{bubbles:true,cancelable:true})),
        pointerCancelled:cancelled('game-image','pointerdown'), touchCancelled:cancelled('game-image','touchmove'),
      };
    });
    assert.deepEqual(events,{imageMenu:true,portalMenu:true,imageDrag:true,labelSelect:true,inputSelect:false,inputMenu:false,notesSelect:false,editableSelect:false,codeSelect:false,selectMenu:false,puzzleDrag:false,puzzleIconDrag:false,pointerCancelled:false,touchCancelled:false});
    await page.locator('#card-target').click({button:'right'});
    await expect(page.locator('#inspection-state')).toHaveText('Details opened');
    await page.locator('#edit-field').fill('My deck');
    await page.locator('#edit-field').press('ControlOrMeta+A');
    assert.equal(await page.locator('#edit-field').evaluate((input:HTMLInputElement)=>input.selectionEnd!-input.selectionStart!),7);
    await page.locator('#native-select').selectOption({label:'Rare'});
    assert.equal(await page.locator('#native-select').inputValue(),'Rare');
    // A real mouse drag cannot highlight game copy, even though text inputs can select.
    await page.locator('#game-copy').scrollIntoViewIfNeeded();
    const copy=await page.locator('#game-copy').boundingBox(); assert.ok(copy);
    await page.evaluate(()=>{document.activeElement instanceof HTMLElement && document.activeElement.blur();getSelection()?.removeAllRanges();});
    await page.mouse.move(copy.x+2,copy.y+8); await page.mouse.down(); await page.mouse.move(Math.min(width-20,copy.x+250),copy.y+12,{steps:8}); await page.mouse.up();
    assert.equal(await page.evaluate(()=>getSelection()?.toString()),'');
    await page.locator('#card-rail').scrollIntoViewIfNeeded();
    const rail=await page.locator('#card-rail').boundingBox(); assert.ok(rail);
    let railMoved=false;
    if (touch) {
      const cdp=await context.newCDPSession(page);
      const x=Math.min(width-24,rail.x+rail.width-25),y=Math.min(height-25,rail.y+50);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
      for(let i=1;i<=8;i++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*22,y}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await expect.poll(()=>page.locator('#card-rail').evaluate(el=>el.scrollLeft)).toBeGreaterThan(20);
      railMoved=true;
      const main=page.locator('.game-route-stage'); const before=await main.evaluate(el=>el.scrollTop);
      const sx=width/2,sy=Math.min(height-30,Math.max(60,rail.y+rail.height+35));
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:sx,y:sy}]});
      for(let i=1;i<=8;i++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:sx,y:sy-i*15}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await expect.poll(()=>main.evaluate(el=>el.scrollTop)).toBeGreaterThan(before);
    } else {
      await page.locator('#card-rail').evaluate(el=>el.scrollLeft=250);
      railMoved=await page.locator('#card-rail').evaluate(el=>el.scrollWidth<=el.clientWidth || el.scrollLeft>0);
      await page.mouse.move(width/2,Math.min(height-30,rail.y+rail.height+30)); await page.mouse.wheel(0,300);
      await expect.poll(()=>page.locator('.game-route-stage').evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
    }
    assert.ok(railMoved);
    const bounds=await page.evaluate(()=>({document:document.documentElement.scrollWidth,viewport:innerWidth,x:scrollX,routeX:document.querySelector('.game-route-stage')!.scrollLeft,routeOverflow:getComputedStyle(document.querySelector('.game-route-stage')!).overflowX}));
    assert.ok(bounds.document<=bounds.viewport); assert.equal(bounds.x,0); assert.equal(bounds.routeX,0); assert.equal(bounds.routeOverflow,'hidden');
    await page.locator('#stop-policy').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-game-surface');
    assert.equal(await page.locator('#game-image').evaluate(el=>el.dispatchEvent(new Event('contextmenu',{bubbles:true,cancelable:true}))),true);
    assert.deepEqual(errors,[]);
    results.push({name,width,height,touch,events,railMoved,bounds,editable:true,cardContextPropagation:true,cleanup:true,errors});
    await context.close(); console.log(`PASS ${name} native UI protection / rail / vertical scroll / cleanup`);
  }
} finally {await browser.close();}
await writeFile(`${output}/report.json`,JSON.stringify(results,null,2));
