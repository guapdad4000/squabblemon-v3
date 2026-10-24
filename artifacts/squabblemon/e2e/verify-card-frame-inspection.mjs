import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
const base = process.env.BASE_URL ?? 'http://127.0.0.1:4245';
const output = process.env.OUTPUT_DIR ?? '/home/falcon/Documents/New project 9/output/v2-card-details';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const results = { frames: [], inspectors: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => results.errors.push(error.message));
  async function load(query) {
    await page.goto(`${base}/e2e/card-frame-inspection.fixture.html?${query}`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="open-details"]').waitFor();
    await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 5000))]));
  }
  async function settleArtwork(selector) {
    await page.locator(selector).evaluateAll(async roots => {
      const images = roots.flatMap(root => [...root.querySelectorAll('img')]).filter(image => image.getBoundingClientRect().width > 0);
      await Promise.race([Promise.all(images.map(image => image.decode())), new Promise((_, reject) => setTimeout(() => reject(new Error('Visible artwork decode timed out')), 5000))]);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
  }
  // The printed frame must survive foil=false at every rarity and both production tile/hero sizes.
  for (const rarity of ['SuperCommon', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythical']) {
    for (const foil of [true, false]) {
      await load(`rarity=${rarity}&foil=${foil}`);
      await page.waitForFunction(() => [...document.querySelectorAll('[data-testid^=frame-] img')].filter(image => image.getBoundingClientRect().width > 0).every(image => image.complete && image.naturalWidth > 0), undefined, { timeout: 10000 });
      await settleArtwork('[data-testid^=frame-]');
      const frames = await page.locator('[data-testid^="frame-"] .collector-card').evaluateAll(cards => cards.map(card => {
        const rim = card.querySelector('.layered-rarity-rim'), style = getComputedStyle(rim), box = card.getBoundingClientRect();
        return { rarity: card.dataset.cardRarity, width: box.width, height: box.height, display: style.display, opacity: Number(style.opacity), thickness: parseFloat(style.paddingTop), background: style.backgroundImage, mask: style.maskImage, animation: style.animationName, imagesLoaded: [...card.querySelectorAll('img')].filter(image => image.getBoundingClientRect().width > 0).every(image => image.complete && image.naturalWidth > 0) };
      }));
      for (const [index, frame] of frames.entries()) {
        assert.equal(frame.rarity, rarity);
        assert.equal(frame.width, [128, 320][index], 'frame cannot change card geometry');
        assert.ok(Math.abs(frame.height / frame.width - 88 / 63) < .01, 'authored card proportion');
        assert.notEqual(frame.display, 'none', `${rarity}, foil=${foil} has a physical frame`);
        assert.equal(frame.opacity, 1, `${rarity} frame is not faded out`);
        assert.ok(frame.thickness >= frame.width * .03, `${rarity} frame remains legible at ${frame.width}px`);
        assert.equal(frame.animation, 'none', 'printed border costs no idle animation');
        assert.notEqual(frame.mask, 'none', 'frame leaves central artwork open');
        if (!foil || ['SuperCommon', 'Common', 'Uncommon'].includes(rarity)) assert.ok(!frame.background.includes('prism-flakes'), 'matte frame is separate from foil');
        else assert.ok(frame.background.includes('prism-flakes'), 'premium foil remains intact');
      }
      if (['SuperCommon', 'Common', 'Mythical'].includes(rarity)) {
        await page.screenshot({ path: `${output}/after-${rarity}-${foil}.png` });
      }
      results.frames.push({ rarity, foil, frames });
    }
  }
  // Use the real component inside a transformed native popup, where the old div was clipped.
  for (const [width, height] of [[1440, 1000], [390, 844], [320, 568], [844, 390]]) {
    for (const nested of [false, true]) {
      await page.setViewportSize({ width, height });
      await load(`card=buddy&nested=${nested}`);
      const opener = page.locator('[data-testid="open-details"]');
      await opener.click();
      const shell = page.locator('.card-inspector-shell');
      await shell.waitFor();
      await page.waitForTimeout(120);
      const state = await shell.evaluate(dialog => {
        const box = dialog.getBoundingClientRect(), scroll = dialog.querySelector('.card-inspector-scroll'), close = dialog.querySelector('[data-testid="button-close-inspector"]'), closeBox = close.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height, modal: dialog.matches(':modal'), horizontalOverflow: scroll.scrollWidth > scroll.clientWidth + 1, closeReachable: closeBox.x >= 0 && closeBox.y >= 0 && closeBox.right <= innerWidth && closeBox.bottom <= innerHeight, focused: document.activeElement === close, hiddenMotion: getComputedStyle(dialog.querySelector('.card-inspector-layout')).opacity, parent: dialog.parentElement.tagName };
      });
      assert.equal(state.modal, true, 'inspector has its own modal top layer');
      assert.equal(state.parent, 'BODY');
      assert.equal(state.x, 0); assert.equal(state.y, 0); assert.equal(state.width, width); assert.equal(state.height, height);
      assert.equal(state.horizontalOverflow, false); assert.equal(state.closeReachable, true); assert.equal(state.focused, true);
      assert.equal(state.hiddenMotion, '1', 'reduced-motion content is visible immediately');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await shell.evaluate(dialog => dialog.contains(document.activeElement)), true, 'reverse Tab stays in the inspector');
      await page.keyboard.press('Tab');
      assert.equal(await shell.locator('[data-testid=button-close-inspector]').evaluate(button => document.activeElement === button), true, 'Tab wraps to the close control');
      assert.equal(await shell.getByText('Drag the card to catch the light', { exact: true }).count(), 0);
      const formButtons = shell.getByRole('group', { name: 'Preview BUDDY form' }).getByRole('button');
      await formButtons.nth(1).click();
      assert.equal(await shell.locator('.polaroid .collector-card').getAttribute('data-buddy-form'), 'squabble');
      assert.equal(await shell.locator('.polaroid .collector-card').getAttribute('data-card-power'), '6');
      await formButtons.nth(0).click();
      assert.equal(await shell.locator('.polaroid .collector-card').getAttribute('data-card-power'), '3');
      for (const control of await shell.locator('.collector-finish-controls button').all()) {
        await control.scrollIntoViewIfNeeded();
        assert.equal(await control.evaluate(button => { const r = button.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return r.width > 0 && r.height >= 44 && button.contains(hit); }), true, 'finish control remains reachable and unobstructed');
        await control.click();
      }
      await shell.locator('.card-inspector-scroll').evaluate(scroll => { scroll.scrollTop = 0; });
      await settleArtwork('.card-inspector-shell');
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${output}/after-details-${width}-${nested}.png` });
      await page.keyboard.press('Escape');
      await shell.waitFor({ state: 'detached' });
      assert.equal(await opener.evaluate(button => document.activeElement === button), true, 'focus returns to source');
      if (nested) assert.equal(await page.locator('[data-testid="parent-dialog"]').evaluate(dialog => dialog.open && dialog.matches(':modal')), true, 'Escape closes only inspector');
      // Reopening/close-button cleanup cannot leave a stale native modal in the top layer.
      await opener.click(); await page.locator('[data-testid="button-close-inspector"]').click();
      assert.equal(await page.locator('.card-inspector-shell').count(), 0);
      results.inspectors.push({ width, height, nested, state, forms: 'normal+squabble', controls: 'hit-tested', focus: 'restored' });
    }
  }
  await load('card=buddy&battle=true'); await page.locator('[data-testid="open-details"]').click();
  assert.equal(await page.locator('.polaroid .collector-card').getAttribute('data-buddy-form'), 'squabble');
  assert.equal(await page.locator('.collector-form-preview').count(), 0, 'live battle does not expose speculative form toggles');
  await page.getByRole('button', { name: 'Close card details' }).click();
  // Keep the existing real-component gesture suite in the same native-modal regression.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/e2e/card-inspection.fixture.html`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Run gesture checks' }).click();
  await page.waitForFunction(() => /ALL CHECKS PASSED|FAIL/.test(document.querySelector('[data-testid=gesture-results]')?.textContent ?? ''), undefined, { timeout: 60000 });
  results.gestures = await page.locator('[data-testid=gesture-results]').innerText();
  await writeFile(`${output}/gestures.json`, JSON.stringify({ width: 390, height: 844, results: results.gestures, errors: results.errors }, null, 2));
  assert.match(results.gestures, /ALL CHECKS PASSED/);
  assert.deepEqual(results.errors, []);
  await writeFile(`${output}/verification.json`, JSON.stringify(results, null, 2));
  console.log(`PASS ${results.frames.length * 2} frame-size/foil cases, ${results.inspectors.length} responsive inspector cases, live battle form, keyboard/native-parent lifecycle, and existing deck/solo/waiting/PvP gestures.`);
} finally { await browser.close(); }
