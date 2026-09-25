import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.GROWTH_ORIGIN ?? 'http://127.0.0.1:4198';
const output = fileURLToPath(new URL('../screenshots/growth-lab/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {});
const report = [];
try {
  for (const [name, width, height, reduced] of [['desktop',1440,960,false],['phone',390,844,false],['small-phone',320,740,true],['landscape',844,390,true]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage(); await page.routeWebSocket('**', () => {});
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
    await page.screenshot({ path: `${output}${name}-before.png` });
    await page.getByRole('button', { name: 'Check in', exact: true }).click();
    if (!reduced) {
      await page.locator('.growth-lab-shell[data-phase="watering"]').waitFor();
      assert.equal(await page.locator('.growth-can').getAttribute('data-pouring'), 'true');
      assert.equal(await page.locator('.growth-rain i').count(), 18);
      assert.equal(await page.locator('.growth-bonus').count(), 0, 'Harvest appears after the new plant grows');
      await page.screenshot({ path: `${output}${name}-watering.png` });
    }
    await page.locator('.growth-bonus').waitFor();
    await page.locator('.growth-lab-shell[data-phase="idle"]').waitFor();
    assert.equal(await page.locator('.growth-plant').count(), 7);
    assert.equal(await page.getByRole('progressbar', {name:'Watering can'}).getAttribute('aria-valuenow'), '0');
    const result = await page.evaluate(() => window.growthFixture.snapshot());
    assert.equal(result.waterCalls, 1);assert.equal(result.status.growth.totalPlants, 7);
    assert.equal(result.receipts.filter(r => r.key.startsWith('growth:garden:')).length, 1);
    assert.equal(result.bootstrap.profile.softCurrency, 900);
    await page.locator('.growth-dialog').evaluate(el => el.scrollTop = 0);
    await page.screenshot({ path: `${output}${name}-garden.png` });
    await page.getByRole('button', { name: 'Close Growth Lab' }).click();assert.equal(await page.locator('dialog[open]').count(), 0);
    await page.getByRole('button', { name: 'Open Buddy’s Growth Lab' }).click();await page.locator('dialog[open]').waitFor();
    await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(), 0);
    await page.reload({ waitUntil: 'domcontentloaded' });await page.locator('.growth-bonus').waitFor();
    const reloaded = await page.evaluate(() => window.growthFixture.snapshot());
    assert.equal(reloaded.waterCalls, 0, 'Reload does not water or pay twice');assert.equal(await page.locator('.growth-plant').count(), 7);
    assert.deepEqual(errors, []);report.push({ name, plants: 7, animation: !reduced, savedAfterReload: true, errors });
    console.log(`${name}: check-in, fill, watering, seven plants, reward, reload and close passed.`);await context.close();
  }
  const partial = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });await partial.routeWebSocket('**', () => {});
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
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });await page.routeWebSocket('**', () => {});
  await page.goto(`${origin}/e2e/growth-lab.fixture.html?plants=0&tasks=2&failure=water&motion=reduce&id=retry-${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', {name:'Check in',exact:true}).click();await page.getByRole('button', {name:'Retry watering'}).waitFor();
  assert.equal(await page.locator('.growth-plant').count(), 0, 'Failed watering cannot display an unearned plant');
  await page.getByRole('button', {name:'Retry watering'}).click();await page.waitForFunction(()=>window.growthFixture.snapshot().status.growth.totalPlants === 1);
  assert.equal((await page.evaluate(()=>window.growthFixture.snapshot())).waterCalls, 2);
  report.push({ retry: 'passed' });console.log('Failure and retry: no premature plant, one saved reward.');
} finally { await browser.close();await writeFile(`${output}verification.json`, JSON.stringify(report, null, 2)); }
