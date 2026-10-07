import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Controlled API responses, real /game Home and optional module requests.
// The origin must run with VITE_E2E_AUTH=true. No production/player claims.
const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4195';
const output = 'screenshots/safehouse-performance';
await mkdir(output, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {});
const report = [];
const names = ['BuddyGrowthLab', 'StarterMythicDialogContent', 'JohnHenryDialogContent'];
const isModule = (url, name) => {
  const file = new URL(url).pathname.split('/').at(-1);
  return file === `${name}.tsx` || (file?.startsWith(`${name}-`) && file.endsWith('.js'));
};
const isOptionalArt = url => /\/assets\/buddy-growth\/(buddy-clipboard|watering-can|plants)\.webp|\/assets\/john-henry-mythic\/roadmap\.webp|\/assets\/starter-mythic\/background\.webp/.test(url);
const chapters = ['block-party', 'red-side-tapes', 'blue-side-blues', 'side-show', 'old-heads-know'];
const account = {
  date: new Date().toISOString().slice(0, 10), streak: 1, claimedToday: false,
  nextResetAt: new Date(Date.now() + 86400000).toISOString(), pending: [],
  growth: { water: 0, ready: false, wateredToday: false, totalPlants: 0, plantsInGarden: 0, gardenNumber: 1, completedGardens: 0,
    tasks: ['login', 'daily-show-up', 'daily-take-room'].map(key => ({ key, complete: false, progress: 0, goal: 1 })) },
};
async function home(viewport, { auto = false, state = 'locked' } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const requests = [], errors = [];
  let phase = state, accountCalls = 0;
  page.on('request', request => requests.push(request.url()));
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ auto }) => {
    localStorage.setItem('squabblemon_e2e_user', 'signed-in');
    if (!auto) for (const phase of ['intro', 'ready']) localStorage.setItem(`squabblemon:starter-mythic:e2e-player:${phase}`, '1');
  }, { auto });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/rewards/starter-mythic')) return route.fulfill({ json: { state: phase, ownsCard: phase === 'claimed', chapters: chapters.map((id, i) => ({ id, reached: phase === 'ready' || i === 0, completed: phase === 'ready' && i < 4 })) } });
    if (path.endsWith('/rewards/john-henry')) return route.fulfill({ json: { state: 'locked', ownsCard: false, chapters: [...chapters, 'the-function', 'return', 'the-crown'].map((id, i) => ({ id, reached: i === 0, completed: false })) } });
    if (path.endsWith('/rewards/account')) { accountCalls++; return route.fulfill({ json: account }); }
    return route.fulfill({ json: path.endsWith('/challenges/runs') || path.endsWith('/events/patches') ? [] : { chapters: [], nodes: [], pending: [], items: [], messages: [], ids: [], state: 'claimed', reward: {} } });
  });
  const start = async (search = '') => {
    await page.goto(`${origin}/game${search}`, { waitUntil: 'domcontentloaded' });
    await page.locator('.safehouse-stage').waitFor();
  };
  const growthTrigger = async () => {
    // Room camera projection is exercised by the dedicated scene journey. The
    // real room marker's action remains available in the static fallback too.
    await page.locator('.safehouse-room-markers:not([hidden])').waitFor({ timeout: 30000 });
    await page.getByRole('button', { name: 'Explore buddy’s plants', exact: true }).click({ force: true });
    return page.getByRole('button', { name: 'Enter Growth Lab', exact: true });
  };
  return { context, page, requests, errors, start, growthTrigger, setPhase: value => { phase = value; }, accountCalls: () => accountCalls };
}
async function loadedImages(page, selector) {
  await page.waitForFunction(selector => [...document.querySelectorAll(`${selector} img`)].every(image => image.complete && image.naturalWidth > 0), selector);
}
try {
  for (const [name, viewport] of [['desktop', { width: 1440, height: 960 }], ['phone', { width: 390, height: 844 }]]) {
    const run = await home(viewport);
    const { page, requests } = run;
    await run.start();
    await page.waitForTimeout(2200);
    assert.equal(requests.some(url => names.some(name => isModule(url, name))), false, 'Cold Home does not request full popup modules');
    assert.equal(requests.some(isOptionalArt), false, 'Cold Home does not request full popup artwork');
    // NotificationProvider keeps its existing lightweight reward observer.
    // Zero Growth module/DOM/art above proves the full lab is not mounted.
    assert.equal(run.accountCalls(), 1, 'Only the existing notification observer requests account status on cold Home');
    assert.equal(await page.locator('.growth-dialog, .starter-mythic-chapters, .john-henry-roadmap__track').count(), 0);
    for (const [moduleName, triggerSelector, contentSelector, dialogSelector] of [
      ['StarterMythicDialogContent', '.starter-mythic-shortcut', '.starter-mythic-chapters', '.starter-mythic-dialog'],
      ['JohnHenryDialogContent', '.john-henry-shortcut', '.john-henry-roadmap__track', '.john-henry-roadmap'],
    ]) {
      const trigger = page.locator(triggerSelector);
      const prewarm = page.waitForResponse(response => isModule(response.url(), moduleName));
      await trigger.hover();
      await prewarm;
      assert.equal(await page.locator(contentSelector).count(), 0, 'Intent imports code without mounting full content');
      assert.equal(requests.some(isOptionalArt), false, 'Intent leaves full artwork cold');
      await trigger.click();
      await page.locator(contentSelector).waitFor({ state: 'visible' });
      await loadedImages(page, dialogSelector);
      await page.locator(contentSelector).evaluate(element => { element.dataset.retained = 'yes'; });
      await page.screenshot({ path: `${output}/popup-${moduleName === 'StarterMythicDialogContent' ? 'starter' : 'john'}-${name}.png` });
      await page.keyboard.press('Escape');
      assert.equal(await page.locator(`${dialogSelector}[open]`).count(), 0);
      assert.ok(await trigger.evaluate(element => document.activeElement === element), 'Focus returns to the actual trigger');
      const count = requests.filter(url => isModule(url, moduleName)).length;
      await trigger.click();
      await page.locator(`${dialogSelector}[open]`).waitFor();
      assert.equal(await page.locator(contentSelector).getAttribute('data-retained'), 'yes', 'Content stays mounted across close/reopen');
      assert.equal(requests.filter(url => isModule(url, moduleName)).length, count, 'Reopening does not import again');
      await page.keyboard.press('Escape');
      // Only artwork for the feature already opened is now expected.
      requests.splice(0);
    }
    const trigger = await run.growthTrigger();
    const prewarm = page.waitForResponse(response => isModule(response.url(), 'BuddyGrowthLab'));
    await trigger.hover();
    await prewarm;
    assert.equal(await page.locator('.growth-dialog').count(), 0);
    assert.equal(requests.some(url => /buddy-growth\/(buddy-clipboard|watering-can|plants)\.webp/.test(url)), false);
    await trigger.click();
    await page.locator('.growth-dialog[open] .growth-task-heading').waitFor();
    await loadedImages(page, '.growth-dialog');
    await page.locator('.growth-lab-shell').evaluate(element => { element.dataset.retained = 'yes'; });
    await page.screenshot({ path: `${output}/popup-growth-${name}.png` });
    await page.getByRole('button', { name: 'Close Growth Lab', exact: true }).click();
    assert.ok(await trigger.evaluate(element => document.activeElement === element));
    await trigger.click();
    await page.locator('.growth-dialog[open]').waitFor();
    assert.equal(await page.locator('.growth-lab-shell').getAttribute('data-retained'), 'yes');
    await page.keyboard.press('Escape');
    assert.deepEqual(run.errors, []);
    report.push({ name, coldModules: 0, coldPopupArt: 0, notificationAccountRequests: 1, codeOnlyIntent: true, retainedReopens: true });
    console.log(`PASS ${name}: cold Home, code-only intent, three popups, retained reopens and focus`);
    await run.context.close();
  }
  const notice = await home({ width: 390, height: 844 });
  await notice.start('?notice=growth');
  await notice.page.locator('.growth-dialog[open] .growth-task-heading').waitFor();
  assert.ok(notice.requests.some(url => isModule(url, 'BuddyGrowthLab')));
  assert.deepEqual(notice.errors, []);
  report.push({ noticeGrowth: true });
  await notice.context.close();

  const auto = await home({ width: 390, height: 844 }, { auto: true });
  await auto.start();
  await auto.page.locator('.starter-mythic-dialog[open] .starter-mythic-chapters').waitFor();
  await auto.page.keyboard.press('Escape');
  await auto.page.reload({ waitUntil: 'domcontentloaded' });
  await auto.page.waitForTimeout(2300);
  assert.equal(await auto.page.locator('.starter-mythic-dialog[open]').count(), 0, 'Intro is shown once');
  auto.setPhase('ready');
  await auto.page.reload({ waitUntil: 'domcontentloaded' });
  await auto.page.getByRole('button', { name: 'Claim your Mythic →', exact: true }).waitFor();
  await auto.page.keyboard.press('Escape');
  auto.setPhase('claimed');
  await auto.page.reload({ waitUntil: 'domcontentloaded' });
  await auto.page.waitForTimeout(2300);
  assert.equal(await auto.page.locator('.starter-mythic-shortcut').count(), 0);
  assert.equal(await auto.page.locator('.starter-mythic-dialog[open]').count(), 0);
  assert.deepEqual(auto.errors, []);
  report.push({ starterAutoIntroAndReady: true, claimedShortcutRetired: true });
  await auto.context.close();

  const handoff = await home({ width: 390, height: 844 });
  let finishImport;
  const handoffGate = new Promise(resolve => { finishImport = resolve; });
  await handoff.page.route(url => isModule(url.href, 'BuddyGrowthLab'), async route => { await handoffGate; await route.continue(); });
  await handoff.start();
  const handoffTrigger = await handoff.growthTrigger();
  await handoffTrigger.click();
  await handoff.page.getByText('Opening the Growth Lab…', { exact: true }).waitFor();
  finishImport();
  await handoff.page.locator('.growth-dialog[open] .growth-task-heading').waitFor();
  await handoff.page.keyboard.press('Escape');
  assert.ok(await handoffTrigger.evaluate(element => document.activeElement === element), 'Async loading hands the original opener to the full dialog');
  assert.deepEqual(handoff.errors, []);
  report.push({ slowSuccessFocusHandoff: true });
  await handoff.context.close();

  const slow = await home({ width: 390, height: 844 });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await slow.page.route(url => isModule(url.href, 'BuddyGrowthLab'), async route => { await gate; await route.continue(); });
  await slow.start();
  const slowTrigger = await slow.growthTrigger();
  await slowTrigger.click();
  await slow.page.getByText('Opening the Growth Lab…', { exact: true }).waitFor();
  await slow.page.keyboard.press('Escape');
  assert.equal(await slow.page.locator('dialog[open]').count(), 0, 'Slow loading can close without trapping the player');
  assert.ok(await slowTrigger.evaluate(element => document.activeElement === element));
  release();
  await slow.page.locator('.growth-dialog').waitFor({ state: 'attached' });
  assert.equal(await slow.page.locator('dialog[open]').count(), 0, 'Late completion does not reopen a cancelled popup');
  await slowTrigger.click();
  await slow.page.locator('.growth-dialog[open] .growth-task-heading').waitFor();
  await slow.page.keyboard.press('Escape');
  assert.ok(await slowTrigger.evaluate(element => document.activeElement === element));
  assert.deepEqual(slow.errors, []);
  report.push({ slowCloseAndLateCompletion: true });
  await slow.context.close();

  const failed = await home({ width: 390, height: 844 });
  let moduleRequests = 0;
  await failed.page.route(url => isModule(url.href, 'BuddyGrowthLab'), route => ++moduleRequests === 1 ? route.abort('failed') : route.continue());
  await failed.start('?notice=growth');
  await failed.page.getByText('Couldn’t open the Growth Lab. Try again.', { exact: true }).waitFor();
  await failed.page.getByRole('button', { name: 'Retry', exact: true }).click();
  await failed.page.locator('.growth-dialog[open] .growth-task-heading').waitFor();
  assert.equal(moduleRequests, 2, 'Retry requests a fresh module URL');
  assert.ok(failed.requests.some(url => isModule(url, 'BuddyGrowthLab') && new URL(url).searchParams.has('popupRetry')));
  assert.deepEqual(failed.errors, []);
  report.push({ failedChunkRetry: true, activePagePreserved: true });
  await failed.context.close();
  console.log('PASS notice open, starter intro/ready, slow close and failed chunk retry');
} finally {
  await browser.close();
  await writeFile(`${output}/popup-loading-verification.json`, JSON.stringify(report, null, 2));
}
