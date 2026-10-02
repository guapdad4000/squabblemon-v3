import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

const fixture = '/squabblemon/e2e/battle-drag.fixture.html';
const ogCard = (page: Page, cardId: string) =>
  page.locator(`[data-battle-draggable="true"][data-card-id="${cardId}"]`);

async function center(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

async function tap(locator: Locator, touch: boolean) {
  if (touch) await locator.tap();
  else await locator.click();
}

async function physicalTap(page: Page, locator: Locator, touch: boolean) {
  const point = await center(locator);
  if (!touch) {
    await page.mouse.click(point.x, point.y);
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  const touchPoint = { x: point.x, y: point.y, radiusX: 5, radiusY: 5, force: 1, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function dragIntoLane(
  page: Page,
  source: Locator,
  lane: Locator,
  touch: boolean,
  inspectHover?: () => Promise<void>,
) {
  const start = await center(source);
  const end = await center(lane);
  if (!touch) {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x, start.y - 24, { steps: 3 });
    await page.mouse.move(end.x, end.y, { steps: 12 });
    await expect(page.getByTestId('battle-drag-preview')).toBeVisible();
    await inspectHover?.();
    await page.mouse.up();
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  const point = (x: number, y: number) => [{ x, y, radiusX: 5, radiusY: 5, force: 1, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(start.x, start.y) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(start.x, start.y - 24) });
  for (let step = 1; step <= 12; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: point(start.x + (end.x - start.x) * step / 12, start.y - 24 + (end.y - start.y + 24) * step / 12),
    });
  }
  await expect(page.getByTestId('battle-drag-preview')).toBeVisible();
  await inspectHover?.();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function screenshot(testInfo: TestInfo, page: Page, name: string) {
  const image = await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
  await testInfo.attach(name, { body: image, contentType: 'image/png' });
}

async function verifyBoardEvidence(page: Page, cardId: string, laneNumber: number, expectedCount: number) {
  const evidence = page.getByTestId('triple-og-evidence');
  const boardCards = page.locator(`[data-card-zone="board"][data-card-id="${cardId}"]`);
  await expect(boardCards).toHaveCount(expectedCount);
  await expect(evidence).toHaveAttribute('data-play-count', String(expectedCount));
  await expect(evidence).toHaveAttribute('data-last-play-effect-type', 'play');
  await expect(evidence).toHaveAttribute('data-last-play-effect-card-id', cardId);
  await expect(evidence).toHaveAttribute('data-last-play-effect-lane', String(laneNumber));
  await expect(evidence).toHaveAttribute('data-og-ability-effect-type', 'ability');
  await expect(evidence).toHaveAttribute('data-og-ability-effect-lane', String(laneNumber));
  await expect(evidence).toHaveAttribute('data-og-ability-effect-note', /.+/);
  await expect(evidence).toHaveAttribute('data-effect-count', new RegExp(`[1-9]`));

  const latest = boardCards.nth(expectedCount - 1);
  const cardBox = await latest.boundingBox();
  const laneBox = await page.locator(`[data-testid="lane-container-${laneNumber}"]`).boundingBox();
  const viewport = page.viewportSize()!;
  expect(cardBox).not.toBeNull();
  expect(laneBox).not.toBeNull();
  expect(laneBox!.x).toBeGreaterThanOrEqual(0);
  expect(laneBox!.y).toBeGreaterThanOrEqual(0);
  expect(laneBox!.x + laneBox!.width).toBeLessThanOrEqual(viewport.width);
  expect(laneBox!.y + laneBox!.height).toBeLessThanOrEqual(viewport.height);
  expect(cardBox!.x + cardBox!.width).toBeGreaterThan(laneBox!.x);
  expect(cardBox!.x).toBeLessThan(laneBox!.x + laneBox!.width);
  expect(cardBox!.y + cardBox!.height).toBeGreaterThan(laneBox!.y);
  expect(cardBox!.y).toBeLessThan(laneBox!.y + laneBox!.height);
  const art = latest.locator('img').first();
  await expect.poll(() => art.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
}

test('Blue left and Red right OGs tap-play and drag into their locked home districts', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  const touch = testInfo.project.name.includes('phone');
  for (const { color, lane } of [{ color: 'blue', lane: 0 }, { color: 'red', lane: 2 }] as const) {
    const cardId = `triple-og-${color}`;
    await page.goto(`${fixture}?tripleOg=${color}&lockedLane=${lane}`);
    const arena = page.getByTestId('battle-arena');
    await expect(arena).toBeVisible();
    await expect(arena).toHaveAttribute('data-engine-phase', 'player');
    const evidence = page.getByTestId('triple-og-evidence');
    await expect(evidence).toHaveAttribute('data-home-lane', String(lane));
    await expect(evidence).toHaveAttribute('data-target-lane', String(lane));

    await tap(ogCard(page, cardId).first(), touch);
    const homeButton = page.getByTestId(`lane-${lane}`);
    await expect(homeButton).toHaveAttribute('aria-disabled', 'false');
    await expect(homeButton).toContainText('Play · 4 Motion');
    for (const wrongLane of [0, 1, 2].filter(candidate => candidate !== lane)) {
      await expect(page.getByTestId(`lane-${wrongLane}`)).toHaveAttribute('aria-disabled', 'true');
    }
    await tap(homeButton, touch);
    await expect(homeButton).toContainText('Ready · 4 Motion');
    await expect(page.getByTestId('button-lock')).toBeEnabled();
    await tap(page.getByTestId('button-lock'), touch);
    await verifyBoardEvidence(page, cardId, lane, 1);

    const remaining = ogCard(page, cardId);
    await expect(remaining).toHaveCount(1);
    await dragIntoLane(page, remaining, homeButton, touch, async () => {
      await expect(page.locator(`[data-testid="lane-container-${lane}"]`)).toHaveAttribute('data-drop-state', 'ready');
    });
    await verifyBoardEvidence(page, cardId, lane, 2);
    await screenshot(testInfo, page, `${color}-locked-home-${touch ? 'phone' : 'desktop'}`);
  }
  expect(browserErrors).toEqual([]);
});

test('wrong center and opposite-side lanes reject both mythical OGs, even when locked', async ({ page }, testInfo) => {
  const browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  const touch = testInfo.project.name.includes('phone');
  for (const { color, lane } of [
    { color: 'blue', lane: 1 }, { color: 'blue', lane: 2 },
    { color: 'red', lane: 0 }, { color: 'red', lane: 1 },
  ] as const) {
    const cardId = `triple-og-${color}`;
    const homeLane = color === 'blue' ? 0 : 2;
    const requiredDistrict = homeLane === 0 ? 'left district' : 'right district';
    await page.goto(`${fixture}?tripleOg=${color}&targetLane=${lane}&lockedLane=${lane}`);
    const evidence = page.getByTestId('triple-og-evidence');
    const wrongLane = page.getByTestId(`lane-${lane}`);
    await expect(evidence).toHaveAttribute('data-home-lane', String(homeLane));
    await expect(wrongLane).toHaveAttribute('aria-disabled', 'true');

    await tap(ogCard(page, cardId).first(), touch);
    await expect(wrongLane).toHaveAttribute('aria-disabled', 'true');
    await expect(wrongLane).toHaveAttribute('aria-label', new RegExp(`only the ${requiredDistrict}`));
    await physicalTap(page, wrongLane, touch);
    await expect(wrongLane).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('button-pick-district')).toBeDisabled();

    await dragIntoLane(page, ogCard(page, cardId).first(), wrongLane, touch, async () => {
      await expect(page.locator(`[data-testid="lane-container-${lane}"]`)).toHaveAttribute('data-drop-state', 'blocked');
    });
    await expect(page.locator(`[data-card-zone="board"][data-card-id="${cardId}"]`)).toHaveCount(0);
    await expect(ogCard(page, cardId)).toHaveCount(2);
    await expect(evidence).toHaveAttribute('data-play-count', '0');
    await expect(page.getByTestId('battle-arena')).toHaveAttribute('data-engine-phase', 'player');
  }
  await screenshot(testInfo, page, `wrong-lane-negative-${touch ? 'phone' : 'desktop'}`);
  expect(browserErrors).toEqual([]);
});

test('Blue and Red Triple OGs pay exactly 4 Motion in locked home Corrupt Church', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  const touch = testInfo.project.name.includes('phone');
  for (const { color, lane } of [{ color: 'blue', lane: 0 }, { color: 'red', lane: 2 }] as const) {
    const cardId = `triple-og-${color}`;
    await page.goto(`${fixture}?tripleOg=${color}&lockedLane=${lane}&churchHome=1`);
    const evidence = page.getByTestId('triple-og-evidence');
    const card = ogCard(page, cardId);
    const homeButton = page.getByTestId(`lane-${lane}`);
    await expect(evidence).toHaveAttribute('data-motion', '4');
    await expect(page.locator(`[data-testid="lane-container-${lane}"]`)).toHaveAttribute('data-location', 'corrupt-church');

    await tap(card, touch);
    await expect(homeButton).toHaveAttribute('aria-disabled', 'false');
    await expect(homeButton).toContainText('Play · 4 Motion');
    await tap(homeButton, touch);
    await expect(homeButton).toContainText('Ready · 4 Motion');
    await expect(page.getByTestId('button-lock')).toBeEnabled();
    await expect(page.getByTestId('button-lock')).toContainText('Play card · 4 Motion');
    await expect(page.getByTestId('button-lock')).not.toContainText('5 Motion');
    await tap(page.getByTestId('button-lock'), touch);
    await verifyBoardEvidence(page, cardId, lane, 1);
    await expect(evidence).toHaveAttribute('data-motion', '0');
    await screenshot(testInfo, page, `${color}-corrupt-church-home-cost-${touch ? 'phone' : 'desktop'}`);
  }
  expect(browserErrors).toEqual([]);
});

test('ordinary card tap and drag remain blocked by a locked district', async ({ page }, testInfo) => {
  const browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  const touch = testInfo.project.name.includes('phone');
  await page.goto(`${fixture}?ordinaryLocked=1&lockedLane=1`);
  const arena = page.getByTestId('battle-arena');
  await expect(arena).toBeVisible();
  const ordinary = page.locator('[data-battle-draggable="true"][data-card-id="plug"]');
  const lockedLane = page.getByTestId('lane-1');
  await expect(lockedLane).toHaveAttribute('aria-disabled', 'true');
  await tap(ordinary, touch);
  await expect(page.getByTestId('button-lock')).toHaveCount(0);
  await expect(lockedLane).toHaveAttribute('aria-disabled', 'true');

  await dragIntoLane(page, ordinary, lockedLane, touch, async () => {
    await expect(page.locator('[data-testid="lane-container-1"]')).toHaveAttribute('data-drop-state', 'blocked');
  });
  await expect(page.locator('[data-card-zone="board"][data-card-id="plug"]')).toHaveCount(0);
  await expect(ordinary).toHaveCount(1);
  await expect(arena).toHaveAttribute('data-engine-phase', 'player');
  await screenshot(testInfo, page, `ordinary-locked-negative-${touch ? 'phone' : 'desktop'}`);
  expect(browserErrors).toEqual([]);
});
