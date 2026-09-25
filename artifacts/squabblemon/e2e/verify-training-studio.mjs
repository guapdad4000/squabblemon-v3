import { chromium, expect } from '@playwright/test';
import { profileBootstrap } from './fighter-id.fixture.ts';
import { planShopPurchase } from '@workspace/squabblemon-engine/economy';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.TRAINING_REVIEW_URL ?? 'http://localhost:4210';
const out = process.env.TRAINING_REVIEW_OUTPUT ?? '/tmp/training-studio-review';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let current = profileBootstrap({ id: 'training-review-player', softCurrency: 5000 });
const requests = [];
let failure = 0;
let gate = null;
await page.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
await page.route('**/api/**', async route => {
  const path = new URL(route.request().url()).pathname;
  if (path.endsWith('/shop/purchases')) {
    const request = route.request().postDataJSON();
    requests.push(request);
    if (gate) await gate;
    if (failure) {
      const status = failure; failure = 0;
      return route.fulfill({ status, json: { error: 'Training could not be confirmed.' } });
    }
    const planned = planShopPurchase(current.profile, request);
    current = { ...current, profile: { ...current.profile, ...planned.wallet } };
    return route.fulfill({ json: { receipt: planned.receipt, bootstrap: current } });
  }
  const json = path.endsWith('/bootstrap') ? current
    : path.endsWith('/mail') ? { messages: [] }
    : path.endsWith('/account') ? { pending: [], growth: { ready: false, tasks: [], totalPlants: 0 } }
    : path.endsWith('/starter-mythic') ? { state: 'claimed', chapters: [] } : null;
  return route.fulfill(json ? { json } : { status: 503, json: { error: 'Isolated training review' } });
});
const checkout = page.locator('.market-checkout');
const action = checkout.locator(':scope > button.studio-action');
const session = page.locator('.training-session');
const select = name => page.getByRole('navigation', { name: 'Shop items' }).getByRole('button', { name }).click();
const report = { layouts: [], requests: 0, checks: [] };
try {
  await page.goto(`${base}/game/shop?view=training`, { waitUntil: 'domcontentloaded' });
  await expect(checkout).toBeVisible();
  await page.evaluate(() => Promise.all([...document.images].map(img => img.decode().catch(() => {}))));
  for (const [name, width, height] of [['desktop', 1440, 900], ['phone', 390, 844], ['small-phone', 320, 740], ['landscape', 844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.locator('.market').evaluate(el => el.scrollTop = 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const size = await page.locator('.market').evaluate(el => ({ height: el.scrollHeight, viewport: el.clientHeight }));
    const art = page.locator('.market-offer-art').first();
    await expect(art).toHaveCSS('opacity', '1');
    await expect(art).toHaveCSS('mix-blend-mode', 'normal');
    await expect(art).toHaveJSProperty('naturalWidth', 256);
    await page.screenshot({ path: `${out}/${name}.png` });
    await action.scrollIntoViewIfNeeded();
    expect((await action.boundingBox()).width).toBeGreaterThan(180);
    report.layouts.push({ name, ...size });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  let start = Date.now();
  await action.click();
  await expect(session).toBeVisible();
  await expect(action).toBeDisabled();
  await action.evaluate(button => { button.click(); button.click(); });
  await expect(checkout.locator('.market-receipt')).toHaveCount(0);
  await expect(page.getByText('An earlier purchase needs confirmation.', { exact: false })).toHaveCount(0);
  await session.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/quick-training.png` });
  const sprite = session.locator('.training-session__sprite');
  const frameA = await sprite.evaluate(el => getComputedStyle(el).backgroundPosition);
  await page.waitForTimeout(200);
  expect(await sprite.evaluate(el => getComputedStyle(el).backgroundPosition)).not.toBe(frameA);
  await expect(checkout.getByText('Reps complete!', { exact: true })).toBeVisible();
  expect(Date.now() - start).toBeGreaterThanOrEqual(2300);
  expect(requests).toHaveLength(1);
  expect(current.profile.cardProgression.kyle.xp).toBe(100);
  expect(current.profile.softCurrency).toBe(4900);
  report.checks.push('Quick training animates before confirmed XP; repeated taps create one request.');

  await select('Move Training');
  await action.click();
  await expect(session.locator('.training-session__sprite--moves')).toBeVisible();
  await page.screenshot({ path: `${out}/move-training.png` });
  await expect(checkout.getByText('New move learned!', { exact: true })).toBeVisible();
  expect(current.profile.cardProgression.kyle.moveTier).toBe(1);
  report.checks.push('Move training plays the boxing sheet and unlocks the eligible move.');

  await select('Intensive Training');
  failure = 503;
  await action.click();
  await expect(checkout.getByRole('alert')).toContainText('Purchase not confirmed');
  await expect(session).toHaveCount(0);
  await expect(checkout.locator('.market-receipt')).toHaveCount(0);
  await expect(action).toHaveText(/Recover purchase/);
  const failedRequest = requests.at(-1);
  const beforeRetry = current.profile.softCurrency;
  await action.click();
  await expect(checkout.getByText('Reps complete!', { exact: true })).toBeVisible();
  expect(requests.at(-1).idempotencyKey).toBe(failedRequest.idempotencyKey);
  expect(current.profile.softCurrency).toBe(beforeRetry - 225);
  report.checks.push('Unconfirmed training has no success and retry reuses the purchase key.');

  failure = 400;
  await action.click();
  await expect(checkout.getByRole('alert')).toContainText('Training could not be confirmed');
  await expect(action).toHaveText(/Train ·/);
  await expect(session).toHaveCount(0);
  report.checks.push('Rejected training clears the pending request and unlocks the controls.');

  let release;
  gate = new Promise(resolve => { release = resolve; });
  await action.click();
  await expect(session).toBeVisible();
  await page.waitForTimeout(2600);
  await expect(session).toBeVisible();
  await expect(checkout.locator('.market-receipt')).toHaveCount(0);
  release(); gate = null;
  await expect(checkout.getByText('Reps complete!', { exact: true })).toBeVisible();
  report.checks.push('Slow server responses cannot reveal success before confirmation.');

  for (const mode of ['profile', 'system']) {
    current.profile.settings.reducedMotion = mode === 'profile';
    await page.emulateMedia({ reducedMotion: mode === 'system' ? 'reduce' : 'no-preference' });
    await page.reload();
    await expect(checkout).toBeVisible();
    gate = new Promise(resolve => { release = resolve; });
    await action.click();
    await expect(session).toHaveAttribute('data-reduced-motion', 'true');
    await expect(session.locator('.training-session__sprite')).toHaveCSS('animation-name', 'none');
    start = Date.now(); release(); gate = null;
    await expect(checkout.getByText('Reps complete!', { exact: true })).toBeVisible({ timeout: 1500 });
    expect(Date.now() - start).toBeLessThan(1500);
    report.checks.push(`${mode} reduced motion uses a static pose and skips the presentation delay.`);
  }
  expect(errors).toEqual([]);
  report.requests = requests.length;
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await page.screenshot({ path: `${out}/last.png` }).catch(() => {});
  await browser.close();
}
