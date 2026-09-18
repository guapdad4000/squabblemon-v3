const { chromium } = require('playwright');
(async () => {
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 for (const [name,width,height] of [['desktop',1280,900],['phone',390,844],['landscape',844,390]]) {
  const page=await browser.newPage({viewport:{width,height}});
  page.on('pageerror', e=>console.log('ERROR',e.message));
  await page.goto('http://127.0.0.1:4179/squabblemon/play/guest');
  await page.getByTestId('button-start').click();
  await page.getByRole('button',{name:/^Continue past /}).click();
  await page.waitForFunction(()=>document.querySelector('[data-testid="battle-arena"]')?.getAttribute('data-presentation-phase')==='player-ready');
  await page.waitForTimeout(500);
  console.log('portraits',await page.locator('[data-card-zone] img').evaluateAll(xs=>xs.every(x=>x.complete && x.naturalWidth>0)));
  await page.screenshot({path:`screenshots/battle-rework-${name}.png`});
  console.log(name, await page.getByTestId('button-next-round').boundingBox());
  await page.getByTestId('hand-tray').locator('[data-card-zone="hand"]:not([title])').first().click();
  await page.getByRole('button',{name:/^Deploy /}).first().click();
  await page.getByTestId('button-lock').click();
  await page.getByTestId('character-attack').waitFor();
  await page.waitForTimeout(240);
  await page.screenshot({path:`screenshots/battle-rework-${name}-attack.png`});
  await page.getByTestId('button-fast-forward').click();
  await page.waitForFunction(()=>document.querySelector('[data-testid="battle-arena"]')?.getAttribute('data-presentation-phase')==='player-ready',{},{timeout:20000});
  console.log(name,'turn completed',await page.locator('[data-card-zone="board"]').count());
  await page.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
