import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { johnChapterIds, mythicStatus, popupApiResponse } from './popup-test-responses.mjs';
const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4195';
const output = 'screenshots/safehouse-performance';
await mkdir(output, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {});
const report = [];
try {
  for (const [name, viewport, state, owns] of [
    ['desktop-ready', { width: 1440, height: 960 }, 'ready', false],
    ['phone-locked', { width: 390, height: 844 }, 'locked', false],
    ['phone-duplicate', { width: 390, height: 844 }, 'ready', true],
    ['phone-collected', { width: 390, height: 844 }, 'claimed', true],
  ]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let saved = false, posts = 0;
    const status = () => mythicStatus(saved ? 'claimed' : state, johnChapterIds, owns);
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/john-henry/claim')) {
        posts++; saved = true;
        const bootstrap = await page.evaluate(() => window.deferredPopupFixture.bootstrap());
        bootstrap.profile.softCurrency += 1500;
        bootstrap.profile.packTickets += 5;
        if (owns) bootstrap.profile.styleShards += 50; else bootstrap.profile.ownedCardIds.push('john-henry');
        await new Promise(resolve => setTimeout(resolve, 150));
        return route.fulfill({ json: { claimed: true, duplicateShards: owns ? 50 : 0, status: status(), bootstrap } });
      }
      return route.fulfill({ json: path.endsWith('/john-henry') ? status() : popupApiResponse(path) });
    });
    await page.goto(`${origin}/e2e/deferred-popups.fixture.html?john=banner${state === 'ready' && !owns ? '&mythic=john-henry' : ''}`, { waitUntil: 'domcontentloaded' });
    const trigger = page.locator('.john-henry-banner');
    await trigger.waitFor();
    const dialog = page.locator('.john-henry-roadmap');
    if (state !== 'ready' || owns) await trigger.click();
    await page.locator('.john-henry-roadmap[open] .john-henry-roadmap__track li').last().waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.john-henry-roadmap img')].every(image => image.complete && image.naturalWidth > 0));
    await dialog.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    assert.equal(await page.locator('.john-henry-roadmap__track li').count(), 8);
    assert.ok(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1));
    const bounds = await dialog.boundingBox();
    assert.ok(Math.abs(bounds.x + bounds.width / 2 - viewport.width / 2) < 2, 'Roadmap remains centered');
    await page.screenshot({ path: `${output}/john-claim-${name}.png` });
    if (state === 'locked') {
      assert.equal(await dialog.getByRole('button', { name: 'Claim John Henry →', exact: true }).count(), 0);
      await dialog.getByRole('link', { name: 'Keep building your legend →', exact: true }).waitFor();
    } else if (state === 'ready') {
      const claim = dialog.getByRole('button', { name: 'Claim John Henry →', exact: true });
      await claim.evaluate(button => { button.click(); button.click(); });
      await page.locator('.character-recruitment[data-character="john-henry"]').waitFor();
      assert.equal(posts, 1, 'Repeated input submits one claim');
      const bootstrap = await page.evaluate(() => window.deferredPopupFixture.bootstrap());
      assert.equal(bootstrap.profile.softCurrency, 1750);
      assert.equal(bootstrap.profile.packTickets, 5);
      assert.equal(bootstrap.profile.styleShards, owns ? 350 : 300);
      if (!owns) assert.ok(bootstrap.profile.ownedCardIds.includes('john-henry'));
      const celebration=page.locator('.character-recruitment');
      await celebration.waitFor({state:'visible'});
      assert.equal((await celebration.locator('h2').textContent()).trim(),'John Henry');
      if(owns)assert.ok((await celebration.innerText()).includes('+50'));
      await celebration.getByRole('button',{name:'Keep going',exact:true}).click();
    } else await dialog.getByRole('link', { name: 'Meet John Henry →', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    // A query-opened dialog has no clicked opener; explicit banner opens do.
    if (!(state === 'ready' && !owns)) assert.ok(await trigger.evaluate(element => document.activeElement === element));
    await trigger.click();
    await page.locator('.john-henry-roadmap[open] .john-henry-roadmap__track').waitFor();
    assert.equal(posts, state === 'ready' ? 1 : 0, 'Reopening cannot repay the reward');
    assert.deepEqual(errors, []);
    report.push({ name, state, owns, posts, decode: true, centered: true });
    console.log(`PASS John Henry ${name}: eight chapters, eligibility, decode, claim and reopen`);
    await page.close();
  }
  const retry = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = [];
  retry.on('pageerror', error => errors.push(error.message));
  let reads = 0, posts = 0;
  await retry.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/john-henry/claim')) {
      if (++posts === 1) return route.fulfill({ status: 503, json: { error: 'Temporary claim failure' } });
      const bootstrap = await retry.evaluate(() => window.deferredPopupFixture.bootstrap());
      return route.fulfill({ json: { claimed: false, duplicateShards: 0, status: mythicStatus('claimed', johnChapterIds), bootstrap } });
    }
    if (path.endsWith('/john-henry')) return ++reads <= 2 ? route.fulfill({ status: 503, json: { error: 'Temporary roadmap failure' } }) : route.fulfill({ json: mythicStatus('ready', johnChapterIds) });
    return route.fulfill({ json: popupApiResponse(path) });
  });
  await retry.goto(`${origin}/e2e/deferred-popups.fixture.html?john=banner&mythic=john-henry`, { waitUntil: 'domcontentloaded' });
  const dialog = retry.locator('.john-henry-roadmap[open]');
  await dialog.getByRole('button', { name: 'Retry', exact: true }).click();
  await dialog.getByRole('button', { name: 'Claim John Henry →', exact: true }).click();
  await dialog.getByRole('alert').waitFor();
  await dialog.getByRole('button', { name: 'Claim John Henry →', exact: true }).click();
  await dialog.locator('.john-henry-roadmap__success').filter({ hasText: 'Already collected' }).waitFor();
  assert.equal(posts, 2);
  assert.deepEqual(errors, []);
  report.push({ johnStatusRetry: true, failedClaimRetry: true, savedClaimRecovery: true, posts });
  console.log('PASS John Henry API loading retry, failed claim and saved-claim recovery');
  await retry.close();
} finally {
  await browser.close();
  await writeFile(`${output}/john-claim-verification.json`, JSON.stringify(report, null, 2));
}
