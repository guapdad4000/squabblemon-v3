import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.GROWTH_ORIGIN ?? 'http://127.0.0.1:4198';
const output = process.env.GROWTH_OUTPUT ?? fileURLToPath(new URL('../screenshots/growth-lab/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {});
const report = [];
try {
  for (const [name, width, height, reduced] of [['desktop',1440,960,false],['phone',390,844,false],['small-phone',320,740,true],['landscape',844,390,true]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage(); await page.routeWebSocket('**', socket => socket.close());
    const errors = [];page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${origin}/e2e/growth-lab.fixture.html?plants=6&tasks=2&id=${name}-${Date.now()}${reduced ? '&motion=reduce' : ''}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Check in', exact: true }).waitFor();
    await page.waitForFunction(() => [...document.images].every(i => i.complete));
    assert.equal(await page.locator('.growth-plant').count(), 6);
    assert.equal(await page.getByRole('progressbar', {name:'Watering can'}).getAttribute('aria-valuenow'), '67');
    const dimensions = await page.locator('.growth-dialog').evaluate(el => el.getBoundingClientRect().toJSON());
    assert.ok(dimensions.x >= 0 && dimensions.right <= width + 1, 'Dialog fits viewport');
    for (const row of await page.locator('.growth-tasks li').all()) {
      const r = await row.boundingBox();assert.ok(r.x >= 0 && r.x + r.width <= width + 1);
    }
    assert.equal(await page.locator('.account-check-in-calendar li').count(), 7);
    assert.equal(await page.locator('.growth-dialog details').count(), 0, 'Calendar is visible without a disclosure');
    assert.match(await page.locator('.account-check-in-calendar li').nth(6).getAttribute('aria-label'), /300 Clout, 2 Pack Tickets, 25 Style Shards/);
    assert.equal(await page.locator('.growth-next-reward').count(), 1);
    const layout = await page.locator('.growth-dialog').evaluate(el => ({ height: el.clientHeight, scrollHeight: el.scrollHeight }));
    const monthlyHeight = (await page.locator('.monthly-login-track').boundingBox())?.height ?? 0;
    if (height >= 740) {
      assert.ok(monthlyHeight <= 170, 'All seven monthly tiers stay compact');
      assert.ok(layout.scrollHeight - monthlyHeight <= height + 1, `Original care sheet still fits, with only the explicit monthly track adding scroll: ${JSON.stringify(layout)}`);
    }
    for (const reward of await page.locator('.account-check-in-calendar__reward').all()) {
      const visible = await reward.evaluate(el => { const r=el.getBoundingClientRect(), cell=el.parentElement.getBoundingClientRect();return r.left >= cell.left - 1 && r.right <= cell.right + 1; });
      assert.ok(visible, 'All reward values fit their calendar cells');
    }
    await page.screenshot({ path: join(output, `${name}-before.png`) });
    await page.getByRole('button', { name: 'Check in', exact: true }).click();
    if (!reduced) {
      await page.locator('.growth-lab-shell[data-phase="watering"]').waitFor();
      assert.equal(await page.locator('.growth-can').getAttribute('data-pouring'), 'true');
      assert.equal(await page.locator('.growth-rain i').count(), 18);
      assert.equal(await page.locator('.growth-bonus').count(), 0, 'Harvest appears after the new plant grows');
      await page.screenshot({ path: join(output, `${name}-watering.png`) });
    }
    await page.locator('.growth-bonus').waitFor();
    await page.locator('.growth-lab-shell[data-phase="idle"]').waitFor();
    assert.equal(await page.locator('.growth-plant').count(), 7);
    for (const plant of await page.locator('.growth-plant').all()) {
      const fits = await plant.evaluate(el => { const r=el.getBoundingClientRect(),dialog=el.closest('dialog'),d=dialog.getBoundingClientRect();return {left:r.left-d.left,right:r.right-d.right,top:r.top-d.top+dialog.scrollTop,bottom:r.bottom-d.top+dialog.scrollTop-dialog.scrollHeight}; });
      assert.ok(fits.left>=-1 && fits.right<=1 && fits.top>=-1 && fits.bottom<=1, `All seven plant artworks remain inside the scroll perimeter: ${JSON.stringify(fits)}`);
    }
    assert.equal(await page.getByRole('progressbar', {name:'Watering can'}).getAttribute('aria-valuenow'), '0');
    const result = await page.evaluate(() => window.growthFixture.snapshot());
    assert.equal(result.waterCalls, 1);assert.equal(result.status.growth.totalPlants, 7);
    assert.equal(result.receipts.filter(r => r.key.startsWith('growth:garden:')).length, 1);
    assert.equal(result.bootstrap.profile.softCurrency, 900);
    await page.locator('.growth-bonus').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {}))));
    await page.locator('.growth-dialog').evaluate(el => el.scrollTop = 0);
    await page.screenshot({ path: join(output, `${name}-garden.png`) });
    await page.getByRole('button', { name: 'Close Growth Lab' }).click();assert.equal(await page.locator('dialog[open]').count(), 0);
    await page.getByRole('button', { name: 'Open Buddy’s Growth Lab' }).click();await page.locator('dialog[open]').waitFor();
    await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(), 0);
    await page.reload({ waitUntil: 'domcontentloaded' });await page.locator('.growth-task-heading').getByText('WATERED', { exact: true }).waitFor();
    const reloaded = await page.evaluate(() => window.growthFixture.snapshot());
    assert.equal(reloaded.waterCalls, 0, 'Reload does not water or pay twice');assert.equal(await page.locator('.growth-plant').count(), 7);
    assert.deepEqual(errors, []);report.push({ name, plants: 7, animation: !reduced, savedAfterReload: true, layout, calendarAlwaysExpanded: true, errors });
    console.log(`${name}: check-in, fill, watering, seven plants, reward, reload and close passed.`);await context.close();
  }
  const partial = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });await partial.routeWebSocket('**', socket => socket.close());
  await partial.goto(`${origin}/e2e/growth-lab.fixture.html?tasks=0&motion=reduce&id=partial-${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await partial.getByRole('button', { name: 'Check in', exact: true }).waitFor();
  assert.equal(await partial.getByRole('progressbar', { name: 'Watering can' }).getAttribute('aria-valuenow'), '0');
  await partial.getByRole('button', { name: 'Check in', exact: true }).click();
  await partial.waitForFunction(() => document.querySelector('[role=progressbar]').getAttribute('aria-valuenow') === '33');
  assert.equal((await partial.evaluate(() => window.growthFixture.snapshot())).waterCalls, 0, 'A partial can does not water early');
  await partial.evaluate(() => window.growthFixture.completeTasks());
  await partial.waitForFunction(() => window.growthFixture.snapshot().status.growth.totalPlants === 1);
  assert.equal((await partial.evaluate(() => window.growthFixture.snapshot())).waterCalls, 1);
  report.push({ partialProgress: '0 to 33 to full to watered' });console.log('Partial progress: check-in fills one third; verified tasks finish the can.');
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });await page.routeWebSocket('**', socket => socket.close());
  await page.goto(`${origin}/e2e/growth-lab.fixture.html?plants=0&tasks=2&failure=water&motion=reduce&id=retry-${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', {name:'Check in',exact:true}).click();await page.locator('.growth-error button').waitFor();
  assert.equal(await page.locator('.growth-plant').count(), 0, 'Failed watering cannot display an unearned plant');
  await page.locator('.growth-error button').click();await page.waitForFunction(()=>window.growthFixture.snapshot().status.growth.totalPlants === 1);
  assert.equal((await page.evaluate(()=>window.growthFixture.snapshot())).waterCalls, 2);
  report.push({ retry: 'passed' });console.log('Failure and retry: no premature plant, one saved reward.');
  await partial.close(); await page.close();
  const recruit = await browser.newPage({ viewport: { width: 320, height: 740 }, reducedMotion: 'reduce' });
  await recruit.routeWebSocket('**', socket => socket.close());
  await recruit.goto(`${origin}/e2e/growth-lab.fixture.html?plants=20&tasks=2&motion=reduce&id=recruit-${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await recruit.getByRole('button', {name:'Check in',exact:true}).waitFor();
  assert.match(await recruit.locator('.growth-next-reward').innerText(), /1 plant to go · BUDDY joins/);
  await recruit.getByRole('button', {name:'Check in',exact:true}).click();
  await recruit.locator('.character-recruitment[data-character=buddy]').waitFor();
  await recruit.getByRole('button', {name:'Keep going',exact:true}).click();
  const saved = await recruit.evaluate(()=>window.growthFixture.snapshot());
  assert.equal(saved.status.growth.completedGardens, 3);
  assert.ok(saved.bootstrap.profile.ownedCardIds.includes('buddy'));
  assert.equal(saved.receipts.filter(r=>r.key==='growth:buddy').length, 1);
  assert.match(await recruit.locator('.growth-next-reward').innerText(), /7 plants to go/);
  assert.doesNotMatch(await recruit.locator('.growth-next-reward').innerText(), /BUDDY joins/);
  report.push({ thirdGarden: 'Buddy recruitment and next harvest retained' });
  await recruit.close();
} finally { await browser.close();await writeFile(join(output, 'growth-verification.json'), JSON.stringify(report, null, 2)); }
