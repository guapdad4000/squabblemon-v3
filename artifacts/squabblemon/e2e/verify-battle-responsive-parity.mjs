import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const origin = process.env.PARITY_ORIGIN || 'http://127.0.0.1:4242';
const output = process.env.PARITY_OUTPUT || '/tmp/squabblemon-responsive-parity';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const results = [];
let activePage, activeLabel;
const save = () => writeFile(`${output}/responsive-parity.json`, JSON.stringify(results, null, 2));
try {
  for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1440, 1000]]) {
    activeLabel = `${width}x${height}`;
    const page = activePage = await browser.newPage({ viewport: { width, height }, isMobile: width < 600, hasTouch: width < 600 });
    page.setDefaultTimeout(15000);
    // Keep background catalog checkpoints from refreshing the test mid-interaction.
    // These fixtures do not use multiplayer transport; PVP is presentation data.
    await page.routeWebSocket('**', socket => socket.close());
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const visit = async query => {
      await page.goto(`${origin}/e2e/battle-parity.fixture.html?no-timer&counts=4,1,8${query}`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('battle-arena').waitFor();
      await page.evaluate(async () => {
        await Promise.all([document.fonts.load('700 15px "Hemi Head"'), document.fonts.load('700 24px "Hemi Head Italic"'), document.fonts.load('400 16px "Blzee"')]);
        await Promise.all([...document.images].filter(image => image.loading !== 'lazy').map(image => image.decode().catch(() => {})));
      });
      await page.waitForTimeout(650);
    };
    const capture = name => page.screenshot({ path: `${output}/${activeLabel}-${name}.png`, timeout: 20000 });
    const fonts = () => page.evaluate(() => Object.fromEntries(Object.entries({ action: '.battle-primary-action', card: '.card-stat-value', location: '.mobile-district-open', score: '.score-tick' }).map(([name, selector]) => {
      const css = getComputedStyle(document.querySelector(selector));
      return [name, { family: css.fontFamily, weight: css.fontWeight }];
    })));
    await visit('');
    const trainingFonts = await fonts();
    assert.match(trainingFonts.action.family, /^"?Hemi Head"?,/);
    assert.match(trainingFonts.card.family, /^"Hemi Head Italic",/);
    assert.match(trainingFonts.location.family, /^"?Blzee"?,/);
    assert.equal(trainingFonts.location.weight, '400');
    assert.match(trainingFonts.score.family, /^"Hemi Head Italic",/);
    const geometry = await page.evaluate(() => {
      const rect = element => { const b = element.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height, bottom: b.bottom }; };
      return { board: [...document.querySelectorAll('[data-card-zone="board"]')].map(rect), action: rect(document.querySelector('.battle-primary-action')), pageWidth: document.documentElement.scrollWidth };
    });
    assert.equal(geometry.board.length, 26);
    assert.ok(geometry.board.every(card => card.width >= (width < 600 ? 46 : 60) && card.height > 0), 'Crowded cards keep their readable footprint');
    assert.ok(geometry.action.bottom <= height + 1 && geometry.action.height >= 44, 'Primary action remains reachable');
    assert.ok(geometry.pageWidth <= width + 1, 'No page-level horizontal overflow');
    await capture('training-board');

    const reached = [];
    for (const owner of ['cpu', 'player']) {
      const stack = page.getByTestId(`lane-2-${owner}-zone`).locator('.battle-card-stack');
      assert.equal(await stack.locator(':scope > [data-card-zone="board"]').count(), 8);
      await stack.focus(); await page.keyboard.press('End');
      await page.waitForTimeout(450);
      const atEnd = await stack.evaluate(element => ({ top: element.scrollTop, overflow: element.scrollHeight > element.clientHeight + 2, more: element.dataset.moreAfter }));
      if (atEnd.overflow) { assert.ok(atEnd.top > 0); assert.equal(atEnd.more, 'false', 'End reaches the final row and clears its continuation cue'); }
      await page.keyboard.press('Home'); await page.waitForTimeout(450);
      assert.ok(await stack.evaluate(element => element.scrollTop <= element.firstElementChild.offsetTop + 1), 'Home returns to the first row (including its scroll-snap inset)');
      for (let index = 0; index < 8; index++) {
        await stack.evaluate((element, index) => { const card = element.children[index]; element.scrollTop = card.offsetTop; }, index);
        await page.waitForTimeout(60);
        const card = await stack.evaluate((element, index) => {
          const b = element.children[index].getBoundingClientRect(), s = element.getBoundingClientRect();
          return { id: element.children[index].dataset.instanceId, top: b.top, bottom: b.bottom, viewportTop: s.top, viewportBottom: s.bottom };
        }, index);
        assert.ok(card.top >= card.viewportTop - 2 && card.bottom <= card.viewportBottom + 2, `Every crowded card remains reachable: ${JSON.stringify(card)}`);
        reached.push(card.id);
      }
      await stack.evaluate(element => { element.scrollTop = 0; });
    }
    await page.locator('.battlefield-grid').evaluate(element => { element.scrollTop = 0; });
    await page.getByTestId('district-details-0').click();
    const district = page.getByRole('dialog', { name: /district view/i });
    await district.waitFor();
    assert.ok(await district.getByTestId('location-rule').isVisible());
    await page.keyboard.press('Escape'); await district.waitFor({ state: 'hidden' });
    assert.ok(await page.getByTestId('district-details-0').evaluate(element => element === document.activeElement), 'Location Escape restores focus');
    const inspect = page.getByTestId('lane-2-player-zone').locator('.formation-expand');
    await inspect.click(); await district.waitFor();
    assert.equal(await district.locator('[data-card-zone="board"]').count(), 16, 'Inspection includes both complete eight-card crews');
    await district.locator('[data-card-zone="board"]').first().click();
    const close = page.getByTestId('button-close-inspector'); await close.waitFor();
    await capture('full-card-inspection');
    await close.click(); await close.waitFor({ state: 'hidden' });
    await page.keyboard.press('Escape'); await district.waitFor({ state: 'hidden' });
    assert.ok(await inspect.evaluate(element => element === document.activeElement), 'Crew Escape restores focus');

    await page.locator('[data-card-zone="hand"]').first().click();
    await page.getByTestId('lane-0').click(); await page.mouse.move(0, 0); await page.waitForTimeout(600);
    const target = await page.evaluate(() => {
      const line = document.querySelector('[data-testid="battle-target-line"]');
      const values = line.querySelector('.battle-target-line__beam').getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);
      const arena = document.querySelector('[data-testid="battle-arena"]').getBoundingClientRect();
      const card = document.querySelector('[data-card-zone="hand"][aria-pressed="true"]').getBoundingClientRect();
      const hand = document.querySelector('[data-testid="hand-tray"]').getBoundingClientRect();
      const lane = document.querySelector('[data-testid="lane-0"]').getBoundingClientRect();
      return { visibility: getComputedStyle(line).visibility,
        dx: Math.abs(values[0] + arena.left - Math.max(Math.max(card.left, hand.left), Math.min(Math.min(card.right, hand.right), card.left + card.width / 2))),
        dy: Math.abs(values[1] + arena.top - Math.max(card.top, hand.top)),
        endX: Math.abs(values.at(-2) + arena.left - (lane.left + lane.width / 2)), endY: Math.abs(values.at(-1) + arena.top - lane.bottom) };
    });
    assert.equal(target.visibility, 'visible');
    assert.ok([target.dx, target.dy, target.endX, target.endY].every(delta => delta < 2), `Target line remains attached: ${JSON.stringify(target)}`);
    assert.ok(await page.locator('.preview-target').count() > 0, 'Selection previews affected fighters');
    await capture('selected-target');
    await page.getByTestId('button-lock').click();
    await page.waitForFunction(() => document.querySelectorAll('[data-card-zone="hand"]').length === 6);
    assert.equal(await page.locator('[data-card-zone="board"]').count(), 27, 'Play moves one card to the board');

    await visit('&pvp');
    const pvpFonts = await fonts();
    assert.deepEqual(pvpFonts, trainingFonts, 'PVP and training share typography roles');
    await capture('pvp-board');
    await visit('&effect&effect-card=cornball&effect-lane=0');
    await page.waitForFunction(() => [...document.querySelectorAll('.attack-material[data-geo-change]')].some(element => element.style.display !== 'none' && element.style.left));
    const impacts = await page.evaluate(() => {
      const overlay = document.querySelector('[data-testid="character-attack"]');
      const arena = overlay.parentElement.getBoundingClientRect();
      return [...overlay.querySelectorAll('.attack-material[data-geo-change]')].filter(element => element.style.display !== 'none').map(element => {
        const card = document.querySelector(`[data-card-zone="board"][data-instance-id="${CSS.escape(element.dataset.geoChange)}"]`);
        const b = card?.getBoundingClientRect();
        return { id: element.dataset.geoChange, width: parseFloat(element.style.width), height: parseFloat(element.style.height),
          dx: b ? Math.abs(parseFloat(element.style.left) - (b.left - arena.left + b.width / 2)) : null,
          dy: b ? Math.abs(parseFloat(element.style.top) - (b.top - arena.top + b.height / 2)) : null };
      });
    });
    assert.ok(impacts.length > 0);
    for (const impact of impacts) assert.ok(impact.width > 0 && impact.height > 0 && impact.dx !== null && impact.dy !== null && impact.dx < 3 && impact.dy < 3, `Hit artwork tracks target bounds: ${JSON.stringify(impact)}`);
    await capture('attack-targets');
    await visit('&encounter=s2-launch-crew-scrimmage');
    const story = await page.locator('picture.battle-venue__art img').evaluate(image => ({ src: image.currentSrc, loaded: image.complete && image.naturalWidth > 0 }));
    assert.match(story.src, /assets\/story\/environments\/backgrounds\/33-the-morning-after-rooftop\.webp/, 'Custom Story art remains selected in portrait and landscape');
    assert.ok(story.loaded, 'Custom Story artwork loads');
    assert.ok(await page.getByTestId('pvp-rival-avatar').locator('img').evaluate(image => image.complete && image.naturalWidth > 0), 'Story fixture resolves the same catalog portrait as PlayLoop');
    await capture('custom-story-board');
    assert.deepEqual(errors, []);
    results.push({ width, height, result: 'pass', boardCards: 26, minimumCardWidth: Math.min(...geometry.board.map(card => card.width)), crowdedCardsReached: reached.length, inspection: true, play: true, target, impacts, trainingFonts, pvpFonts, story, errors });
    await save(); console.log(`PASS ${activeLabel}: scroll, inspect, target, play, impact, PVP fonts, custom Story artwork`);
    await page.close();
  }
} catch (error) {
  results.push({ viewport: activeLabel, result: 'failed', error: String(error) });
  await save();
  await activePage?.screenshot({ path: `${output}/${activeLabel}-failure.png`, timeout: 10000 }).catch(() => {});
  throw error;
} finally { await browser.close(); }
