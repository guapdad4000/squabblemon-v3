const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const origin = process.env.TEST_BASE_URL || 'http://127.0.0.1:4204';
const output = process.env.REVIEW_OUTPUT || '/tmp/battle-mobile-review';
(async () => {
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/google-chrome',args:['--no-sandbox']});
 const results=[];
 try {
 for (const [width,height] of [[320,568],[390,844],[430,932],[844,390],[1440,1000]]) {
  const mobile=width<600;
  const page=await browser.newPage({viewport:{width,height},isMobile:mobile,hasTouch:mobile});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${origin}/e2e/battle-mobile.fixture.html`, {waitUntil:'domcontentloaded'});
  await page.getByTestId('battle-arena').waitFor();
  await page.evaluate(()=>Promise.race([Promise.all([...document.images].filter(i=>i.loading!=='lazy').map(i=>i.decode().catch(()=>{}))),new Promise(resolve=>setTimeout(resolve,3000))]));
  await page.waitForTimeout(400);
  const battlefield=await page.locator('.battlefield-grid').boundingBox();
  const board=await page.locator('[data-card-zone="board"]').evaluateAll(nodes=>nodes.map(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height})));
  assert.equal(board.length,22);
  assert.ok(board.every(c=>c.width>0&&c.height>0));
  if(width===844)assert.ok(Math.min(...board.map(c=>c.width))>=60,'landscape cards do not shrink to fit their rows');
  if(mobile){
   assert.ok(Math.min(...board.map(c=>c.width))>=46,'crowded mobile cards keep a readable footprint');
   assert.ok(Math.max(...board.map(c=>c.width))-Math.min(...board.map(c=>c.width))<1,'sparse and crowded lanes use the same card scale');
  }
  const actionBounds=await page.locator('.battle-primary-action').boundingBox();
  assert.ok(actionBounds && actionBounds.y+actionBounds.height<=height+1,'primary action stays on screen');
  for(const theme of ['light','dark']){
   await page.evaluate(t=>{document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.dataset.theme=t},theme);
   await page.screenshot({path:`${output}/${width}-overview-${theme}.png`});
  }
  await page.getByTestId('district-details-0').click();
  const solo=page.getByRole('dialog',{name:/district view/});
  await solo.waitFor();
  assert.equal(await solo.locator('nav').count(),0,'location title/details control opens solo details on every viewport');
  assert.equal(await solo.locator('[data-card-zone="board"]').count(),0);
  assert.ok(await solo.getByTestId('location-description').isVisible());
  assert.ok(await solo.getByTestId('location-rule').isVisible());
  await page.screenshot({path:`${output}/${width}-location.png`});
  await page.keyboard.press('Escape');
  await solo.waitFor({state:'hidden'});
  assert.ok(await page.getByTestId('district-details-0').evaluate(node=>node===document.activeElement),'solo Escape restores focus to location opener');
  if(mobile) {
   const stack=page.getByTestId('lane-2-player-zone').locator('.battle-card-stack');
   const scrolled=await stack.evaluate(n=>{n.scrollTop=n.scrollHeight;return {top:n.scrollTop,height:n.clientHeight,total:n.scrollHeight}});
   assert.ok(scrolled.top>0, 'crowded formations scroll instead of shrinking');
   await page.getByRole('button',{name:/View .* location details/}).first().click();
  }else await page.getByRole('button',{name:/Inspect your gang/}).first().click();
  const dialog=page.getByRole('dialog',{name:/district view/});
  await dialog.waitFor();
  if(mobile){
   assert.equal(await dialog.locator('nav button').count(),0,'location entry shows only the selected location');
   assert.equal(await dialog.locator('[data-card-zone="board"]').count(),0,'location entry has no fighter cards');
   assert.ok(await dialog.getByTestId('location-description').isVisible());
   assert.ok(await dialog.getByTestId('location-rule').isVisible());
   assert.equal(await dialog.locator('details, summary').count(),0,'location information is always open');
   await page.screenshot({path:`${output}/${width}-location.png`});
   await dialog.getByRole('button',{name:'View fighters here',exact:true}).click();
  }
  assert.equal(await dialog.locator('nav button').count(),3);
  assert.ok(await dialog.getByRole('heading',{name:/Rival/}).isVisible());
  assert.ok(await dialog.getByRole('heading',{name:/Your gang/}).isVisible());
  await page.screenshot({path:`${output}/${width}-district.png`});
  const expanded=await dialog.locator('[data-card-zone="board"]').first().boundingBox();assert.ok(expanded.width>120);
  await dialog.locator('nav button').nth(1).click();
  assert.equal(await dialog.locator('[data-card-zone="board"]').count(),2, 'both one-card teams can be inspected');
  assert.ok(await dialog.getByTestId('location-rule').isVisible());
  assert.equal(await dialog.locator('details, summary').count(),0,'district rules remain visible without toggling');
  await page.screenshot({path:`${output}/${width}-district-rule.png`});
  await dialog.locator('[data-card-zone="board"]').first().click();
  await page.getByTestId('button-close-inspector').waitFor();
  await page.getByTestId('button-close-inspector').click();
  await page.getByTestId('button-close-inspector').waitFor({state:'hidden'});
  await dialog.getByRole('button',{name:'Back to board'}).click();
  if(mobile) await page.getByRole('button',{name:/View .* location details/}).nth(1).click();
  else await page.getByRole('button',{name:/Inspect your gang/}).nth(1).click();
  await page.keyboard.press('Escape');
  await dialog.waitFor({state:'hidden'});
  assert.ok(await page.evaluate(()=>document.activeElement?.matches('.formation-expand, .mobile-district-open')),'Escape restores focus to its opener');
  await page.locator('[data-card-zone="hand"]').first().click();
  if(mobile){
   assert.equal(await page.locator('.mobile-selected-card').count(),0);
   const card=await page.locator('[data-card-zone="hand"][aria-pressed="true"]').boundingBox();
   const hold=await page.context().newCDPSession(page);
   await hold.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:card.x+card.width/2,y:card.y+card.height/2,id:1}]});
   await page.waitForTimeout(600);
   await hold.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await hold.detach();
   await page.getByTestId('button-close-inspector').waitFor();
   await page.screenshot({path:`${output}/${width}-full-card.png`});
   await page.getByTestId('button-close-inspector').click();
   await page.getByTestId('button-close-inspector').waitFor({state:'hidden'});
  }
  await page.getByTestId('lane-0').click();
  assert.ok(await page.locator('.preview-target').count()>0,'selected move identifies its affected fighters');
  await page.waitForTimeout(400);
  await page.waitForTimeout(500);
  const checkAnchor=async()=>{
   const positions=await page.evaluate(()=>{
    const line=document.querySelector('[data-testid="battle-target-line"]');
    const arena=document.querySelector('[data-testid="battle-arena"]').getBoundingClientRect();
    const card=document.querySelector('[data-card-zone="hand"][aria-pressed="true"]').getBoundingClientRect();
    const point=line.querySelector('[data-origin]');
    const target=document.querySelector('[data-testid="lane-0"]').getBoundingClientRect();
    const end=line.querySelector('[data-destination]');
    return {visible:getComputedStyle(line).visibility,x:Number(point.getAttribute('cx'))+arena.left,y:Number(point.getAttribute('cy'))+arena.top,cardX:card.x+card.width/2,cardY:card.y,endX:Number(end.getAttribute('cx'))+arena.left,endY:Number(end.getAttribute('cy'))+arena.top,targetX:target.x+target.width/2,targetY:target.bottom};
   });
   assert.equal(positions.visible,'visible');
   assert.ok(Math.abs(positions.x-positions.cardX)<2 && Math.abs(positions.y-positions.cardY)<2,'line originates from the selected card: '+JSON.stringify(positions));
   assert.ok(Math.abs(positions.endX-positions.targetX)<2 && Math.abs(positions.endY-positions.targetY)<2,'line ends at the chosen district');
  };
  await checkAnchor();
  await page.screenshot({path:`${output}/${width}-targeting.png`});
  await page.locator('[data-card-zone="hand"]').nth(2).click();
  if(await page.getByTestId('lane-0').getAttribute('aria-pressed')!=='true')await page.getByTestId('lane-0').click();
  await page.mouse.move(0,0);
  await page.waitForTimeout(700);
  await checkAnchor();
  await page.screenshot({path:`${output}/${width}-targeting-third-card.png`});
  await page.locator('[data-card-zone="hand"]').first().click();
  if(await page.getByTestId('lane-0').getAttribute('aria-pressed')!=='true')await page.getByTestId('lane-0').click();
  await page.mouse.move(0,0);
  await page.waitForTimeout(700);
  await checkAnchor();
  if(mobile){
   await page.getByTestId('hand-tray').evaluate(n=>n.scrollTo({left:n.scrollWidth,behavior:'instant'}));
   await page.waitForTimeout(600);
   assert.equal(await page.getByTestId('battle-target-line').evaluate(n=>getComputedStyle(n).visibility),'hidden','an offscreen card cannot leave a floating line');
   await page.getByTestId('hand-tray').evaluate(n=>n.scrollTo({left:0,behavior:'instant'}));
   await page.waitForTimeout(600);
   await checkAnchor();
   assert.match(await page.locator('picture.battle-venue__art img').evaluate(n=>n.currentSrc),/assets\/venues\//);
   assert.equal(await page.locator('picture.battle-venue__art img').evaluate(n=>getComputedStyle(n).objectFit),'contain');
  }
  if(width===390){
   await page.setViewportSize({width:410,height});await page.waitForTimeout(600);await checkAnchor();
   await page.setViewportSize({width,height});await page.waitForTimeout(600);await checkAnchor();
  }
  if(mobile){
   const selectedField=await page.locator('.battlefield-grid').boundingBox();
   assert.ok(Math.abs(selectedField.height-battlefield.height)<1,'card selection does not resize the battlefield');
   const selected=await page.locator('[data-card-zone="hand"][aria-pressed="true"]').boundingBox();
   const other=await page.locator('[data-card-zone="hand"][aria-pressed="false"]').first().boundingBox();
   assert.ok(selected.width>other.width);
   const tray=await page.getByTestId('hand-tray').boundingBox();
   assert.ok(selected.y>=tray.y,'selected card stats remain inside the hand viewport');
  }
  await page.getByTestId('button-lock').click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-card-zone="hand"]').length===6);
  assert.equal(await page.locator('[data-card-zone="board"]').count(),23);
  if(mobile){
   const touch=await page.context().newCDPSession(page);
   const hand=page.getByTestId('hand-tray');
   await hand.evaluate(n=>{n.scrollLeft=0});
   const card=await page.locator('[data-card-zone="hand"]').nth(1).boundingBox();
   const x=card.x+card.width/2,y=card.y+card.height/2;
   await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
   await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-100,y,id:1}]});
   await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   assert.ok(await hand.evaluate(n=>n.scrollLeft)>30,'sideways touch swipes browse the hand');
   assert.equal(await page.locator('[data-card-zone="hand"][aria-pressed="true"]').count(),0);
   await page.waitForTimeout(500);
   await hand.evaluate(n=>n.scrollTo({left:0,behavior:'instant'}));
   const source=await page.locator('[data-card-zone="hand"]').first().boundingBox();
   const target=await page.getByTestId('lane-1').boundingBox();
   const sx=source.x+source.width/2,sy=source.y+source.height/2,tx=target.x+target.width/2,ty=target.y+target.height/2;
   await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:sx,y:sy,id:1}]});
   await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:sx,y:sy-25,id:1}]});
   for(let step=1;step<=8;step++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:sx+(tx-sx)*step/8,y:sy-25+(ty-sy+25)*step/8,id:1}]});
   await page.getByTestId('battle-drag-preview').waitFor({timeout:5000});
   assert.match(await page.getByTestId('battle-drag-preview').innerText(),/Release to play/);
   await page.screenshot({path:`${output}/${width}-drag.png`});
   await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await page.waitForFunction(()=>document.querySelectorAll('[data-card-zone="hand"]').length===5);
   assert.equal(await page.locator('[data-card-zone="board"]').count(),24,'touch drop plays once');
   await touch.detach();
  }
  assert.deepEqual(errors,[]);
  results.push({width,height,boardCards:board.length,minimumCardWidth:Math.min(...board.map(c=>c.width)),expandedWidth:expanded.width,inspect:true,selectAndPlay:true,errors});
  await page.close();
 }
 }finally{await browser.close()}
 fs.writeFileSync(`${output}/browser.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
