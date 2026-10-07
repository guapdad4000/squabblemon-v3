import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { popupApiResponse } from './popup-test-responses.mjs';

const origin = process.env.POPUP_PRODUCTION_ORIGIN ?? 'http://127.0.0.1:4327';
const buildRoot = process.env.POPUP_PRODUCTION_DIR ?? '/tmp/squabblemon-deferred-popups-production';
const publicRoot = path.resolve('public');
const output = 'screenshots/safehouse-performance';
const features = [
  { name: 'BuddyGrowthLab', exportName: 'BuddyGrowthLab', trigger: 'button', dialog: '.growth-dialog', content: '.growth-task-heading', failed: 'Couldn’t open the Growth Lab. Try again.' },
  { name: 'StarterMythicDialogContent', exportName: 'StarterMythicDialogContent', trigger: '.starter-mythic-shortcut', dialog: '.starter-mythic-dialog', content: '.starter-mythic-chapters', failed: 'Couldn’t open the roadmap. Try again.' },
  { name: 'JohnHenryDialogContent', exportName: 'JohnHenryDialogContent', trigger: '.john-henry-shortcut', dialog: '.john-henry-roadmap', content: '.john-henry-roadmap__track', failed: 'Couldn’t open the roadmap. Try again.' },
];
const bundle = JSON.parse(await readFile(path.join(buildRoot, 'bundle-budget-report.json'), 'utf8'));
for (const feature of features) {
  const chunk = bundle.chunks.find(chunk => chunk.facadeModuleId?.endsWith(`/${feature.name}.tsx`));
  assert.ok(chunk, `Built feature chunk exists for ${feature.name}`);
  feature.file = `/${chunk.fileName}`;
  feature.url = origin + feature.file;
}
await mkdir(output, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {});
const report = [];
async function runPage() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const requests = [], errors = [];
  let documents = 0;
  page.on('request', request => { requests.push(request.url()); if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => route.fulfill({ json: popupApiResponse(new URL(route.request().url()).pathname) }));
  // Keep this build small while decoding the original production artwork. JS
  // chunks and CSS are served directly by Vite preview, without interception.
  await page.route(/\/(?:assets|fonts)\/.*\.(?:webp|png|jpg|jpeg|woff2?|mp3|wav)(?:\?.*)?$/, async route => {
    const relative = new URL(route.request().url()).pathname.replace(/^\/+/, '');
    const file = path.resolve(publicRoot, relative);
    if (!file.startsWith(publicRoot + path.sep)) return route.abort();
    try {
      const body = await readFile(file);
      const extension = path.extname(file);
      const contentType = extension === '.webp' ? 'image/webp' : extension === '.png' ? 'image/png' : /jpe?g/.test(extension) ? 'image/jpeg' : extension === '.woff2' ? 'font/woff2' : extension === '.woff' ? 'font/woff' : extension === '.mp3' ? 'audio/mpeg' : 'audio/wav';
      await route.fulfill({ body, contentType });
    } catch { await route.continue(); }
  });
  const start = () => page.goto(`${origin}/e2e/deferred-popups.fixture.html`, { waitUntil: 'domcontentloaded' });
  return { context, page, requests, errors, start, documents: () => documents };
}
try {
  const namespace = await runPage();
  await namespace.start();
  await namespace.page.getByRole('button', { name: 'Open Growth Lab', exact: true }).waitFor();
  assert.equal(namespace.requests.some(url => features.some(feature => new URL(url).pathname === feature.file)), false, 'Production fixture initially loads only the controllers');
  for (const feature of features) {
    const exports = await namespace.page.evaluate(async url => Object.keys(await import(url)), feature.url);
    assert.ok(exports.includes(feature.exportName), `Production namespace preserves ${feature.exportName}`);
    report.push({ namespace: feature.name, exports });
  }
  assert.deepEqual(namespace.errors, []);
  await namespace.context.close();

  for (const feature of features) {
    const run = await runPage();
    let featureRequests = 0;
    await run.page.route(url => url.pathname === feature.file, route => ++featureRequests === 1 ? route.abort('failed') : route.continue());
    await run.start();
    const trigger = feature.name === 'BuddyGrowthLab' ? run.page.getByRole('button', { name: 'Open Growth Lab', exact: true }) : run.page.locator(feature.trigger);
    await trigger.waitFor();
    // Isolate the opening request from hover/focus prewarm so the injected
    // entry failure reaches the visible retry UI deterministically.
    await trigger.evaluate(element => element.click());
    await run.page.getByText(feature.failed, { exact: true }).waitFor();
    assert.equal(run.documents(), 1, 'A failed optional feature leaves the active document intact');
    await run.page.locator('dialog[open]').getByRole('button', { name: 'Retry', exact: true }).click();
    await run.page.locator(`${feature.dialog}[open] ${feature.content}`).waitFor();
    await run.page.waitForFunction(selector => [...document.querySelectorAll(`${selector} img`)].every(image => image.complete && image.naturalWidth > 0), feature.dialog);
    assert.equal(featureRequests, 2);
    assert.ok(run.requests.some(url => new URL(url).pathname === feature.file && new URL(url).searchParams.has('popupRetry')));
    await run.page.screenshot({ path: `${output}/production-retry-${feature.name}.png` });
    await run.page.keyboard.press('Escape');
    await run.page.locator(`${feature.dialog}[open]`).waitFor({ state: 'detached' });
    await trigger.click();
    await run.page.locator(`${feature.dialog}[open] ${feature.content}`).waitFor();
    assert.equal(featureRequests, 2, 'Later opening retains the recovered component');
    assert.equal(run.documents(), 1, 'Retry and reopen never reload the game');
    assert.deepEqual(run.errors, []);
    const preloadErrors = await run.page.evaluate(() => window.deferredPopupFixture.preloadErrors());
    report.push({ feature: feature.name, compiledRetry: true, featureRequests, documents: run.documents(), preloadErrors });
    console.log(`PASS compiled ${feature.name}: namespace export, failed entry, fresh-query retry and retained reopen`);
    await run.context.close();
  }
} finally {
  await browser.close();
  await writeFile(`${output}/production-popup-verification.json`, JSON.stringify(report, null, 2));
}
