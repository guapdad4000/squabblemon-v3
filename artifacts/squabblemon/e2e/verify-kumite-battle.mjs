import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const origin = process.env.KUMITE_ORIGIN ?? 'http://127.0.0.1:43217';
const output = process.env.KUMITE_OUTPUT ?? fileURLToPath(new URL('../../deliverables/kumite-20261012/browser/gameplay/', import.meta.url));
const assets = fileURLToPath(new URL('../public/', import.meta.url));
await mkdir(output, { recursive: true });
const alpha = [];
for (const path of ['assets/kumite/layers/stands.webp', 'assets/kumite/layers/platform.webp',
  'assets/kumite/outcomes/franklin-duke-win.webp', 'assets/kumite/outcomes/chonk-lee-loss.webp',
  'assets/kumite/outcomes/bushedo-brown-win.webp', 'assets/kumite/outcomes/bushedo-brown-loss.webp',
  'assets/characters/franklin-duke.webp', 'assets/characters/chonk-lee.webp', 'assets/characters/bushedo-brown.webp']) {
  const metadata = await sharp(assets + path).metadata();
  const statistics = await sharp(assets + path).stats();
  assert.equal(metadata.hasAlpha, true, `${path} must preserve alpha`);
  const channel = statistics.channels.at(-1);
  assert.equal(channel.min, 0, `${path} must have transparent pixels`);
  assert(channel.max >= 128, `${path} must retain visible pixels`);
  alpha.push({ path, hasAlpha: true, alphaMin: channel.min, alphaMax: channel.max });
}
const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'],
  ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const platformPixels = await sharp(assets + 'assets/kumite/layers/platform.webp').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const platformCenterX = Math.floor(platformPixels.info.width / 2);
