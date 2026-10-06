const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const origin = process.env.TEST_BASE_URL || 'http://127.0.0.1:4213';
const output = process.env.REVIEW_OUTPUT || '/tmp/ipad-battle-wallpaper-review';
const tabletPairs = [
  [[768, 1024], [1024, 768]],
  [[820, 1180], [1180, 820]],
  [[834, 1194], [1194, 834]],
  [[1024, 1366], [1366, 1024]],
];
const venues = [
  { rival: 'block', id: 'corner-store', portrait: 'corner-store-court.webp', landscape: 'corner-store.webp' },
  { rival: 'slide', id: 'harbor-skyline', portrait: 'harbor-skyline-court.webp', landscape: 'moon-rooftop.webp' },
  { rival: 'combo', id: 'civic-hill', portrait: 'civic-hill-climb.webp', landscape: 'civic-summit.webp' },
  { rival: 'crashout', id: 'red-fence-night', portrait: 'red-fence-night-court.webp', landscape: 'red-court.webp' },
  { rival: 'vibes', id: 'crown-rooftop', portrait: 'crown-rooftop-court.webp', landscape: 'crown-court.webp' },
];
const desktops = [[1920, 1080], [2560, 1440], [3440, 1440]];
const storyCases = [
  // The screenshot's real story encounter issues a portrait red-fence court,
  // while its venue identity falls back to civic-hill. Assert the asset pair.
  { encounter: 'red-tapes-side-eye-security', id: 'civic-hill', portrait: 'red-fence-night-court.webp', landscape: 'red-court.webp', locations: 'nail-salon,vip-section,penthouse', viewports: [[1920, 1080], [3440, 1440], [390, 844], [768, 1024], [1024, 768]] },
  { encounter: 'welcome-to-the-block', id: 'corner-store', portrait: 'corner-store-court.webp', landscape: 'corner-store.webp', viewports: [[1920, 1080]] },
  // Custom story art stays intact rather than being replaced with a venue.
  { encounter: 's2-rooftop-demo-table', id: 'civic-hill', portrait: 'civic-hill-climb.webp', landscape: 'rooftop.webp', landscapeRatio: 1, viewports: [[1920, 1080]] },
];
const regressions = [
  { width: 390, height: 844, touch: true },
  { width: 490, height: 1000, touch: false },
  { width: 1440, height: 900, touch: false },
];

