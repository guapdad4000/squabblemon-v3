const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const origin = process.env.TEST_BASE_URL || 'http://127.0.0.1:4206';
const output = process.env.REVIEW_OUTPUT || '/tmp/battle-header-review';
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const results = [];
  try {
    for (const [width, height] of [[320, 568], [390, 844], [430, 932], [844, 390], [1440, 1000]]) {
      const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 600, hasTouch: width < 600 });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const load = async (query = '') => {
        await page.goto(`${origin}/e2e/battle-mobile.fixture.html${query}`, { waitUntil: 'domcontentloaded' });
        await page.getByTestId('battle-arena').waitFor();
        await page.evaluate(() => Promise.race([Promise.all([...document.images].filter(i => i.loading !== 'lazy').map(i => i.decode().catch(() => {}))), new Promise(resolve => setTimeout(resolve, 2000))]));
        await page.waitForTimeout(200);
      };
      await load();
      const menu = page.locator('.battle-tools > summary');
      assert.equal(await page.getByRole('button', { name: 'Music controls', exact: true }).isVisible(), false, 'music lives in the menu');
      if (width < 600) {
        const rival = await page.locator('.battle-rival').boundingBox();
        const round = await page.locator('.battle-header .battle-round').boundingBox();
        const timer = await page.getByTestId('turn-timer').boundingBox();
        assert.ok(rival.x + rival.width <= round.x + 1 && round.x + round.width <= timer.x + 1, 'identity, round and timer have separate spaces');
        const board = await page.locator('.battlefield-grid').boundingBox();
        assert.ok(board.y < 110, 'header preserves the mobile battlefield footprint');
      }
      for (const theme of ['dark', 'light']) {
        await page.evaluate(t => { document.documentElement.classList.toggle('dark', t === 'dark'); document.documentElement.dataset.theme = t; }, theme);
        await page.screenshot({ path: `${output}/${width}-${theme}.png` });
      }
      if (width === 390) await page.screenshot({ path: `${output}/390-header.png`, clip: { x: 0, y: 0, width, height: 96 } });
      await menu.click();
      const music = page.getByRole('button', { name: 'Music controls', exact: true });
      await music.waitFor({ state: 'visible' });
      assert.equal(await music.evaluate(n => getComputedStyle(n).color), 'rgb(40, 48, 42)', 'music label contrasts with the paper menu');
      const panel = await page.locator('.battle-tools__panel').boundingBox();
      assert.ok(panel.x >= 0 && panel.x + panel.width <= width + 1, 'menu stays inside the viewport');
      if (width === 390) await page.screenshot({ path: `${output}/390-menu.png` });
      await music.click();
      const dialog = page.getByRole('dialog', { name: 'The Fade Tapes' });
      await dialog.waitFor();
      assert.ok((await dialog.boundingBox()).width <= Math.min(420, width - 20), 'music dialog retains its own width');
      await page.getByRole('button', { name: 'Close music controls' }).click();
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.battle-tools').getAttribute('open'), null);
      assert.ok(await menu.evaluate(n => n === document.activeElement), 'Escape restores menu focus');
      if (width < 600) {
        await load('?long-name&timer=5');
        assert.equal(await page.getByTestId('turn-timer').getAttribute('data-timer-state'), 'urgent');
        assert.ok(await page.locator('.battle-rival-copy .font-display').evaluate(n => n.scrollWidth > n.clientWidth && getComputedStyle(n).textOverflow === 'ellipsis'), 'long names truncate within their identity slot');
        await load('?phase=rival-thinking');
        assert.match(await page.getByTestId('turn-timer').getAttribute('aria-label'), /paused/);
        assert.equal(await page.locator('.battle-rival-avatar.is-thinking').count(), 1);
        await load('?no-timer');
        assert.equal(await page.getByTestId('turn-timer').count(), 0);
      }
      await load('?pvp');
      assert.equal(await page.locator('.battle-command-header--organized').count(), 0, 'PvP keeps its existing header');
      assert.ok(await page.getByTestId('pvp-rival-avatar').isVisible());
      assert.ok(await page.getByTestId('pvp-player-avatar').isVisible());
      assert.ok(await page.getByRole('button', { name: 'Music controls', exact: true }).isVisible());
      if (width === 390) await page.screenshot({ path: `${output}/390-pvp.png` });
      assert.deepEqual(errors, []);
      results.push({ width, height, menu: true, music: true, keyboard: true, pvp: true, errors });
      await page.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(`${output}/browser.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
