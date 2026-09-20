import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
const port = process.env.SAFEHOUSE_PORT ?? '4183';
const origin = `http://127.0.0.1:${port}/squabblemon`;
const server = spawn(process.execPath, ['../../node_modules/vite/bin/vite.js', '--config', 'vite.config.ts', '--host', '127.0.0.1', '--port', port], {
  env: { ...process.env, PORT: port, BASE_PATH: '/squabblemon/', VITE_E2E_AUTH: 'true' }, stdio: 'ignore', windowsHide: true,
});
const report = { checks: [], errors: [], complete: false };
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await fetch(origin + '/')).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Local preview server is ready');
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  for (const [name, width, height, touch] of [['desktop', 1440, 960, false], ['phone', 390, 844, true], ['small-phone', 320, 740, true], ['landscape', 844, 390, true], ['tablet', 820, 1180, true]].filter(([name]) => !process.env.SAFEHOUSE_SIZES || process.env.SAFEHOUSE_SIZES.split(',').includes(name))) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
    await context.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
    const page = await context.newPage();
    await page.addInitScript(() => window.addEventListener('message', event => {
      if (event.origin === location.origin && event.data?.channel === 'squabblemon-scene' && event.data.type === 'anchors') window.safehouseAnchors = event.data.anchors;
    }));
    page.on('pageerror', error => report.errors.push(`${name}: ${error.message}`));
    await page.route('**/api/**', route => route.fulfill({ contentType: 'application/json', body: '{}' }));
    await page.goto(origin + '/game');
    await page.locator('.safehouse-stage[data-scene-ready="true"]').waitFor({ timeout: 25000 });
    const frame = page.frames().find(frame => frame.url().includes('/scenes/safehouse/'));
    assert.ok(frame);
    await frame.waitForFunction(() => window.Squabblemon.getSceneStatus().view === 'room');
    await frame.waitForFunction(() => window.Squabblemon.getSceneStatus().crewCards === 3);
    await page.waitForTimeout(850);
    const initial = await frame.evaluate(() => window.Squabblemon.getSceneStatus());
    assert.ok(initial.batching.combined > 500);
    assert.ok(initial.drawCalls < 450, 'Static batching keeps the full scene under 450 draw calls');
    assert.equal(initial.night, true);
    const geometry = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight }));
    assert.ok(geometry.scrollWidth <= width + 1 && geometry.scrollHeight <= height + 1, 'No viewport overflow');
    assert.equal(await page.locator('.safehouse-room-stations').count(), 0, 'The redundant room rail is removed');
    assert.equal(await page.locator('.safehouse-room-markers button').count(), 5, 'One scene button per destination');
    const markerBounds = [];
    for (const button of await page.locator('.safehouse-room-markers button').all()) {
      const bounds = await button.boundingBox();
      assert.ok(await button.isVisible(), 'All camera destinations remain visible');
      assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width + 1 && bounds.y + bounds.height <= height + 1, 'All camera destinations stay on screen');
      assert.ok(bounds.height >= 44, 'Scene controls have a 44px touch target');
      assert.ok(markerBounds.every(other => bounds.x + bounds.width <= other.x || other.x + other.width <= bounds.x || bounds.y + bounds.height <= other.y || other.y + other.height <= bounds.y), 'Scene controls do not overlap');
      markerBounds.push(bounds);
    }
    await page.screenshot({ path: `../../screenshots/safehouse-upgrade-${name}.jpg`, type: 'jpeg', quality: 85 });
    if (name === 'desktop') {
      // Click the actual 3D deck through the projected marker position.
      const point = await page.evaluate(() => {
        const anchor = window.safehouseAnchors.find(anchor => anchor.id === 'music');
        return { x: anchor.x * innerWidth / 100, y: anchor.y * innerHeight / 100 };
      });
      await page.locator('.safehouse-room-markers').evaluate(element => { element.hidden = true; });
      await page.mouse.click(point.x, point.y + 9);
      await frame.waitForFunction(() => window.Squabblemon.getSceneStatus().view === 'music');
      await page.getByRole('button', { name: 'Back to the room', exact: true }).click();
      await page.waitForTimeout(800);
      await page.mouse.move(width * .48, height * .36); await page.mouse.down();
      await page.mouse.move(width * .56, height * .55, { steps: 12 }); await page.mouse.up();
      await frame.waitForFunction(() => window.Squabblemon.getSceneStatus().music.ceilingVisible === false);
      await page.getByRole('button', { name: 'Reset room camera', exact: true }).click();
      await frame.waitForFunction(() => window.Squabblemon.getSceneStatus().music.ceilingVisible === true);
    }
    for (const [label, view] of [['the television', 'story'], ['the heavy bag', 'training'], ['your gang cards', 'cards'], ['the phone', 'phone'], ['the turntable', 'music']]) {
      const button = page.getByRole('button', { name: `Explore ${label}`, exact: true });
      if (touch) await button.tap(); else await button.click();
      await frame.waitForFunction(view => window.Squabblemon.getSceneStatus().view === view, view);
      await page.getByRole('button', { name: 'Back to the room', exact: true }).waitFor();
      if (view === 'training') await page.getByRole('button', { name: 'Hit the bag', exact: true }).click();
      if ((name === 'phone' || name === 'desktop' || name === 'landscape') && ['story', 'music', 'cards'].includes(view)) {
        await page.waitForTimeout(850);
        await page.screenshot({ path: `../../screenshots/safehouse-${view}-${name}.jpg`, type: 'jpeg', quality: 85 });
      }
      const action = page.locator('.safehouse-room-actions').first();
      const bounds = await action.boundingBox();
      assert.ok(bounds && bounds.y + bounds.height < height && bounds.x + bounds.width <= width, 'Context action stays reachable');
      await page.getByRole('button', { name: 'Back to the room', exact: true }).click();
      await frame.waitForFunction(() => window.Squabblemon.getSceneStatus().view === 'room');
      assert.equal(await button.evaluate(element => document.activeElement === element), true, 'Returning to the room restores focus to the scene control');
      await page.waitForTimeout(850);
    }
    await page.getByRole('button', { name: 'Switch to golden hour', exact: true }).click();
    await frame.waitForFunction(() => window.Squabblemon.getSceneStatus().night === false);
    assert.equal(await page.evaluate(() => localStorage.getItem('squabblemon_safehouse_lighting')), 'golden');
    if (name === 'desktop') {
      await page.screenshot({ path: '../../screenshots/safehouse-golden-desktop.jpg', type: 'jpeg', quality: 85 });
      await page.getByRole('button', { name: 'Explore the turntable', exact: true }).click();
      await page.keyboard.press('Escape');
      await frame.waitForFunction(() => window.Squabblemon.getSceneStatus().view === 'room');
      await page.reload();
      await page.locator('.safehouse-stage[data-scene-ready="true"]').waitFor();
      const refreshedFrame = page.frames().find(frame => frame.url().includes('/scenes/safehouse/'));
      await refreshedFrame.waitForFunction(() => !window.Squabblemon.getSceneStatus().night);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.reload();
      await page.locator('.safehouse-stage[data-scene-ready="true"]').waitFor();
      const reducedFrame = page.frames().find(frame => frame.url().includes('/scenes/safehouse/'));
      assert.equal(await reducedFrame.evaluate(() => window.Squabblemon.getSceneStatus().reduced), true);
      const firstMotion = await reducedFrame.evaluate(() => window.Squabblemon.getSceneStatus().music);
      await page.waitForTimeout(200);
      const secondMotion = await reducedFrame.evaluate(() => window.Squabblemon.getSceneStatus().music);
      assert.equal(firstMotion.fanAngle, secondMotion.fanAngle);
      assert.equal(firstMotion.recordAngle, secondMotion.recordAngle);
      // Losing a WebGL context leaves game navigation available and supports a clean reload.
      await reducedFrame.evaluate(() => document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
      await page.getByRole('button', { name: 'Reload scene', exact: true }).click();
      await page.locator('.safehouse-stage[data-scene-ready="true"]').waitFor();
      assert.equal(await page.locator('iframe[title="Interactive safehouse"]').count(), 1);
    }
    if (name === 'tablet') {
      await page.setViewportSize({ width: 1180, height: 820 });
      await frame.waitForFunction(() => Math.abs(window.Squabblemon.getSceneStatus().camera.radius - 10.7) < .05);
      await page.setViewportSize({ width, height });
      await frame.waitForFunction(() => Math.abs(window.Squabblemon.getSceneStatus().camera.radius - 12.1) < .05);
    }
    report.checks.push({ name, ...initial, geometry, cameras: 5, lightToggle: true });
    console.log(`${name}: room, all five cameras, game actions, lighting and viewport checks passed.`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.complete = true;
} catch (error) { report.failure = String(error.stack ?? error); throw error; }
finally {
  await browser?.close(); server.kill();
  await writeFile(`../../screenshots/safehouse-verification${process.env.SAFEHOUSE_SIZES ? '-' + process.env.SAFEHOUSE_SIZES : ''}.json`, JSON.stringify(report, null, 2));
}
