import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin = process.env.DRAG_ORIGIN ?? 'http://127.0.0.1:4181/squabblemon';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
const fixture = `${origin}/e2e/battle-drag.fixture.html`;
const checks = [];
const record = message => { checks.push(message); console.log(message); };
const position = async locator => { const b = await locator.boundingBox(); assert(b); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
async function mouseDrag(page, card, lane, release = true) {
  const start = await position(card), end = await position(lane);
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(start.x, start.y - 24, { steps: 3 });
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.getByTestId('battle-drag-preview').waitFor();
  if (release) await page.mouse.up();
}
async function touchDrag(page, card, lane, release = true) {
  const cdp = await page.context().newCDPSession(page);
  const start = await position(card), end = await position(lane);
  const point = (x,y) => [{ x, y, radiusX: 5, radiusY: 5, force: 1, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(start.x,start.y) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(start.x,start.y-25) });
  for (let step=1;step<=10;step++) await cdp.send('Input.dispatchTouchEvent', { type:'touchMove', touchPoints: point(start.x+(end.x-start.x)*step/10,start.y-25+(end.y-start.y+25)*step/10) });
  await page.getByTestId('battle-drag-preview').waitFor();
  if(release) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  return cdp;
}
try {
  for (const [name, width, height, touch] of [['desktop',1280,900,false],['phone',390,844,true],['small-phone',320,740,true],['tablet',820,1180,true],['landscape',844,390,true]]) {
    const context = await browser.newContext({ viewport: { width,height }, hasTouch: touch, isMobile: touch, reducedMotion:'reduce' });
    const page = await context.newPage(); page.on('pageerror', e=>errors.push(e.message));
    await page.goto(fixture); const source = page.locator('[data-battle-draggable="true"][data-card-id="cornball"]'); await source.waitFor();
    const lane = page.locator('[data-drop-lane="0"]');
    const drop = touch ? touchDrag : mouseDrag;
    const touchSession = await drop(page, source, lane, false);
    assert.equal(await lane.getAttribute('data-drop-state'),'ready');
    assert.match(await page.getByTestId('battle-drag-preview').innerText(),/Release to play/);
    await page.screenshot({path:`../../screenshots/battle-drag-${name}.png`});
    if(touch) { await touchSession.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); } else await page.mouse.up();
    await page.locator('[data-card-zone="board"][data-card-id="cornball"]').waitFor();
    assert.equal(await page.locator('[data-card-zone="board"][data-card-id="cornball"]').count(),1);
    assert.equal(await source.count(),0); assert.equal(await page.getByTestId('motion-player').innerText(),'1');
    record(`${name}: immediate drop, one play, correct Motion`);
    await context.close();
  }
  const context = await browser.newContext({ viewport:{width:1280,height:900}, reducedMotion:'reduce' });
  const page = await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
  const source = () => page.locator('[data-battle-draggable="true"][data-card-id="cornball"]');
  await page.goto(`${fixture}?locked`); await source().waitFor();
  await mouseDrag(page,source(),page.locator('[data-drop-lane="1"]'),false);
  assert.equal(await page.locator('[data-drop-lane="1"]').getAttribute('data-drop-state'),'blocked');
  await page.mouse.up(); assert.equal(await source().count(),1); assert.equal(await page.getByTestId('motion-player').innerText(),'2');
  const expensive=page.locator('[data-battle-draggable="true"][data-instance-id$=":og"]'); await expensive.scrollIntoViewIfNeeded();
  await mouseDrag(page,expensive,page.locator('[data-drop-lane="0"]'),false);
  assert.match(await page.getByTestId('battle-drag-preview').innerText(),/more Motion/);
  await page.mouse.up(); assert.equal(await expensive.count(),1);
  record('Locked and unaffordable drops reject without spending');
  await page.goto(fixture); await source().waitFor();
  await mouseDrag(page,source(),page.locator('[data-drop-lane="0"]'),false);
  await page.keyboard.press('Escape'); await page.mouse.up();
  assert.equal(await source().count(),1); assert.equal(await page.getByTestId('battle-drag-preview').count(),0);
  await mouseDrag(page,source(),page.locator('[data-drop-lane="0"]'),false);
  await page.mouse.move(5,5); await page.mouse.up(); assert.equal(await source().count(),1);
  record('Escape and off-board releases cancel');
  if (await source().getAttribute('aria-pressed') !== 'true') await source().click();
  await page.locator('[data-testid="lane-0"]').click(); await page.getByTestId('button-lock').click();
  await page.locator('[data-card-zone="board"][data-card-id="cornball"]').waitFor();
  record('Tap selection and Play card remain usable after cancellation');
  await page.goto(`${fixture}?online`); const online = page.locator('[data-battle-draggable="true"][data-card-id="cornball"]'); await online.waitFor();
  await mouseDrag(page,online,page.locator('[data-drop-lane="0"]'));
  await page.locator('[data-card-zone="board"][data-card-id="cornball"]').waitFor();
  assert.equal(await online.count(),0);
  record('Online drop resolves through the multiplayer command');

  await page.goto(fixture); await source().waitFor();
  await source().click(); await page.getByTestId('button-squabble').click();
  await mouseDrag(page,source(),page.locator('[data-drop-lane="0"]'));
  await page.locator('[data-card-zone="board"][data-card-id="cornball"]').waitFor();
  assert.equal(await page.locator('[data-card-zone="board"][data-card-id="cornball"]').getAttribute('data-card-power'),'2');
  record('Armed Squabble survives dragging the selected card');
  await page.goto(fixture); await source().waitFor();
  const pen = await context.newCDPSession(page), penStart = await position(source()), penEnd = await position(page.locator('[data-drop-lane="0"]'));
  await pen.send('Input.dispatchMouseEvent',{type:'mousePressed',x:penStart.x,y:penStart.y,button:'left',buttons:1,clickCount:1,pointerType:'pen'});
  await pen.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:penEnd.x,y:penEnd.y,button:'left',buttons:1,pointerType:'pen'});
  await pen.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:penEnd.x,y:penEnd.y,button:'left',buttons:0,clickCount:1,pointerType:'pen'});
  await page.locator('[data-card-zone="board"][data-card-id="cornball"]').waitFor();
  record('Pen pointer drops play immediately');
  await page.goto(`${fixture}?expire`); await source().waitFor();
  await mouseDrag(page,source(),page.locator('[data-drop-lane="0"]'),false);
  await page.locator('[data-presentation-phase="rival-thinking"]').waitFor();
  await page.mouse.up();
  assert.equal(await page.locator('[data-card-zone="board"][data-card-id="cornball"]').count(),0);
  assert.equal(await page.getByTestId('battle-drag-preview').count(),0);
  record('Turn changes cancel an in-flight drag');
  const phoneContext = await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  const phone = await phoneContext.newPage(); phone.on('pageerror',e=>errors.push(e.message));
  await phone.goto(fixture);
  const phoneCard = phone.locator('[data-battle-draggable="true"][data-card-id="plug"]'); await phoneCard.waitFor();
  const swipe = await phoneContext.newCDPSession(phone), at = await position(phoneCard);
  await swipe.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:at.x,y:at.y,id:1}]});
  await swipe.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:at.x-130,y:at.y-2,id:1}]});
  await swipe.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert(await phone.getByTestId('hand-tray').evaluate(node=>node.scrollLeft)>80);
  assert.equal(await phone.getByTestId('battle-drag-preview').count(),0);
  assert.equal(await phone.locator('[data-card-zone="board"]').count(),0);
  record('Horizontal touch swipe scrolls the hand without playing');
  await phone.goto(fixture); const cancelCard=phone.locator('[data-battle-draggable="true"][data-card-id="cornball"]'); await cancelCard.waitFor();
  const cancelled=await touchDrag(phone,cancelCard,phone.locator('[data-drop-lane="0"]'),false);
  await cancelled.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  assert.equal(await cancelCard.count(),1); assert.equal(await phone.getByTestId('battle-drag-preview').count(),0);
  record('Native touch cancellation returns the card');
  await phoneContext.close();

  await page.goto(`${origin}/play/guest`);
  await page.getByTestId('button-start').waitFor({timeout:15000}); await page.getByTestId('button-start').click();
  const ready = page.locator('[data-testid="battle-arena"][data-presentation-phase="player-ready"]');
  async function waitReady() {
    for(let i=0;i<200;i++) {
      if(await ready.count()) return;
      const skip=page.getByTestId('button-fast-forward');
      if(await skip.count()) await skip.click({timeout:300}).catch(()=>{});
      await page.waitForTimeout(75);
    }
    throw new Error('Guest battle did not become ready');
  }
  await waitReady();
  const actualCard=page.locator('[data-battle-draggable="true"][data-card-cost="1"]').first(); await actualCard.waitFor();
  const actualId=await actualCard.getAttribute('data-instance-id');
  const beforeHand=await page.locator('[data-battle-draggable="true"]').count();
  await mouseDrag(page,actualCard,page.locator('[data-drop-lane="0"]'));
  await page.waitForTimeout(150); await waitReady();
  assert.equal(await page.locator(`[data-card-zone="board"][data-instance-id="${actualId}"]`).count(),1);
  assert.equal(await page.locator('[data-battle-draggable="true"]').count(),beforeHand-1);
  record('Normal guest battle: dropping commits once, animates, and returns to the same turn');
  assert.deepEqual(errors,[]); console.log('No browser runtime errors.');
  await context.close();
} finally { await browser.close(); }
