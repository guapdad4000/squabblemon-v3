import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
const videos = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (/\.mp4(?:\?|$)/.test(request.url())) videos.push(request.url()); });
await page.goto('http://127.0.0.1:4186/story-studio');
await page.locator('.story-stage__line').waitFor();
await page.evaluate(() => Promise.all(Array.from(document.images).map(image => image.decode().catch(() => {}))));
await page.waitForTimeout(700);
fs.mkdirSync('screenshots', { recursive: true });
await page.screenshot({ path: 'screenshots/chapter-one-2d-desktop.png' });
assert.match(await page.locator('.story-stage__line').innerText(), /three dollars/);
await page.getByRole('button', { name: 'Next →', exact: true }).click();
assert.match(await page.locator('.story-stage__line').innerText(), /Who you with/);
await page.getByRole('button', { name: 'Transcript', exact: true }).click();
assert.match(await page.getByRole('dialog').innerText(), /three dollars/);
await page.getByRole('button', { name: 'Close transcript' }).click();
await page.getByRole('button', { name: 'Skip scene' }).click();
assert.match(await page.getByRole('dialog').innerText(), /real card battle/);
await page.getByRole('button', { name: 'Preview next scene →' }).click();
assert.match(await page.locator('.story-stage__line').innerText(), /You got a slot/);
const count = await page.getByLabel('Select scene').locator('option').count();
assert.equal(count, 15);
for (let i = 0; i < count; i++) {
  await page.getByLabel('Select scene').selectOption(String(i));
  const paths = await page.locator('.story-stage img').evaluateAll(images => images.map(image => image.src));
  const background = await page.locator('.story-stage__world').evaluate(el => getComputedStyle(el).backgroundImage.match(/url\("?([^"\)]+)/)[1]);
  for (const path of [...paths, background]) assert.equal((await page.request.get(path)).status(), 200, path);
  assert.ok((await page.locator('.story-stage__line').innerText()).length > 10);
}
await page.getByLabel('Select scene').selectOption('14');
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => Promise.all(Array.from(document.images).map(image => image.decode().catch(() => {}))));
await page.waitForTimeout(700);
await page.screenshot({ path: 'screenshots/chapter-one-2d-phone.png' });
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
await page.emulateMedia({ reducedMotion: 'reduce' });
assert.equal(await page.locator('.story-stage__world').evaluate(el => getComputedStyle(el).animationName), 'none');
assert.equal(videos.length, 0, '2D chapter requested video');
assert.deepEqual(errors, []);
for (const chapterId of ['red-side-tapes', 'blue-side-blues', 'side-show', 'old-heads-know', 'the-function', 'return-of-the-block', 'the-crown']) {
  await page.getByLabel('Select chapter').selectOption(chapterId);
  const sceneOptions = await page.getByLabel('Select scene').locator('option').count();
  assert.ok(sceneOptions >= 4, `${chapterId} has no playable scenes`);
  await page.getByLabel('Select scene').selectOption(String(sceneOptions - 1));
  assert.ok((await page.locator('.story-stage__line').innerText()).length > 10, `${chapterId} has empty dialogue`);
  if (chapterId === 'red-side-tapes' || chapterId === 'return-of-the-block' || chapterId === 'the-crown') {
    await page.screenshot({ path: `screenshots/${chapterId}-2d-phone.png` });
  }
  const background = await page.locator('.story-stage__world').evaluate(el => getComputedStyle(el).backgroundImage.match(/url\("?([^"\)]+)/)[1]);
  assert.equal((await page.request.get(background)).status(), 200, `${chapterId} is missing its stage background`);
  if (chapterId === 'the-crown') {
    await page.getByRole('button', { name: 'Skip scene' }).click();
    assert.match(await page.getByRole('dialog').innerText(), /Season One complete/);
  }
}
assert.deepEqual(errors, []);
// Exercise the actual campaign overlay with a controlled API, including failures and old saves.
const progress = { nodeId: 'welcome-to-the-block', cleared: false, stars: 0, dialogueSeen: ['welcome-to-the-block:pre:0'] };
const campaign = { nodes: [progress], chapters: [], contentVersion: 3 };
let failNext = true;
const saves = [];
await page.route('**/api/player/story', route => route.fulfill({ json: campaign }));
await page.route('**/api/player/story/nodes/welcome-to-the-block/dialogue', async route => {
  const body = route.request().postDataJSON();
  saves.push(body.dialogueSeen);
  await new Promise(resolve => setTimeout(resolve, 180));
  if (failNext) { failNext = false; return route.fulfill({ status: 503, json: { error: 'Offline' } }); }
  progress.dialogueSeen = [...new Set([...progress.dialogueSeen, ...body.dialogueSeen])];
  return route.fulfill({ json: { campaign, rewards: [] } });
});
await page.goto('http://127.0.0.1:4186/e2e/story-stage.fixture.html');
await page.locator('.story-stage__line').waitFor();
assert.match(await page.locator('.story-stage__line').innerText(), /three dollars/, 'Legacy token skipped new screenplay');
await page.getByRole('button', { name: 'Next →', exact: true }).click();
await page.getByRole('alert').waitFor();
assert.match(await page.locator('.story-stage__line').innerText(), /three dollars/, 'Failed save advanced dialogue');
await page.getByRole('button', { name: 'Next →', exact: true }).evaluate(button => { button.click(); button.click(); });
await page.waitForFunction(() => document.querySelector('.story-stage__line')?.textContent.includes('Who you with'));
assert.equal(saves.length, 2, 'Double click duplicated save');
await page.getByRole('button', { name: 'Next →', exact: true }).click();
await page.waitForFunction(() => document.querySelector('.story-stage__line')?.textContent.includes('unseasoned'));
assert.equal(saves.at(-1)[0], 'welcome-to-the-block:script-v3:pre:1');
await page.reload();
await page.waitForFunction(() => document.querySelector('.story-stage__line')?.textContent.includes('unseasoned'));
await page.getByRole('button', { name: 'Skip scene' }).click();
await page.getByRole('button', { name: 'Engage Target' }).waitFor();
const saveCountBeforeReplay = saves.length;
await page.getByRole('button', { name: 'Replay scenes' }).click();
assert.match(await page.locator('.story-stage__line').innerText(), /three dollars/);
await page.getByRole('button', { name: 'Next →', exact: true }).click();
await page.getByRole('button', { name: 'Skip scene' }).click();
assert.equal(saves.length, saveCountBeforeReplay, 'Replay changed campaign progress');
assert.equal(progress.dialogueSeen.filter(token => token.includes('script-v3:pre')).length, 8);
assert.equal(progress.dialogueSeen.some(token => token.includes(':post:')), false, 'Unlocked aftermath without a win');
await page.getByRole('button', { name: 'Engage Target' }).click();
assert.equal(await page.title(), 'Real battle route requested');
progress.cleared = true;
await page.reload();
await page.waitForFunction(() => document.querySelector('.story-stage__line')?.textContent.includes('You got a slot'));
assert.deepEqual(errors, []);
console.log(JSON.stringify({ scenes: count, errors, videoRequests: videos.length, desktopAndPhone: 'passed', reducedMotion: 'passed', campaign: 'failed save, double click, resume, skip, fight callback, win gating passed' }));
await browser.close();
