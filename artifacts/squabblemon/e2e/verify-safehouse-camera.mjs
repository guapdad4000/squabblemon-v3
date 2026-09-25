import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { ROOM_INTERIOR, CAMERA_CLEARANCE } from '../public/scenes/safehouse/camera-limits.js';

const url = process.env.SAFEHOUSE_URL ?? 'http://localhost:4198/scenes/safehouse/index.html';
const output = process.env.REVIEW_OUTPUT ?? '/tmp/safehouse-camera-review';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.SAFEHOUSE_BROWSER_CHANNEL, args: ['--enable-unsafe-swiftshader'] });
const report = [];
try {
  for (const [name, width, height, touch] of [['desktop', 1440, 900, false], ['phone', 390, 844, true], ['landscape', 844, 390, true], ['tablet', 820, 1180, true]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, deviceScaleFactor: .5 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // Match the game's iframe integration so scene messages go to its host.
    const hostUrl = new URL('/camera-test.html', url).href;
    await page.route(hostUrl, route => route.fulfill({ contentType: 'text/html', body: `<style>body{margin:0}iframe{display:block;width:100vw;height:100vh;border:0}</style><iframe src="${url}"></iframe>` }));
    await page.goto(hostUrl);
    const frame = page.frames().find(frame => frame.url() === url);
    assert.ok(frame, 'Embedded safehouse loaded');
    await frame.waitForFunction(() => window.Squabblemon?.getSceneStatus?.().camera.position);
    await frame.evaluate(() => document.querySelector('#stage canvas').addEventListener('webglcontextlost', () => { throw new Error('Camera verification lost its WebGL context'); }));
    console.log(`${name}: scene loaded; checking camera controls.`);
    await frame.evaluate(({ bounds, margin }) => {
      window.cameraCheck = { frames: 0, violations: [] };
      function check() {
        const status = window.Squabblemon.getSceneStatus();
        const camera = status.camera;
        const inside = ['X', 'Y', 'Z'].every((axis, index) => camera.position[index] >= bounds[`min${axis}`] + margin - 1e-8 && camera.position[index] <= bounds[`max${axis}`] - margin + 1e-8);
        const contained = innerWidth / innerHeight >= .95;
        if ((contained && !inside) || Math.abs(camera.yaw) > Math.PI / 2 + 1e-8 || status.music.ceilingVisible !== contained || camera.radius > 12.1 + 1e-8) window.cameraCheck.violations.push(camera);
        window.cameraCheck.frames++;
        requestAnimationFrame(check);
      }
      requestAnimationFrame(check);
    }, { bounds: ROOM_INTERIOR, margin: CAMERA_CLEARANCE });
    const send = (type, extra) => page.evaluate(data => document.querySelector('iframe').contentWindow.postMessage({ channel: 'squabblemon-scene', ...data }, location.origin), { type, ...extra });
    const status = () => frame.evaluate(() => window.Squabblemon.getSceneStatus());
    // Sample actual eased transitions before enabling reduced motion for exact endpoints.
    for (const view of ['mail', 'arcade', 'phone', 'room']) {
      await send('view', { view });
      await frame.waitForFunction(view => window.Squabblemon.getSceneStatus().view === view, view);
      await page.waitForTimeout(250);
    }
    await send('settings', { reducedMotion: true });
    await frame.waitForFunction(() => window.Squabblemon.getSceneStatus().reduced);
    await page.screenshot({ path: `${output}/${name}-room.png` });
    const canvas = frame.locator('#stage canvas');
    await canvas.focus();
    for (const key of ['ArrowLeft', 'ArrowRight']) {
      await page.keyboard.press(key);
      await canvas.evaluate((canvas, key) => { for (let i = 0; i < 45; i++) canvas.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); }, key);
      const expected = key === 'ArrowLeft' ? -Math.PI / 2 : Math.PI / 2;
      await frame.waitForFunction(expected => Math.abs(window.Squabblemon.getSceneStatus().camera.yaw - expected) < 1e-8, expected);
      const { position: eye, target } = (await status()).camera;
      assert.ok(Math.abs(Math.atan2(eye[0] - target[0], eye[2] - target[2]) - expected) < 1e-8);
      await page.screenshot({ path: `${output}/${name}-${key}.png` });
    }
    await send('view', { view: 'room' });
    await frame.waitForFunction(() => Math.abs(window.Squabblemon.getSceneStatus().camera.yaw) < .2);
    // Real pointer capture and extreme drags, including repeated movement at a limit.
    for (const [start, end] of [[[.9, .3], [.1, .9]], [[.1, .9], [.9, .1]]]) {
      for (let i = 0; i < 3; i++) {
        await page.mouse.move(width * start[0], height * start[1]);
        await page.mouse.down();
        await page.mouse.move(width * end[0], height * end[1], { steps: 6 });
        await page.mouse.up();
      }
    }
    for (const [key, expected] of [['ArrowUp', 1.2], ['ArrowDown', .06]]) {
      await page.keyboard.press(key);
      await canvas.evaluate((canvas, key) => { for (let i = 0; i < 20; i++) canvas.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); }, key);
      await frame.waitForFunction(expected => Math.abs(window.Squabblemon.getSceneStatus().camera.pitch - expected) < 1e-8, expected);
    }
    for (const [delta, radius] of [[100000, width / height < .95 ? 12.1 : 10.7], [-100000, 1.1]]) {
      await page.mouse.wheel(0, delta);
      await frame.waitForFunction(radius => Math.abs(window.Squabblemon.getSceneStatus().camera.radius - radius) < 1e-8, radius);
    }
    if (touch) {
      const cdp = await context.newCDPSession(page);
      const points = (gap) => [{ x: width / 2 - gap, y: height / 2, id: 1 }, { x: width / 2 + gap, y: height / 2, id: 2 }];
      for (const gaps of [[20, 30, width * .4], [width * .4, width * .35, 10]]) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(gaps[0]) });
        for (const gap of gaps.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(gap) });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
      await cdp.detach();
    }
    for (const view of ['table', 'lounge', 'story', 'training', 'cards', 'phone', 'music', 'inventory', 'arcade', 'growth', 'profile', 'mail', 'room']) {
      await send('view', { view });
      await frame.waitForFunction(view => window.Squabblemon.getSceneStatus().view === view, view);
      await frame.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    }
    await page.setViewportSize({ width: height, height: width });
    await frame.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await canvas.focus();
    await page.keyboard.press('Escape');
    const check = await frame.evaluate(() => window.cameraCheck);
    assert.deepEqual(check.violations, [], `${name}: camera limits and mobile roof match the viewport`);
    assert.deepEqual(errors, []);
    report.push({ name, ...check, errors, camera: (await status()).camera });
    console.log(`${name}: 180° rotation, drag, tilt, zoom, ${touch ? 'pinch, ' : ''}13 presets, transitions, resize and reset passed (${check.frames} frames).`);
    await context.close();
  }
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
