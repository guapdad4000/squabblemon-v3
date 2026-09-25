import { selectStreetOption } from './street-select.helper.mjs';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const origin = process.env.WAVE_ORIGIN ?? 'http://127.0.0.1:4197';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
try {
  for (const [width, height] of [[1280, 900], [390, 844], [320, 740], [844, 390]]) {
    for (const online of [false, true]) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', hasTouch: width < 900 });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(origin + '/e2e/battle-drag.fixture.html?wave' + (online ? '&online' : ''));
      const card = page.locator('[data-card-zone="hand"][data-card-id="homeless-guy"]');
      await card.click();
      await page.getByTestId('lane-0').click();
      const extra = page.getByLabel('Extra Motion', { exact: true });
      await selectStreetOption(page, extra, '4');
      const confirm = page.getByTestId('button-lock');
      const label = await confirm.innerText();
      assert.match(label, /[67] MOTION/i);
      const total = Number(label.match(/(\d+) MOTION/i)[1]);
      const box = await confirm.boundingBox();
      assert(box && box.y >= 0 && box.y + box.height <= height + 1, 'Confirm must remain inside viewport');
      assert(await confirm.evaluate(el => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }), 'Confirm must not be covered');
      assert.match(await page.getByTestId('character-mark-0').innerText(), /Your Package/);
      assert.match(await page.getByTestId('character-mark-1').innerText(), /Rival Scent/);
      await page.screenshot({ path: '../../screenshots/character-wave-' + (online ? 'online-' : 'solo-') + width + '.png' });
      await confirm.click();
      const played = page.locator('[data-card-zone="board"][data-card-id="homeless-guy"]');
      await played.waitFor();
      assert.equal(await played.getAttribute('data-card-power'), '7');
      assert.equal(await card.count(), 0);
      assert.equal(Number(await page.getByTestId('motion-player').innerText()), 8 - total);
      assert.equal(await page.getByTestId('wild-investment').count(), 0);
      console.log((online ? 'PvP' : 'Solo') + ' ' + width + 'x' + height + ': visible Confirm, one play, +4 Hands, exact Motion, public markers');
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
