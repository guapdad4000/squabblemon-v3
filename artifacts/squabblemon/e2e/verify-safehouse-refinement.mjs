import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { profileBootstrap } from './fighter-id.fixture.ts';
import { mythicStatus, starterChapterIds, johnChapterIds, accountStatus } from './popup-test-responses.mjs';
const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4245';
const output = process.env.REVIEW_OUTPUT ?? '/tmp/safehouse-refinement';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE ?? '/usr/bin/google-chrome', args: ['--enable-unsafe-swiftshader'] });
const report = [];
try {
  for (const [width, height] of (process.env.SAFEHOUSE_VIEWPORT ? [process.env.SAFEHOUSE_VIEWPORT.split('x').map(Number)] : [[1440, 1000], [390, 844], [320, 568], [844, 390]])) {
    const page = await browser.newPage({ viewport: { width, height } }); page.setDefaultTimeout(20000);
    const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error(error.message); }); page.on('console', message => { if(message.type() === 'error' && !message.text().includes('[vite]')) { console.error(message.text()); if(message.text().includes('TypeError:') || message.text().includes('ErrorBoundary caught')) errors.push(message.text()); } });
    const claimed = { starter: false, john: false };
    const bootstrap = profileBootstrap({ id: 'e2e-player', displayName: 'HOME COURT', settings: { reducedMotion: false, turnTimerEnabled: false } });
    await page.addInitScript(() => { localStorage.setItem('squabblemon_e2e_user', 'signed-in'); for (const phase of ['intro', 'ready']) localStorage.setItem(`squabblemon:starter-mythic:e2e-player:${phase}`, '1'); localStorage.setItem('squabblemon-gpu-tier-v2', 'low'); });
    await page.routeWebSocket('**', socket => socket.close());
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/bootstrap')) return route.fulfill({ json: bootstrap });
      const kind = path.includes('/starter-mythic') ? 'starter' : path.includes('/john-henry') ? 'john' : null;
      if (kind) {
        if (path.endsWith('/claim')) claimed[kind] = true;
        const status = mythicStatus(claimed[kind] ? 'claimed' : 'ready', kind === 'starter' ? starterChapterIds : johnChapterIds);
        return route.fulfill({ json: path.endsWith('/claim') ? { claimed: true, duplicateShards: 0, status, bootstrap } : status });
      }
      return route.fulfill({ json: path.endsWith('/rewards/account') ? accountStatus : path.endsWith('/challenges/runs') || path.endsWith('/events/patches') ? [] : { chapters: [], nodes: [], receipts: [], pending: [], items: [], messages: [], ids: [], state: 'claimed', reward: {} } });
    });
    await page.goto(`${origin}/game?gpuTier=low`);
    await expect(page.locator('.safehouse-stage')).toHaveAttribute('data-scene-ready', 'true', { timeout: 60000 }).catch(async error => { console.error(await page.locator('body').innerText()); await page.screenshot({path: `${output}/safehouse-failed.png`}); throw error; });
    const frame = page.frames().find(frame => frame.url().includes('/scenes/safehouse/')); assert.ok(frame);
    const send = data => page.locator('.venue-scene__frame').evaluate((element, data) => element.contentWindow.postMessage({ channel: 'squabblemon-scene', ...data }, location.origin), data);
    await send({ type: 'settings', reducedMotion: true });
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.safehouse-shortcuts img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    const geometry = async expected => {
      const controls = page.locator('.safehouse-shortcuts > a, .safehouse-shortcuts > button'); await expect(controls).toHaveCount(expected);
      const boxes = await controls.evaluateAll(elements => elements.map(element => { const r = element.getBoundingClientRect(); return { className: element.className, x: r.x, y: r.y, width: r.width, height: r.height }; }));
      for (let i = 1; i < boxes.length; i++) { const gap = boxes[i].y - boxes[i - 1].y - boxes[i - 1].height; assert.ok(gap >= 5 && gap <= 11, `Compact rail gap ${gap}`); assert.ok(Math.abs(boxes[i].x - boxes[0].x) < 1); }
      for (let i = 0; i < expected; i++) { await controls.nth(i).scrollIntoViewIfNeeded(); assert.ok(await controls.nth(i).evaluate(element => { const r = element.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), 'Every shortcut remains reachable'); }
      await page.locator('.safehouse-shortcuts').evaluate(element => { element.scrollTop = 0; }); return boxes;
    };
    const stages = [await geometry(4)];
    if (width <= 480 && height <= 720) {
      const markers = page.locator('.safehouse-room-markers button');
      for (let i = 0; i < await markers.count(); i++) { await markers.nth(i).scrollIntoViewIfNeeded(); assert.ok(await markers.nth(i).evaluate(element => { const r = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), 'Every short-phone station remains reachable'); }
      await page.locator('.safehouse-room-markers').evaluate(element => { element.scrollTop = 0; });
    }
    await page.waitForTimeout(250); await page.screenshot({ path: `${output}/safehouse-${width}x${height}-day.png` });
    await page.getByRole('button', { name: 'Switch to late night' }).click();
    await expect.poll(() => frame.evaluate(() => window.Squabblemon.getSceneStatus().night)).toBe(true);
    await page.waitForTimeout(250); await page.screenshot({ path: `${output}/safehouse-${width}x${height}-night.png` });
    // Use the actual reward dialogs and successful API responses; no DOM deletion.
    for (const [kind, selector, action] of [['john', '.john-henry-shortcut', 'Claim John Henry →'], ['starter', '.starter-mythic-shortcut', 'Claim your Mythic →']]) {
      await page.locator(selector).click(); await page.getByRole('button', { name: action, exact: true }).click();
      await page.locator('.character-recruitment').getByRole('button', { name: 'Keep going', exact: true }).click();
      await expect(page.locator(selector)).toHaveCount(0); stages.push(await geometry(kind === 'john' ? 3 : 2));
    }
    assert.ok(stages[2].at(-1).y < stages[0].at(-1).y - 100, 'Remaining shortcut moves up after completion');
    await page.waitForTimeout(250); await page.screenshot({ path: `${output}/safehouse-${width}x${height}-claimed.png` });
    await page.getByRole('button', { name: 'Explore the phone', exact: true }).click();
    await expect.poll(() => frame.evaluate(() => window.Squabblemon.getSceneStatus().view)).toBe('phone');
    await page.waitForTimeout(250); await page.screenshot({ path: `${output}/safehouse-${width}x${height}-phone.png` });
    await page.getByRole('button', { name: 'Back to the room', exact: true }).click();
    const canvas = frame.locator('#stage canvas'); await canvas.focus();
    await canvas.evaluate(element => { for (let i = 0; i < 24; i++) element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); for (let i = 0; i < 24; i++) element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); });
    await expect.poll(() => frame.evaluate(() => window.Squabblemon.getSceneStatus().camera.yaw)).toBe(-Math.PI / 2);
    const status = await frame.evaluate(() => window.Squabblemon.getSceneStatus());
    assert.ok(status.camera.position[0] >= -3.27 - 1e-7 && status.camera.position[1] >= 3.05 - 1e-7, 'Couch-facing camera clears the TV');
    await page.waitForTimeout(250); await page.screenshot({ path: `${output}/safehouse-${width}x${height}-couch-clearance.png` });
    assert.deepEqual(errors, []);
    report.push({ width, height, stages, camera: status.camera, drawCalls: status.drawCalls, triangles: status.triangles, errors });
    console.log(`PASS ${width}x${height}: claims compact rail; phone/night/TV clearance; ${status.drawCalls} draw calls`);
    await page.close();
  }
} finally { await browser.close(); await writeFile(`${output}/safehouse-refinement.json`, JSON.stringify(report, null, 2)); }
