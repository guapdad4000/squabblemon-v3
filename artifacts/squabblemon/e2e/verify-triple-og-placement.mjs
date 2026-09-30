import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const origin = process.env.DRAG_ORIGIN ?? 'http://127.0.0.1:80';
const fixture = `${origin}/e2e/battle-drag.fixture.html`;
const here = dirname(fileURLToPath(import.meta.url));
const screenshots = resolve(here, '../../../screenshots');
const evidence = [];
const errors = [];

let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
} catch {
  // CI/Replit images may only include Playwright's managed Chromium.
  browser = await chromium.launch({ headless: true });
}

const position = async locator => {
  const box = await locator.boundingBox();
  assert(box, 'Expected an on-screen target for the browser interaction');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

async function drag(page, card, lane, touch) {
  await card.scrollIntoViewIfNeeded();
  await lane.scrollIntoViewIfNeeded();
  const start = await position(card);
  const end = await position(lane);
  if (!touch) {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x, start.y - 24, { steps: 3 });
    await page.mouse.move(end.x, end.y, { steps: 12 });
    await lane.waitFor({ state: 'visible' });
    return { release: async () => page.mouse.up() };
  }
  const cdp = await page.context().newCDPSession(page);
  const point = (x, y) => [{ x, y, radiusX: 5, radiusY: 5, force: 1, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(start.x, start.y) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(start.x, start.y - 25) });
  for (let step = 1; step <= 10; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: point(start.x + (end.x - start.x) * step / 10, start.y - 25 + (end.y - start.y + 25) * step / 10),
    });
  }
  return { release: async () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) };
}