function near(actual, expected, description, tolerance = 1) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${description}: expected ${expected}, received ${actual}`);
}
function withinViewport(box, viewport, description) {
  assert.ok(box && box.width > 0 && box.height > 0, `${description} has a visible footprint`);
  assert.ok(box.x >= -1 && box.y >= -1 && box.x + box.width <= viewport.width + 1
    && box.y + box.height <= viewport.height + 1,
  `${description} stays inside ${viewport.width}×${viewport.height}: ${JSON.stringify(box)}`);
}
async function settleArt(page, viewport, venue) {
  const expected = viewport.width < viewport.height ? venue.portrait : venue.landscape;
  await page.waitForFunction(filename => {
    const image = document.querySelector('picture.battle-venue__art > img');
    return image?.complete && image.naturalWidth > 0 && new URL(image.currentSrc).pathname.endsWith(`/${filename}`);
  }, expected);
  await page.evaluate(() => Promise.race([
    Promise.all([...document.images].filter(image => image.loading !== 'lazy').map(image => image.decode().catch(() => {}))),
    new Promise(resolve => setTimeout(resolve, 2500)),
  ]));
  await page.waitForTimeout(250);
}
async function load(page, viewport, venue, extra = '') {
  const query = new URLSearchParams(venue.encounter ? { encounter: venue.encounter } : { rival: venue.rival });
  if (venue.locations) query.set('locations', venue.locations);
  await page.goto(`${origin}/e2e/battle-mobile.fixture.html?${query}${extra}`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('battle-arena').waitFor();
  await settleArt(page, viewport, venue);
}
async function artGeometry(page, viewport, venue, expectedFit) {
  const art = await page.locator('picture.battle-venue__art > img').evaluate(image => {
    const rectangle = node => {
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    const css = getComputedStyle(image);
    return {
      source: image.currentSrc, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
      fit: css.objectFit, position: css.objectPosition, transform: getComputedStyle(image.parentElement).transform,
      image: rectangle(image), picture: rectangle(image.parentElement),
      venue: rectangle(image.closest('.battle-venue')), arena: rectangle(image.closest('[data-testid="battle-arena"]')),
    };
  });
  assert.equal(await page.getByTestId('battle-arena').getAttribute('data-venue'), venue.id);
  assert.equal(art.fit, expectedFit, 'wallpaper uses the intended viewport sizing rule');
  assert.equal(art.transform, 'none', 'wallpaper canvas has no magnifying transform');
  assert.ok(art.naturalWidth > 0 && art.naturalHeight > 0, 'authored wallpaper is decoded');
  const expectedRatio = viewport.width < viewport.height ? 941 / 1672 : (venue.landscapeRatio ?? 1424 / 800);
  near(art.naturalWidth / art.naturalHeight, expectedRatio, 'authored source aspect ratio', 0.001);
  assert.equal(await page.locator('.location-wallpaper').count(), 0, 'no full-height location photographs sit over the battlefield');
  const locationNodes = await page.locator('.district-target .location-node__scene').evaluateAll(nodes => nodes.map(image => {
    const box = image.getBoundingClientRect();
    return { loaded: image.complete && image.naturalWidth > 0, width: box.width, height: box.height };
  }));
  assert.equal(locationNodes.length, 3, 'each district retains its floating location artwork');
  assert.ok(locationNodes.every(node => node.loaded && node.width > 0 && node.height > 0), 'floating location artwork remains loaded and visible');
  const expectedFile = viewport.width < viewport.height ? venue.portrait : venue.landscape;
  assert.ok(new URL(art.source).pathname.endsWith(`/${expectedFile}`), 'picture chooses the authored orientation');
  for (const box of [art.image, art.picture, art.venue]) {
    for (const key of ['x', 'y', 'width', 'height']) near(box[key], art.arena[key], `wallpaper canvas ${key}`);
  }
  // CSS object fitting scales both source dimensions by the same factor. Compute
  // its visible bounds to detect letterbox gaps without treating intended crops
  // as distortion or changing the image's natural aspect ratio.
  const ratios = [art.image.width / art.naturalWidth, art.image.height / art.naturalHeight];
  const scale = expectedFit === 'cover' ? Math.max(...ratios) : Math.min(...ratios);
  const rendered = { width: art.naturalWidth * scale, height: art.naturalHeight * scale };
  near(rendered.width / rendered.height, art.naturalWidth / art.naturalHeight, 'uniform artwork aspect ratio', 0.00001);
  if (expectedFit === 'cover') {
    assert.equal(art.position, '50% 50%', 'filled composition remains centered');
    assert.ok(rendered.width >= art.arena.width - 1 && rendered.height >= art.arena.height - 1,
      'wallpaper fills the complete battlefield without letterbox gaps');
  } else {
    assert.equal(art.position, viewport.width < viewport.height ? '50% 0%' : '50% 50%', 'non-tablet positioning is preserved');
    assert.ok(rendered.width <= art.arena.width + 1 && rendered.height <= art.arena.height + 1,
      'non-tablet authored composition remains contained');
  }
  return { ...art, scale, rendered, crop: { horizontal: Math.max(0, rendered.width - art.arena.width), vertical: Math.max(0, rendered.height - art.arena.height) } };
}
async function hudGeometry(page, viewport) {
  const board = await page.locator('.battlefield-grid').boundingBox();
  assert.ok(board?.width > 0 && board.height > 0, 'battlefield grid retains a visible footprint');
  const cards = await page.locator('[data-card-zone="board"]').evaluateAll(nodes => nodes.map(node => {
    const box = node.getBoundingClientRect(); return { width: box.width, height: box.height };
  }));
  assert.equal(cards.length, 22, 'all fighters remain on the board');
  assert.ok(cards.every(card => card.width > 0 && card.height > 0), 'no fighter collapses after wallpaper sizing');
  const boxes = {};
  for (const [name, locator] of [
    ['speed', page.getByTestId('button-battle-speed')],
    ['action', page.locator('.battle-primary-action')],
    ['hand', page.locator('[data-card-zone="hand"]').first()],
    ['timer', page.getByTestId('decision-clock')],
    ['topTimer', page.getByTestId('turn-timer')],
    ['menu', page.locator('.battle-tools > summary')],
  ]) {
    assert.ok(await locator.isVisible(), `${name} stays visible`);
    boxes[name] = await locator.boundingBox();
    withinViewport(boxes[name], viewport, name);
  }
  assert.ok(boxes.speed.width <= 64, 'speed control remains compact');
  await page.getByTestId('button-battle-speed').click({ trial: true });
  await page.locator('.battle-primary-action').click({ trial: true });
  await page.locator('.battle-tools > summary').click({ trial: true });
  const track = await page.locator('.decision-clock-track').boundingBox();
  assert.ok(track && track.width > 100 && track.height > 0, 'bottom countdown track remains visible');
  assert.equal(await page.getByTestId('decision-clock').getAttribute('data-state'), 'calm');
  return { board, cards, ...boxes, track };
}
async function matchFingerprint(page) {
  return page.evaluate(() => ({
    phase: document.querySelector('[data-testid="battle-arena"]').dataset.presentationPhase,
    venue: document.querySelector('[data-testid="battle-arena"]').dataset.venue,
    selected: document.querySelector('[data-card-zone="hand"][aria-pressed="true"]')?.getAttribute('data-instance-id'),
    lane: document.querySelector('.district-target[aria-pressed="true"]')?.getAttribute('data-testid'),
    hand: [...document.querySelectorAll('[data-card-zone="hand"]')].map(node => node.getAttribute('data-testid')),
    board: [...document.querySelectorAll('[data-card-zone="board"]')].map(node => node.getAttribute('data-testid')),
    scores: [...document.querySelectorAll('[data-testid^="score-"]')].map(node => node.textContent),
    timer: document.querySelector('[data-testid="turn-timer"] strong')?.textContent,
    progress: document.querySelector('.decision-clock-track i')?.style.transform,
  }));
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const report = { tabletCases: [], rotations: [], desktopCases: [], storyCases: [], regressions: [], fixtureValidation: [] };
  let currentPage;
  const save = () => fs.writeFileSync(path.join(output, 'browser.json'), JSON.stringify(report, null, 2));
  try {
    for (const [width, height] of tabletPairs.flat()) {
      const viewport = { width, height };
      const page = currentPage = await browser.newPage({ viewport, isMobile: true, hasTouch: true });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      for (const venue of venues) {
        await load(page, viewport, venue);
        const art = await artGeometry(page, viewport, venue, 'cover');
        const hud = await hudGeometry(page, viewport);
        if (venue.rival === 'combo') await page.screenshot({ path: path.join(output, `${width}x${height}-tablet-overview.png`) });
        report.tabletCases.push({ ...viewport, venue: venue.id, art, hud });
        save();
      }
      assert.deepEqual(errors, [], 'tablet fixtures report no runtime errors');
      console.log(`${width}x${height}: all five venues fill the battlefield, HUD and cards passed`);
      await page.close(); currentPage = null;
    }
    for (const [portrait, landscape] of tabletPairs) {
      const start = { width: portrait[0], height: portrait[1] };
      const rotated = { width: landscape[0], height: landscape[1] };
      const venue = venues.find(venue => venue.rival === 'combo');
      const page = currentPage = await browser.newPage({ viewport: start, isMobile: true, hasTouch: true });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await load(page, start, venue);
      await page.locator('[data-card-zone="hand"]').first().click();
      await page.getByTestId('lane-0').click();
      await page.waitForTimeout(350);
      const fingerprint = await matchFingerprint(page);
      assert.ok(fingerprint.selected && fingerprint.lane, 'a selected card and district are set before rotation');
      const stages = [];
      for (const [label, viewport] of [['landscape', rotated], ['portrait', start]]) {
        await page.setViewportSize(viewport);
        await settleArt(page, viewport, venue);
        const art = await artGeometry(page, viewport, venue, 'cover');
        const hud = await hudGeometry(page, viewport);
        assert.deepEqual(await matchFingerprint(page), fingerprint, 'rotation preserves selected card, district, match, and clock');
        await page.screenshot({ path: path.join(output, `${viewport.width}x${viewport.height}-tablet-rotated-selection.png`) });
        stages.push({ orientation: label, ...viewport, art, hud });
      }
      assert.deepEqual(errors, [], 'rotation reports no runtime errors');
      report.rotations.push({ start, fingerprint, stages, errors }); save();
      console.log(`${start.width}x${start.height} ↔ ${rotated.width}x${rotated.height}: selection, match, timer preserved`);
      await page.close(); currentPage = null;
    }
    for (const [width, height] of desktops) {
      const viewport = { width, height };
      const page = currentPage = await browser.newPage({ viewport });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      for (const venue of venues) {
        await load(page, viewport, venue);
        const art = await artGeometry(page, viewport, venue, 'cover');
        const hud = await hudGeometry(page, viewport);
        report.desktopCases.push({ ...viewport, venue: venue.id, art, hud }); save();
      }
      assert.deepEqual(errors, [], 'desktop fixtures report no runtime errors');
      console.log(`${width}x${height}: all five wide venue compositions fill the board, floating locations and HUD passed`);
      await page.close(); currentPage = null;
    }
    for (const venue of storyCases) {
      for (const [width, height] of venue.viewports) {
        const viewport = { width, height };
        const touch = width < 1400;
        const page = currentPage = await browser.newPage({ viewport, isMobile: touch, hasTouch: touch });
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await load(page, viewport, venue);
        const expectedFit = width === 390 ? 'contain' : 'cover';
        const art = await artGeometry(page, viewport, venue, expectedFit);
        const hud = await hudGeometry(page, viewport);
        if (venue.encounter === 'red-tapes-side-eye-security') {
          assert.equal(await page.locator('.battle-rival-copy').innerText().then(text => /wifey/i.test(text)), true, 'real Wifey encounter is rendered');
          assert.deepEqual(await page.locator('.district-lane').evaluateAll(nodes => nodes.map(node => node.dataset.location)), ['nail-salon', 'vip-section', 'penthouse'], 'screenshot locations are reproduced');
          if (width === 1920 || width === 3440) await page.screenshot({ path: path.join(output, `${width}x${height}-wifey-desktop.png`) });
        }
        assert.deepEqual(errors, [], 'issued story fixture reports no runtime errors');
        report.storyCases.push({ ...viewport, encounter: venue.encounter, art, hud, errors }); save();
        console.log(`${width}x${height}: ${venue.encounter} uses the intended ${expectedFit} artwork`);
        await page.close(); currentPage = null;
      }
    }
    for (const viewport of regressions) {
      const venue = venues.find(venue => venue.rival === 'combo');
      const page = currentPage = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.touch, hasTouch: viewport.touch });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await load(page, viewport, venue);
      const expectedFit = viewport.width < viewport.height ? 'contain' : 'cover';
      const art = await artGeometry(page, viewport, venue, expectedFit);
      const hud = await hudGeometry(page, viewport);
      await page.screenshot({ path: path.join(output, `${viewport.width}x${viewport.height}-regression.png`) });
      assert.deepEqual(errors, [], 'non-tablet fixture reports no runtime errors');
      report.regressions.push({ ...viewport, art, hud, errors }); save();
      console.log(`${viewport.width}x${viewport.height}: authored ${expectedFit} sizing and HUD preserved`);
      await page.close(); currentPage = null;
    }
    const page = currentPage = await browser.newPage({ viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true });
    for (const query of ['', '?rival=not-a-real-deck']) {
      await page.goto(`${origin}/e2e/battle-mobile.fixture.html${query}`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('battle-arena').waitFor();
      assert.equal(await page.getByTestId('battle-arena').getAttribute('data-venue'), 'civic-hill', 'missing or invalid rival preserves the default fixture match');
      report.fixtureValidation.push({ query, venue: 'civic-hill' });
    }
    await page.close(); currentPage = null;
    save();
  } catch (error) {
    if (currentPage && !currentPage.isClosed()) await currentPage.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
    fs.writeFileSync(path.join(output, 'failure.txt'), String(error.stack || error));
    throw error;
  } finally {
    await browser.close();
  }
  console.log(`Battle wallpaper evidence: ${output}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
