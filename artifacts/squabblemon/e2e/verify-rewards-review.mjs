import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';
const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4245';
const output = process.env.REWARDS_REVIEW_OUTPUT ?? 'screenshots/rewards-review';
await mkdir(output, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {});
const report = [];
async function settledImages(scope) {
  await scope.locator('img').evaluateAll(async images => {
    await Promise.all(images.map(image => image.decode()));
    if (!images.every(image => image.complete && image.naturalWidth > 0)) throw new Error('Review image did not load');
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
async function verifyTracks(scope) {
  const result = await scope.evaluate(el => {
    const contained = (child, parent) => { const r=child.getBoundingClientRect(), p=parent.getBoundingClientRect(); return r.left>=p.left-1 && r.right<=p.right+1 && r.top>=p.top-1 && r.bottom<=p.bottom+1; };
    const monthly = el.querySelector('.monthly-login-track'), weekly = el.querySelector('.account-check-in-calendar');
    const monthlyCells = [...monthly.querySelectorAll('li')];
    const weeklyCells = [...weekly.querySelectorAll('li')];
    return { monthlyCells: monthlyCells.length, weeklyCells: weeklyCells.length,
      monthlyContained: monthlyCells.every(cell=>contained(cell,monthly)),
      monthlyLabelsContained: [...monthly.querySelectorAll('.monthly-login-track__caption b')].every(label=>contained(label,monthly)),
      weeklyContained: weeklyCells.every(cell=>contained(cell,weekly)),
      weeklyAmountsContained: [...weekly.querySelectorAll('.account-check-in-calendar__amount, .account-check-in-calendar__reward')].every(value=>contained(value,value.closest('li'))),
      weeklyJackpot: weeklyCells.at(-1).getAttribute('aria-label'),
      loadedImages: [...el.querySelectorAll('img')].every(image=>image.complete && image.naturalWidth>0),
    };
  });
  assert.equal(result.monthlyCells, 7);assert.equal(result.weeklyCells, 7);
  assert.ok(result.monthlyContained && result.monthlyLabelsContained && result.weeklyContained && result.weeklyAmountsContained && result.loadedImages, JSON.stringify(result));
  assert.match(result.weeklyJackpot, /300 Clout, 2 Pack Tickets, 25 Style Shards/);
  return result;
}
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, reducedMotion: 'reduce' });
  const errors = [], apiRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (new URL(request.url()).pathname.includes('/api/')) apiRequests.push(request.url()); });
  await page.routeWebSocket('**', socket => socket.close());
  await page.goto(`${origin}/e2e/rewards-review.fixture.html`, { waitUntil: 'domcontentloaded' });
  const daily = page.frameLocator('iframe[title^="Daily Drop"]'), growth = page.frameLocator('iframe[title^="Growth Lab"]');
  await expect(daily.locator('.daily-arrival')).toHaveAttribute('open', '');
  await expect(growth.locator('.growth-dialog')).toHaveAttribute('open', '');
  await expect(growth.locator('.growth-plant')).toHaveCount(5);
  await expect(daily.locator('.monthly-login-track li')).toHaveCount(7);
  await expect(growth.locator('.monthly-login-track li')).toHaveCount(7);
  await settledImages(daily.locator('.daily-arrival'));await settledImages(growth.locator('.growth-dialog'));
  await verifyTracks(daily.locator('.daily-arrival'));await verifyTracks(growth.locator('.growth-dialog'));
  await page.screenshot({ path: join(output, 'daily-and-growth-side-by-side.png'), fullPage: true });
  await page.getByRole('button', { name: 'Growth clipboard', exact: true }).click();
  assert.equal(await page.locator('.rewards-review__pane:visible').count(), 1);
  await expect(growth.locator('.growth-dialog')).toHaveAttribute('open', '');
  await page.getByRole('button', { name: 'Daily Drop', exact: true }).click();
  await daily.getByRole('button', { name: 'Collect check-in', exact: true }).click();
  await expect(daily.locator('.daily-arrival')).toHaveAttribute('data-receipt', 'true');
  await expect(daily.locator('.daily-arrival__cards')).toContainText('Super Rare card saved');
  await page.getByRole('button', { name: 'Reset sample', exact: true }).click();
  await expect(daily.locator('.daily-arrival')).toHaveAttribute('open', '');
  await expect(daily.locator('.daily-arrival')).toHaveAttribute('data-receipt', 'false');
  assert.deepEqual(apiRequests, [], 'Local review makes no real API requests and requires no browser route mocks');
  assert.deepEqual(errors, []);
  report.push({ comparison: true, switchable: true, realClaimReceipt: true, reset: true, apiRequests, errors });
  await page.close();
  for (const [name, width, height] of [['desktop',1440,1200],['phone',390,844],['small-phone',320,740]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    const errors = [], apiRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (new URL(request.url()).pathname.includes('/api/')) apiRequests.push(request.url()); });
    await page.routeWebSocket('**', socket => socket.close());
    await page.goto(`${origin}/e2e/rewards-review.fixture.html?surface=growth`, { waitUntil: 'domcontentloaded' });
    const dialog = page.locator('.growth-dialog');
    await expect(dialog).toHaveAttribute('open', '');
    await expect(dialog.locator('.growth-plant')).toHaveCount(5);
    await expect(dialog.locator('.growth-tasks li')).toHaveCount(3);
    await settledImages(dialog);
    const tracks = await verifyTracks(dialog);
    const fit = await dialog.evaluate(el => { const r=el.getBoundingClientRect(); return { inViewport: r.left>=0 && r.top>=0 && r.right<=innerWidth+1 && r.bottom<=innerHeight+1, noHorizontalScroll: el.scrollWidth<=el.clientWidth+1, height: el.clientHeight, scrollHeight: el.scrollHeight }; });
    assert.ok(fit.inViewport && fit.noHorizontalScroll, JSON.stringify(fit));
    await page.screenshot({ path: join(output, `growth-clipboard-${name}.png`) });
    await dialog.evaluate(el => { el.scrollTop = el.scrollHeight; });
    await settledImages(dialog);
    await page.screenshot({ path: join(output, `growth-roadmap-${name}.png`) });
    await dialog.getByRole('button', { name: 'Check in', exact: true }).click();
    await expect(dialog.getByRole('progressbar', { name: 'Watering can' })).toHaveAttribute('aria-valuenow', '67');
    const claimed = await page.evaluate(() => window.rewardsReview.snapshot());
    assert.equal(claimed.claimCalls, 1);assert.equal(claimed.waterCalls, 0);assert.equal(claimed.status.monthly.claimedDays, 20);
    await dialog.getByRole('button', { name: 'Close Growth Lab' }).click();
    await page.getByRole('button', { name: 'Complete sample care tasks', exact: true }).click();
    await page.getByRole('button', { name: 'Open Growth Lab', exact: true }).click();
    await expect(dialog.locator('.growth-plant')).toHaveCount(6);
    const watered = await page.evaluate(() => window.rewardsReview.snapshot());
    assert.equal(watered.waterCalls, 1);assert.equal(watered.status.growth.totalPlants, 6);
    assert.deepEqual(apiRequests, []);assert.deepEqual(errors, []);
    report.push({ name, width, height, fit, tracks, checkIn: true, sampleCare: true, apiRequests, errors });
    await page.close();
  }
  for (const [name,width,height] of [['desktop',1440,1200],['phone',390,844],['small-phone',320,740]]) {
    const page = await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
    await page.routeWebSocket('**', socket=>socket.close());
    await page.goto(`${origin}/e2e/rewards-review.fixture.html?surface=daily`,{waitUntil:'domcontentloaded'});
    const dialog = page.locator('.daily-arrival');await expect(dialog).toHaveAttribute('open','');
    await settledImages(dialog);const tracks = await verifyTracks(dialog);
    await page.screenshot({path:join(output,`daily-drop-${name}.png`)});
    await dialog.evaluate(el=>{el.scrollTop=el.scrollHeight;});
    await settledImages(dialog);await page.screenshot({path:join(output,`daily-roadmap-${name}.png`)});
    report.push({daily:name,width,height,tracks});await page.close();
  }
} finally { await browser.close(); await writeFile(join(output, 'verification.json'), JSON.stringify(report, null, 2)); }
console.log(`PASS: independent local Daily/Growth review, switching, reset, sample claims and 3 clipboard viewports. ${output}`);