async function tap(page, target, touch) {
  const at = await position(target);
  if (!touch) {
    await page.mouse.click(at.x, at.y);
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  const point = [{ x: at.x, y: at.y, radiusX: 5, radiusY: 5, force: 1, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function runCase(side, platform) {
  const touch = platform === 'phone';
  const reducedMotion = platform !== 'desktop-normal';
  const targetLane = side === 'blue' ? 0 : 2;
  const blockedLane = side === 'blue' ? 2 : 0;
  const context = await browser.newContext({
    viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    hasTouch: touch,
    isMobile: touch,
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`${platform}/${side}: ${error.message}`));
  const url = `${fixture}?tripleOg=${side}`;
  await page.goto(url);

  const evidenceNode = page.getByTestId('triple-og-evidence');
  await evidenceNode.waitFor({ state: 'attached' });
  const initialMotion = await evidenceNode.getAttribute('data-motion');
  assert.equal(initialMotion, '9');
  const card = page.locator(`[data-battle-draggable="true"][data-card-id="triple-og-${side}"]`);
  await card.waitFor();
  const blueAllyPowersBefore = side === 'blue'
    ? await page.locator('[data-card-zone="board"][data-card-id="hooper"]').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('data-card-power'))))
    : [];
  const blueSnowPowerBefore = side === 'blue'
    ? Number(await page.locator('[data-testid="lane-0-cpu-zone"] [data-card-id="snow-bunny"]').getAttribute('data-card-power'))
    : null;

  // Merely selecting Cooky used to crash while Battle eagerly previewed all lanes.
  await card.click();
  assert.deepEqual(errors, [], `Selecting ${side} must not raise a browser pageerror`);
  assert.equal(await card.getAttribute('aria-pressed'), 'true');
  const validLane = page.locator(`[data-testid="lane-${targetLane}"]`);
  const invalidLane = page.locator(`[data-testid="lane-${blockedLane}"]`);
  await validLane.waitFor();
  assert.equal(await validLane.getAttribute('aria-disabled'), 'false', 'the home district is enabled');
  assert.equal(await invalidLane.getAttribute('aria-disabled'), 'true', 'the opposite district is blocked');
  assert.match(await page.locator(`[data-drop-lane="${targetLane}"]`).getAttribute('class'), /is-legal/);
  assert.match(await page.locator(`[data-drop-lane="${blockedLane}"]`).getAttribute('class'), /is-illegal/);
  await page.screenshot({ path: resolve(screenshots, `triple-og-${side}-${platform}-selected.png`) });

  // An illegal tap cannot choose a destination, spend Motion, or remove Cooky.
  // Playwright refuses locator.click() on aria-disabled controls, so use the
  // physical pointer coordinates to verify a real attempted tap is harmless.
  await tap(page, invalidLane, touch);
  assert.equal(await card.count(), 1);
  assert.equal(await evidenceNode.getAttribute('data-play-count'), '0');
  assert.equal(await evidenceNode.getAttribute('data-motion'), '9');
  assert.equal(await invalidLane.getAttribute('aria-pressed'), 'false');
  const ogCostText = await page.locator(`[data-testid="preview-lane-${targetLane}"]`).textContent();
  const ogCost = Number(ogCostText?.match(/Costs (\d+) Motion/)?.[1]);
  assert(Number.isFinite(ogCost), `Expected a real preview cost for the ${side} home district`);

  // Check a genuine pointer/touch drop is rejected too, without mutating the match.
  const rejected = await drag(page, card, page.locator(`[data-drop-lane="${blockedLane}"]`), touch);
  assert.equal(await page.locator(`[data-drop-lane="${blockedLane}"]`).getAttribute('data-drop-state'), 'blocked');
  await rejected.release();
  assert.equal(await card.count(), 1);
  assert.equal(await evidenceNode.getAttribute('data-play-count'), '0');
  assert.equal(await evidenceNode.getAttribute('data-motion'), '9');

  if (touch) {
    const legal = await drag(page, card, page.locator(`[data-drop-lane="${targetLane}"]`), true);
    assert.equal(await page.locator(`[data-drop-lane="${targetLane}"]`).getAttribute('data-drop-state'), 'ready');
    await legal.release();
  } else {
    await validLane.click();
    const play = page.getByTestId('button-lock');
    await play.waitFor();
    assert.equal(await play.isDisabled(), false);
    await play.click();
  }

  await page.locator(`[data-card-zone="board"][data-card-id="triple-og-${side}"]`).waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="triple-og-evidence"]')?.getAttribute('data-play-count') === '1');
  assert.equal(Number(await evidenceNode.getAttribute('data-motion')), Number(initialMotion) - ogCost,
    'playing the OG spends exactly its legal preview cost once');
  assert.equal(await evidenceNode.getAttribute('data-hand-count'), '1');
  assert.equal(await page.locator(`[data-card-zone="board"][data-card-id="triple-og-${side}"]`).count(), 1);
  assert.equal(await page.locator(`[data-testid="lane-${targetLane}-player-zone"] [data-card-id="triple-og-${side}"]`).count(), 1);

  if (side === 'blue') {
    // The starting board has three eligible allies. Homage raises Cooky from 6 to 9,
    // and the weakest rival moves out of the losing left district.
    await page.waitForFunction(target => {
      const card = document.querySelector('[data-card-zone="board"][data-card-id="snow-bunny"]');
      return card?.closest('[data-drop-lane]')?.getAttribute('data-drop-lane') !== String(target);
    }, targetLane);
    const movedSnow = page.locator('[data-card-zone="board"][data-card-id="snow-bunny"]');
    assert.equal(await movedSnow.count(), 1);
    const snowLane = Number(await movedSnow.evaluate(node => node.closest('[data-drop-lane]')?.getAttribute('data-drop-lane')));
    assert.notEqual(snowLane, targetLane, 'the weakest rival left Cooky’s losing lane');
    assert.equal(Number(await movedSnow.getAttribute('data-card-power')), blueSnowPowerBefore - 1);
    assert.equal(await page.locator('[data-testid="lane-0-cpu-zone"] [data-card-id="snow-bunny"]').count(), 0);
    assert.equal(await page.locator(`[data-card-zone="board"][data-card-id="triple-og-blue"]`).getAttribute('data-card-power'), '9');
    const blueAllyPowersAfter = await page.locator('[data-card-zone="board"][data-card-id="hooper"]').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('data-card-power'))));
    assert.equal(blueAllyPowersAfter.length, 3);
    assert.deepEqual(blueAllyPowersAfter, blueAllyPowersBefore.map(power => power - 1), 'all three allies paid one Hand of Homage');
  } else {
    assert.equal(await page.locator(`[data-testid="lane-${targetLane}-player-zone"] [data-card-id="triple-og-red"]`).count(), 1);
  }

  await page.screenshot({ path: resolve(screenshots, `triple-og-${side}-${platform}-resolved.png`) });

  // A normal card can still be selected and played after the Triple OG effect.
  const followUp = page.locator('[data-battle-draggable="true"][data-card-id="plug"]');
  await followUp.waitFor();
  await followUp.click();
  await page.locator('[data-testid="lane-1"]').click();
  const followPlay = page.getByTestId('button-lock');
  await followPlay.waitFor();
  assert.equal(await followPlay.isDisabled(), false);
  const followLabel = await followPlay.innerText();
  const followCost = Number(followLabel.match(/Play card · (\d+) Motion/i)?.[1]);
  assert(Number.isFinite(followCost), `Expected the selected follow-up card to expose its real Motion cost: ${followLabel}`);
  await followPlay.click();
  await page.locator('[data-card-zone="board"][data-card-id="plug"]').waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="triple-og-evidence"]')?.getAttribute('data-play-count') === '2');
  assert.equal(Number(await evidenceNode.getAttribute('data-motion')), Number(initialMotion) - ogCost - followCost);
  assert.equal(await evidenceNode.getAttribute('data-hand-count'), '0');
  assert.equal(await page.locator('[data-card-zone="board"][data-card-id="plug"]').count(), 1);
  assert.deepEqual(errors, [], `The ${side} flow must remain free of browser pageerrors`);

  evidence.push({
    side,
    platform,
    reducedMotion,
    interaction: touch ? 'CDP touch drag' : 'tap + Play',
    rejectedInteraction: touch ? 'illegal tap + CDP touch drop' : 'illegal tap + mouse drop',
    targetLane,
    playCount: Number(await evidenceNode.getAttribute('data-play-count')),
    remainingMotion: Number(await evidenceNode.getAttribute('data-motion')),
    remainingHand: Number(await evidenceNode.getAttribute('data-hand-count')),
    blueHomageAndMove: side === 'blue',
  });
  await context.close();
}

try {
  await mkdir(screenshots, { recursive: true });
  // Desktop selection uses normal motion for blue, and reduced motion for red;
  // both also run on a touch-capable phone using CDP's native touch input path.
  for (const [side, platform] of [
    ['blue', 'desktop-normal'],
    ['red', 'desktop'],
    ['blue', 'phone'],
    ['red', 'phone'],
  ]) await runCase(side, platform);

  assert.deepEqual(errors, []);
  const report = {
    fixture,
    cases: evidence,
    pageErrors: errors,
    screenshots: evidence.flatMap(({ side, platform }) => [
      `triple-og-${side}-${platform}-selected.png`,
      `triple-og-${side}-${platform}-resolved.png`,
    ]),
  };
  await writeFile(resolve(screenshots, 'triple-og-placement-evidence.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Verified Cooky/Triple OG placement across ${evidence.length} browser cases; no pageerrors.`);
} finally {
  await browser.close();
}