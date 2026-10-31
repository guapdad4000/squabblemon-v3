import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

// This exercises the real component and rules against the controlled local fixture.
// Native authenticated reward/ownership verification is a separate database tier.
const base = process.env.ANUNAKI_PREVIEW_URL ?? 'http://127.0.0.1:5198';
const output = process.env.REVIEW_OUTPUT ?? path.resolve('screenshots/anunaki-raid');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH ?? '/usr/bin/google-chrome', args: ['--enable-unsafe-swiftshader'] });
const report = [];
async function decodedArt(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const visible = [...document.images].filter(image => { const r=image.getBoundingClientRect(); return r.width>0 && r.height>0 && r.bottom>0 && r.top<innerHeight && r.right>0 && r.left<innerWidth; });
    await Promise.all(visible.map(image => image.decode()));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
try {
  for (const [width, height] of [[320,568],[390,844],[844,390],[1440,1000]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    const errors = [], failedImages = []; page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.request().resourceType()==='image' && response.status()>=400) failedImages.push([response.status(),response.url()]); });
    await page.goto(`${base}/e2e/anunaki-raid.fixture.html?battle&difficulty=standard&replay=5`);
    await page.locator('.raid-cinema-hero').waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.anunaki-motion img')].every(image => image.complete && image.naturalWidth > 0));
    assert.equal(await page.locator('.raid-crew [role=button], .raid-crew button, .raid-police button').count() > 0, true, 'real legal replay populates the shared field');
    await decodedArt(page);
    assert.deepEqual(failedImages,[], 'visible artwork requests succeed');
    await page.screenshot({ path: path.join(output, `raid-stage-${width}.png`), fullPage: true });
    await page.locator('.raid-police button:visible').last().click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('button', { name: 'Close card details' }).click();
    const expand = page.locator('.raid-formation-expand').first();
    assert.ok(await expand.count(), 'crowded legal replay exposes all fighters');
    const expectedFormation = Number((await expand.getAttribute('aria-label')).match(/View all (\d+)/)[1]);
    await expand.click();
    assert.equal(await page.locator('.raid-formation-card').count(), expectedFormation);
    await page.locator('.raid-formation-card').last().getByRole('button').first().click();
    const closeDetails = page.getByRole('button', { name: 'Close card details' });
    assert.equal(await closeDetails.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), true, 'overflow card details sit above the formation dialog');
    await closeDetails.click();
    await page.getByRole('button', { name: 'Close formation' }).click();
    await page.getByRole('button', { name: 'Rules for Arrival Gate' }).count().then(async count => {
      // Native <summary> exposes a button role in Chromium, but its semantics vary by engine.
      if (count) await page.getByRole('button', { name: 'Rules for Arrival Gate' }).click();
      else await page.locator('summary[aria-label="Rules for Arrival Gate"]').click();
    });
    const rules = await page.locator('.raid-district-summary details[open] p').boundingBox();
    assert.ok(rules && rules.x >= 0 && rules.x + rules.width <= width + 1, 'district explanation remains inside the viewport');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await decodedArt(page);
    assert.deepEqual(failedImages,[]);
    await page.screenshot({ path: path.join(output, `raid-final-${width}.png`), fullPage: true });
    assert.deepEqual(errors, []);
    report.push({ width, height, populated: true, inspection: true, overflowInspection: expectedFormation, districtRules: true, overflow: false, visibleArtDecoded: true, failedImageRequests: 0 });
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width:390, height:844 }, reducedMotion:'reduce' });
  await page.goto(`${base}/e2e/anunaki-raid.fixture.html?battle&investment`);
  await page.locator('.raid-hand-card').first().click();
  await page.getByRole('combobox',{name:'Extra Motion investment'}).selectOption('2');
  await page.locator('.raid-lane-label').first().click();
  await page.getByRole('button', { name:/^PLAY CARD / }).click();
  await page.waitForFunction(() => window.raidActions.length === 1);
  await page.locator('.raid-hand-card').first().click();
  await page.locator('.raid-lane-label').first().click();
  await page.getByRole('button', { name:/^PLAY CARD / }).click();
  await page.waitForFunction(() => window.raidActions.length === 2);
  const actions = await page.evaluate(() => window.raidActions);
  assert.equal(actions[0].investment, 2);
  assert.equal(actions[1].investment, 0, 'ordinary card cannot inherit hidden investment');
  assert.equal(await page.locator('[role=alert]').count(), 0);
  await page.getByRole('button', { name: 'END TURN →' }).click();
  await page.waitForFunction(() => window.raidActions.length === 3);
  await page.waitForFunction(() => document.querySelector('.raid-cinema-hero .anunaki-motion')?.dataset.anunakiPhase === 'strike');
  await page.waitForFunction(() => document.querySelector('.raid-cinema-hero .anunaki-motion')?.dataset.anunakiPhase === 'recoil');
  await page.waitForFunction(() => document.querySelector('.raid-cinema-hero .anunaki-motion')?.dataset.anunakiPhase === 'idle' && document.querySelector('.raid-cinema-hero')?.dataset.hit === 'false');
  assert.equal(actions[0].investment, 2);
  report.push({ investmentFollowup: true, finiteImpact: true });
  await page.screenshot({ path: path.join(output,'raid-investment-followup-phone.png'), fullPage:true });
  const retryPage = await browser.newPage({ viewport: { width:390, height:844 }, reducedMotion:'reduce' });
  await retryPage.goto(`${base}/e2e/anunaki-raid.fixture.html?battle&investment&retry`);
  await retryPage.locator('.raid-hand-card').first().click();
  await retryPage.locator('.raid-lane-label').first().click();
  await retryPage.getByRole('button', { name:/^PLAY CARD / }).click();
  await retryPage.getByRole('alert').waitFor();
  assert.equal(await retryPage.getByRole('button', { name:/^PLAY CARD / }).isDisabled(), true, 'unsaved client state blocks new intents');
  await retryPage.getByRole('button', { name:'Retry save' }).click();
  await retryPage.waitForFunction(() => window.raidRequests.length === 2 && !document.querySelector('[role=alert]'));
  const retried = await retryPage.evaluate(() => ({ requests:window.raidRequests, applied:window.raidActions }));
  assert.deepEqual(retried.requests[0],retried.requests[1], 'lost response retry keeps exact revision/action identity and intent');
  assert.equal(retried.applied.length,1,'the controlled saved receipt applies the action once');
  report.push({ lostResponseRetry:true, exactIdentity:true, appliedOnce:true });
  await retryPage.screenshot({ path:path.join(output,'raid-retry-followup-phone.png'),fullPage:true });
  await retryPage.close();
  for (const wager of [2,3]) {
    const choicePage = await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
    await choicePage.goto(`${base}/e2e/anunaki-raid.fixture.html?battle&choices`);
    await choicePage.getByRole('button',{name:'Select The Dice Game',exact:true}).click();
    await choicePage.getByRole('combobox',{name:'Dice wager'}).selectOption(String(wager));
    await choicePage.locator('.raid-lane-label').first().click();
    const baseDice = await choicePage.evaluate(() => window.raidState.match.playerHand.find(card=>card.cardId==='the-dice-game').cost);
    assert.ok((await choicePage.getByRole('button',{name:/^PLAY CARD /}).textContent()).includes(`${baseDice+wager} ⚡`),'Dice price includes the exact selected wager');
    await choicePage.getByRole('button',{name:/^PLAY CARD /}).click();
    await choicePage.waitForFunction(()=>window.raidActions.length===1);
    await choicePage.getByRole('button',{name:'Select The Concert',exact:true}).click();
    await choicePage.getByRole('combobox',{name:'Concert mode'}).selectOption('1');
    await choicePage.locator('.raid-lane-label').nth(1).click();
    await choicePage.getByRole('button',{name:/^PLAY CARD /}).click();
    await choicePage.waitForFunction(()=>window.raidActions.length===2);
    const choices = await choicePage.evaluate(()=>({actions:window.raidActions,board:window.raidState.match.boards[1]}));
    assert.equal(choices.actions[0].investment,wager);
    assert.equal(choices.actions[1].investment,1);
    assert.ok(choices.board.some(card=>card.owner==='player'&&card.powerModifier===-1),'Concert mosh damages the ally by one');
    assert.ok(choices.board.some(card=>card.owner==='cpu'&&card.powerModifier===3),'Concert mosh damages the enemy by three');
    await choicePage.getByRole('button',{name:'Select Cornball',exact:true}).click();
    assert.equal(await choicePage.getByRole('combobox').count(),0,'ordinary card has no inherited wager or mode');
    await choicePage.locator('.raid-lane-label').first().click();
    await choicePage.getByRole('button',{name:/^PLAY CARD /}).click();
    await choicePage.waitForFunction(()=>window.raidActions.length===3);
    assert.equal(await choicePage.evaluate(()=>window.raidActions[2].investment),0);
    report.push({diceWager:wager,exactQuote:true,concertMosh:true,ordinaryChoiceReset:true});
    await choicePage.close();
  }
  const motionPage = await browser.newPage({ viewport: {width:390,height:844}, reducedMotion:'no-preference' });
  await motionPage.goto(`${base}/e2e/anunaki-raid.fixture.html?battle&investment&motion&latency`);
  await motionPage.waitForFunction(() => document.querySelector('.raid-cinema-hero .anunaki-motion img')?.dataset.playing === 'true');
  for (let play=0;play<2;play++) {
    await motionPage.locator('.raid-hand-card').first().click();
    await motionPage.locator('.raid-lane-label').first().click();
    await motionPage.getByRole('button',{name:/^PLAY CARD /}).click();
    await motionPage.waitForFunction(count=>window.raidActions.length===count,play+1);
  }
  await motionPage.getByRole('button',{name:'END TURN →'}).click();
  for (const phase of ['windup','strike','recoil','idle']) {
    await motionPage.waitForFunction(expected => {
      const actor=document.querySelector('.raid-cinema-hero .anunaki-motion');
      const image=actor?.querySelector('img');
      return actor?.dataset.anunakiPhase===expected && image?.getAttribute('src')?.includes(`boss-anu-${expected}.webp`) && image.complete && image.naturalWidth>0;
    },phase);
  }
  await motionPage.waitForFunction(() => [...document.querySelectorAll('.raid-police .anunaki-motion img')].some(image => image.complete && image.naturalWidth > 0 && image.dataset.playing === 'true'));
  await motionPage.getByRole('button',{name:'Inspect Anu raid rules'}).click();
  await motionPage.waitForFunction(() => [...document.querySelectorAll('.anunaki-motion img')].every(image => image.dataset.playing === 'false'));
  await motionPage.getByRole('button',{name:'Close',exact:true}).click();
  await motionPage.waitForFunction(() => document.querySelector('.raid-cinema-hero .anunaki-motion img')?.dataset.playing === 'true' && [...document.querySelectorAll('.raid-police .anunaki-motion img')].some(image => image.dataset.playing === 'true'));
  await motionPage.screenshot({path:path.join(output,'raid-animated-cels-phone.png'),fullPage:true});
  report.push({actualCelMediaLoaded:true, nativeBlastCueSources:['windup','strike','recoil','idle'], motionModalPause:true, motionResume:true});
  await motionPage.close();
  await writeFile(path.join(output,'raid-browser-report.json'), JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally { await browser.close(); }