let platformBackSourceY = 0;
for (let row = 0; row < platformPixels.info.height; row++) {
  if (platformPixels.data[(row * platformPixels.info.width + platformCenterX) * 4 + 3] > 200) { platformBackSourceY = row; break; }
}
const report = [];
const issues = [];
function check(value, message) { if (!value) issues.push(message); }
async function bounds(locator) { return locator.evaluate(element => {
  const box = element.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom };
}); }
try {
  for (const [name, width, height] of [['phone', 390, 844], ['desktop', 1440, 960], ['small-phone', 320, 568], ['tablet', 768, 1024], ['landscape', 844, 390]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(`[${name}] ${error.message}`); });
    await page.goto(`${origin}/e2e/kumite-battle.fixture.html?mode=active`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('online-battle').waitFor();
    await page.waitForFunction(() => window.kumiteBattleReview?.view().status === 'active');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.querySelectorAll('img')].filter(image => image.getBoundingClientRect().width > 0).every(image => image.complete && image.naturalWidth > 0));
    const state = await page.evaluate(() => window.kumiteBattleReview.view());
    check(state.boards.every(lane => lane.length > 0), `${name}: authored real board has three occupied lanes`);
    check(await page.locator('.kumite-arena-scene').count() === 1, `${name}: exactly one layered venue`);
    check(await page.locator('.kumite-arena-scene__platform').count() === 0, `${name}: platform does not render twice`);
    const platform = await page.locator('.battlefield-grid').evaluate(element => getComputedStyle(element, '::before').backgroundImage);
    const platformPlacement = await page.locator('.battlefield-grid').evaluate(element => ({
      size: getComputedStyle(element, '::before').backgroundSize,
      position: getComputedStyle(element, '::before').backgroundPosition,
      top: getComputedStyle(element, '::before').top,
      bottom: getComputedStyle(element, '::before').bottom,
      height: getComputedStyle(element, '::before').height,
      width: getComputedStyle(element, '::before').width,
      playerZones: [...element.querySelectorAll('.battle-side-player')].map(zone => { const box = zone.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }; }),
      rivalZones: [...element.querySelectorAll('.battle-side-rival')].map(zone => { const box = zone.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }; }),
    }));
    check(platform.includes('platform.webp'), `${name}: supplied platform forms the battle foreground`);
    const oldVenue = await page.locator('.battle-venue').evaluateAll(elements => elements.every(element => getComputedStyle(element).display === 'none'));
    const oldDecor = await page.locator('.world-decor').evaluateAll(elements => elements.every(element => getComputedStyle(element).display === 'none'));
    check(oldVenue, `${name}: original venue hidden for Kumite`);
    check(oldDecor, `${name}: unrelated venue decoration hidden for Kumite`);
    const activeBounds = { grid: await bounds(page.locator('.battlefield-grid')), command: await bounds(page.getByTestId('battle-command-deck')),
      lanes: await Promise.all([0, 1, 2].map(lane => bounds(page.getByTestId(`lane-${lane}`)))) };
    // The supplied platform has a transparent upper canvas. Map its actual opaque
    // back edge into viewport pixels instead of treating the pseudo-element top
    // as the arena edge. Compare the resulting natural perspective against the
    // previous stretched framing; opponent cards need not overlap this plane.
    const platformHeight = parseFloat(platformPlacement.height);
    const platformWidth = parseFloat(platformPlacement.width);
    const platformTop = parseFloat(platformPlacement.top);
    const backgroundParts = platformPlacement.size.split(' ');
    let imageWidth;
    let imageHeight;
    if (backgroundParts[0] === 'cover' || backgroundParts[0] === 'contain') {
      const scale = (backgroundParts[0] === 'cover' ? Math.max : Math.min)(platformWidth / platformPixels.info.width, platformHeight / platformPixels.info.height);
      imageWidth = scale * platformPixels.info.width;
      imageHeight = scale * platformPixels.info.height;
    } else {
      imageWidth = backgroundParts[0].endsWith('%') ? platformWidth * parseFloat(backgroundParts[0]) / 100 : parseFloat(backgroundParts[0]);
      imageHeight = backgroundParts.at(-1) === 'auto' ? imageWidth * platformPixels.info.height / platformPixels.info.width
        : backgroundParts.at(-1).endsWith('%') ? platformHeight * parseFloat(backgroundParts.at(-1)) / 100 : parseFloat(backgroundParts.at(-1));
    }
    const imageOffsetY = (platformHeight - imageHeight) * parseFloat(platformPlacement.position.split(' ').at(-1)) / 100;
    const materialEdgeOffset = imageOffsetY + platformBackSourceY / platformPixels.info.height * imageHeight;
    const previousTop = width <= 600 ? 26 : -10;
    const previousHeight = activeBounds.grid.height + (width <= 600 ? -26 : 20);
    const previousImageHeight = previousHeight * 5.3;
    const matAlignment = {
      sourceSize: { width: platformPixels.info.width, height: platformPixels.info.height },
      renderedImageSize: { width: imageWidth, height: imageHeight },
      sourceBackEdgeRow: platformBackSourceY,
      backEdgeY: activeBounds.grid.y + platformTop + materialEdgeOffset,
      previousBackEdgeY: activeBounds.grid.y + previousTop + (previousHeight - previousImageHeight) * .8 + platformBackSourceY / platformPixels.info.height * previousImageHeight,
      sourceAspectRatio: platformPixels.info.width / platformPixels.info.height,
      renderedAspectRatio: imageWidth / imageHeight,
      visibleMatBelowBackEdge: activeBounds.grid.bottom - (activeBounds.grid.y + platformTop + materialEdgeOffset),
    };
    matAlignment.downwardShift = matAlignment.backEdgeY - matAlignment.previousBackEdgeY;
    check(Math.abs(matAlignment.renderedAspectRatio - matAlignment.sourceAspectRatio) < .001, `${name}: supplied mat retains its natural aspect ratio`);
    check(matAlignment.downwardShift >= (name === 'landscape' ? 15 : 35), `${name}: illustrated mat moves materially downward from former framing`);
    check(matAlignment.backEdgeY >= activeBounds.grid.y + activeBounds.grid.height * .4, `${name}: mat reads as a lower foreground plane`);
    check(matAlignment.visibleMatBelowBackEdge >= Math.min(24, activeBounds.grid.height * .12), `${name}: lowered natural mat remains visible below its back edge`);
    const gallery = await page.locator('.kumite-arena-scene__stands').evaluate(element => { const box = element.getBoundingClientRect();
      return { className: element.parentElement.className, top: getComputedStyle(element).top, height: getComputedStyle(element).height,
        objectPosition: getComputedStyle(element).objectPosition, bounds: { x: box.x, y: box.y, width: box.width, height: box.height } }; });
    for (const [index, box] of activeBounds.lanes.entries()) check(box.x >= -1 && box.y >= -1 && box.right <= width + 1 && box.bottom <= height + 1 && box.width > 0 && box.height > 0, `${name}: lane ${index} stays inside viewport`);
    check(activeBounds.command.bottom <= height + 1 && activeBounds.command.y >= -1, `${name}: command deck stays inside viewport`);
    await page.mouse.move(width - 5, height - 5);
    const motion = await page.locator('.kumite-arena-scene').evaluate(element => ({ x: element.style.getPropertyValue('--arena-x'),
      y: element.style.getPropertyValue('--arena-y'), transforms: [...element.querySelectorAll('img')].map(image => getComputedStyle(image).transform) }));
    check(motion.x === '' && motion.y === '' && motion.transforms.every(transform => transform === 'none'), `${name}: reduced motion disables parallax transforms`);
    await page.screenshot({ path: `${output}/battle-${name}.png`, fullPage: true });
    const playable = state.hand.find(card => card.costs[0] <= state.motion.player);
    assert(playable, 'real current hand has an affordable fighter');
    await page.getByTestId(`card-${playable.artworkId ?? playable.cardId}`).click();
    await page.getByTestId('lane-0').click();
    await page.getByTestId('button-lock').click();
    await page.waitForFunction(() => window.kumiteBattleReview.commands.some(command => command.type === 'play'));
    const played = await page.evaluate(() => window.kumiteBattleReview.commands);
    check(played.length === 1 && played[0].type === 'play' && played[0].lane === 0 && played[0].instanceId === playable.instanceId, `${name}: card and lane controls send one real legal play`);
    await page.getByTestId('button-next-round').click();
    await page.waitForFunction(() => window.kumiteBattleReview.commands.some(command => command.type === 'end-turn'));
    check(await page.getByTestId('online-battle').getAttribute('data-turn') === 'rival', `${name}: End Turn reaches the rival turn`);
    const overflow = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    check(overflow.document <= width, `${name}: no page horizontal overflow`);
    report.push({ name: `battle-${name}`, viewport: { width, height }, proof: 'isolated fixture with shared legal engine commands', activeBounds, platform, platformPlacement, matAlignment, gallery, oldVenueHidden: oldVenue, oldDecorHidden: oldDecor, reducedMotion: motion, commands: played, overflow, pageErrors: [...errors] });
    for (const [mode, hero, title] of [['win', 'franklin-duke', 'KUMITE CHAMPION.'], ['loss', 'chonk-lee', 'RESPECT THE FIGHT.'], ['draw', 'franklin-duke', 'RUN IT AGAIN.'], ['win', 'bushedo-brown', 'KUMITE CHAMPION.'], ['loss', 'bushedo-brown', 'RESPECT THE FIGHT.']]) {
      await page.goto(`${origin}/e2e/kumite-battle.fixture.html?mode=${mode}&hero=${hero}`, { waitUntil: 'domcontentloaded' });
      const dialog = page.getByTestId('kumite-result-dialog');
      await dialog.waitFor().catch(async error => { console.error({ mode, hero, viewport: name, status: await page.evaluate(() => window.kumiteBattleReview?.view().status), pageErrors: errors }); throw error; });
      await page.getByRole('heading', { name: title, exact: true }).waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('.kumite-result__scene img')].every(image => image.complete && image.naturalWidth > 0));
      check(await page.getByRole('button', { name: /rematch/i }).count() === 0, `${mode}-${name}: no tournament rematch command`);
      const heroSource = await page.locator('.kumite-result__fighter').getAttribute('src');
      if (mode !== 'draw') check(heroSource.includes(`outcomes/${hero}-${mode}.webp`), `${mode}-${name}: correct supplied outcome pose`);
      const loaded = await page.locator('.kumite-result__scene img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0));
      check(loaded, `${mode}-${name}: scene images loaded`);
      const dialogBounds = await bounds(dialog);
      check(dialogBounds.x >= -1 && dialogBounds.y >= -1 && dialogBounds.right <= width + 1 && dialogBounds.bottom <= height + 1, `${mode}-${name}: result dialog fits viewport`);
      const exit = page.getByRole('button', { name: 'Back to Kumite', exact: true });
      await exit.scrollIntoViewIfNeeded();
      const exitBounds = await bounds(exit);
      check(exitBounds.y >= -1 && exitBounds.bottom <= height + 1 && exitBounds.x >= -1 && exitBounds.right <= width + 1, `${mode}-${name}: result action remains reachable`);
      const outcomeName = hero === 'bushedo-brown' ? `${hero}-${mode}-${name}` : `${mode}-${name}`;
      await page.screenshot({ path: `${output}/${outcomeName}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Inspect final board', exact: true }).last().click();
      await page.getByRole('button', { name: 'View result', exact: true }).waitFor();
      check(await page.getByRole('dialog').count() === 0, `${mode}-${name}: final board inspection closes result`);
      await page.getByRole('button', { name: 'View result', exact: true }).click();
      await dialog.waitFor();
      await exit.click();
      await page.waitForFunction(() => window.kumiteBattleReview.leaves === 1);
      check(await page.evaluate(() => window.kumiteBattleReview.commands.length) === 0, `${mode}-${name}: Back to Kumite exits without match commands`);
      report.push({ name: outcomeName, viewport: { width, height }, heroSource, title, dialogBounds, exitBounds, sceneImagesLoaded: loaded, inspectionReopened: true, safeExit: true, pageErrors: [...errors] });
    }
    check(errors.length === 0, `${name}: no browser errors (${errors.join('; ')})`);
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const now = Date.now();
  const empty = { tournament: { id: 'parallax-review', weekLabel: 'Isolated browser review', status: 'registration',
    registrationOpensAt: now, startsAt: now + 86400000, endsAt: now + 151200000, capacity: 8, poolCount: 1, poolSize: 8,
    entrants: [], pools: [], finals: [], champion: null }, registration: null, currentMatch: null,
    progression: { completedMatches: 0, matchWins: 0, championships: 0, rewards: [] }, serverTime: now,
    rules: { roundHours: 6, turnSeconds: 75, deckSize: 10, minimumEntrants: 2 } };
  await page.route('**/api/kumite/**', route => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify(route.request().url().endsWith('/winners') ? { winners: [], serverTime: now } : empty) }));
  await page.goto(`${origin}/e2e/kumite.fixture.html?view=arena&motion=full`, { waitUntil: 'domcontentloaded' });
  await page.locator('.kumite-arena-scene').waitFor();
  await page.mouse.move(1435, 955);
  await page.waitForFunction(() => document.querySelector('.kumite-arena-scene').style.getPropertyValue('--arena-x') !== '');
  const normal = await page.locator('.kumite-arena-scene').evaluate(element => ({ x: element.style.getPropertyValue('--arena-x'),
    y: element.style.getPropertyValue('--arena-y'), transforms: [...element.querySelectorAll('img')].map(image => getComputedStyle(image).transform) }));
  check(Math.abs(parseFloat(normal.x)) <= 5 && Math.abs(parseFloat(normal.y)) <= 3 && parseFloat(normal.x) > 0,
    'real Kumite page: normal pointer parallax stays bounded to 5px/3px');
  await page.screenshot({ path: `${output}/page-parallax-normal.png`, fullPage: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.mouse.move(20, 20);
  await page.waitForFunction(() => [...document.querySelectorAll('.kumite-arena-scene img')].every(image => getComputedStyle(image).transform === 'none'), null, { timeout: 5000 });
  const reduced = await page.locator('.kumite-arena-scene').evaluate(element => ({ x: element.style.getPropertyValue('--arena-x'),
    y: element.style.getPropertyValue('--arena-y'), transforms: [...element.querySelectorAll('img')].map(image => getComputedStyle(image).transform) }));
  check(reduced.x === '' && reduced.y === '' && reduced.transforms.every(transform => transform === 'none'),
    'real Kumite page: media reduced motion clears parallax and transforms');
  await page.screenshot({ path: `${output}/page-parallax-reduced.png`, fullPage: true });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${origin}/e2e/kumite.fixture.html?view=arena&motion=reduced`, { waitUntil: 'domcontentloaded' });
  await page.locator('.kumite-arena-scene').waitFor();
  await page.mouse.move(1435, 955);
  const profile = await page.locator('.kumite-arena-scene').evaluate(element => ({ x: element.style.getPropertyValue('--arena-x'), y: element.style.getPropertyValue('--arena-y') }));
  check(profile.x === '' && profile.y === '', 'real Kumite page: profile reduced motion prevents pointer parallax');
  report.push({ name: 'real-page-parallax', normal, mediaReduced: reduced, profileReduced: profile });
  await context.close();
  const data = { passed: issues.length === 0, screenshots: report.filter(entry => entry.name !== 'real-page-parallax').length + 2, alpha, issues, checks: report };
  await writeFile(`${output}/gameplay-report.json`, JSON.stringify(data, null, 2));
  console.log(JSON.stringify(data, null, 2));
  assert.deepEqual(issues, [], 'Kumite battle visual/interaction proof must satisfy all checks');
} finally { await browser.close(); }
