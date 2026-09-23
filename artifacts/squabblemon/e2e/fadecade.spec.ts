import { expect, test, type Locator, type Page } from '@playwright/test';
import { CREW_ID, RUN_ID, openFadecade } from './fadecade.fixture';

const screenshots = 'test-results/fadecade';

function consoleGuard(page: Page) {
  const errors: string[] = [];
  page.on('console', message => {
    const text = message.text();
    if (message.type() === 'error' || /encountered two children with the same key/i.test(text)) errors.push(text);
  });
  return errors;
}

async function hitTest(locator: Locator) {
  await expect(locator).toBeVisible();
  await locator.scrollIntoViewIfNeeded();
  expect(await locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit === element || Boolean(hit && element.contains(hit));
  })).toBe(true);
}

async function waitForEndTurn(page: Page) {
  const endTurn = page.getByRole('button', { name: 'End Turn', exact: true }).first();
  const lesson = page.getByRole('button', { name: 'Back to the battle', exact: true });
  const skip = page.getByRole('button', { name: 'Fast forward', exact: true });
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (await lesson.isVisible()) {
      await lesson.click({ timeout: 500 }).catch(() => undefined);
    } else if (await skip.isVisible()) {
      await skip.click({ timeout: 500 }).catch(() => undefined);
    } else if (await endTurn.isVisible() && await endTurn.isEnabled()) {
      return endTurn;
    }
    await page.waitForTimeout(50);
  }
  throw new Error('Battle did not return to the player End Turn action.');
}

async function assertGeometry(page: Page) {
  const hub = page.locator('main.fadecade-hub');
  await expect(hub).toBeVisible();
  const geometry = await hub.evaluate((hub) => {
    const root = document.documentElement;
    const body = document.body;
    const shell = hub.closest<HTMLElement>('.immersive-shell');
    const scrollables = [...document.querySelectorAll<HTMLElement>('body *')].filter(element => {
      const style = getComputedStyle(element);
      return /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
    });
    return {
      horizontalOverflow: Math.max(root.scrollWidth, body.scrollWidth) - innerWidth,
      documentScrolls: Math.max(root.scrollHeight, body.scrollHeight) > innerHeight + 1,
      hasHub: true,
      hubInsideShell: Boolean(shell && hub && shell.contains(hub)),
      shellOverflow: shell ? getComputedStyle(shell).overflowY : '',
      ownerCount: scrollables.length,
      wrongScrollOwners: scrollables
        .filter(element => element !== shell)
        .map(element => element.getAttribute('data-testid') || element.className || element.tagName),
    };
  });
  expect(geometry.horizontalOverflow, 'Fadecade must not overflow the viewport horizontally').toBeLessThanOrEqual(1);
  expect(geometry.documentScrolls, 'the document itself must stay fixed').toBe(false);
  expect(geometry.hasHub, 'the Fadecade hub must be inside the immersive shell').toBe(true);
  expect(geometry.hubInsideShell).toBe(true);
  expect(geometry.shellOverflow).toMatch(/auto|scroll/);
  expect(geometry.ownerCount, 'there must be exactly one active vertical scroll owner').toBe(1);
  expect(geometry.wrongScrollOwners, 'only the outer .immersive-shell may vertically scroll').toEqual([]);
}

async function hubLayout(page: Page, anchor: Locator) {
  return anchor.evaluate(element => {
    const hub = element.closest<HTMLElement>('.fadecade-hub');
    const shell = element.closest<HTMLElement>('.immersive-shell');
    const rect = element.getBoundingClientRect();
    return {
      hubHeight: hub?.scrollHeight ?? 0,
      shellTop: shell?.scrollTop ?? -1,
      anchor: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    };
  });
}

async function assertDialogFits(page: Page, dialog: Locator) {
  await expect(dialog).toBeVisible();
  const geometry = await dialog.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const banner = element.querySelector<HTMLElement>('.fadecade-dialog-art-header')?.getBoundingClientRect();
    const ink = element.querySelector<HTMLElement>('.fadecade-dialog-header-ink')?.getBoundingClientRect();
    const title = element.querySelector<HTMLElement>('.fadecade-dialog-title');
    const titlebar = element.querySelector<HTMLElement>('.fadecade-dialog-titlebar')?.getBoundingClientRect();
    const close = element.querySelector<HTMLElement>('.fadecade-dialog-close')?.getBoundingClientRect();
    const intersects = (a?: DOMRect, b?: DOMRect) => Boolean(a && b &&
      Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
      Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top));
    return {
      left: rect.left,
      right: rect.right,
      width: rect.width,
      ownOverflow: element.scrollWidth - element.clientWidth,
      viewportWidth: innerWidth,
      documentOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
      artTextContained: Boolean(banner && ink && ink.left >= banner.left && ink.right <= banner.right &&
        ink.top >= banner.top && ink.bottom <= banner.bottom),
      titleFits: Boolean(title && titlebar && title.getBoundingClientRect().left >= titlebar.left &&
        title.getBoundingClientRect().right <= titlebar.right &&
        title.getBoundingClientRect().top >= titlebar.top &&
        title.getBoundingClientRect().bottom <= titlebar.bottom),
      titleAvoidsClose: !intersects(title?.getBoundingClientRect(), close),
    };
  });
  expect(geometry.left, 'dialog must not escape the viewport on the left').toBeGreaterThanOrEqual(-1);
  expect(geometry.right, 'dialog must not escape the viewport on the right').toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.ownOverflow, 'dialog content must not overflow horizontally').toBeLessThanOrEqual(1);
  expect(geometry.documentOverflow, 'opening a dialog must not create document overflow').toBeLessThanOrEqual(1);
  expect(geometry.artTextContained, 'dialog title copy must stay in the artwork text area').toBe(true);
  expect(geometry.titleFits, 'dialog title must remain readable without clipping').toBe(true);
  expect(geometry.titleAvoidsClose, 'dialog title and Close action must not overlap').toBe(true);
}

async function chromeState(page: Page) {
  return page.locator('.fadecade-hero-stage').evaluate(stage => {
    const flagship = stage.querySelector<HTMLElement>('[data-testid="fadecade-flagship"]');
    const flags = [...stage.querySelectorAll<HTMLElement>('.fadecade-chrome-flag')];
    if (!flagship || flags.length !== 2) return null;
    const machine = flagship.getBoundingClientRect();
    return flags.map(flag => {
      const rect = flag.getBoundingClientRect();
      return {
        reveal: Number.parseFloat(flag.style.getPropertyValue('--chrome-reveal')),
        retract: flag.dataset.retract,
        transform: getComputedStyle(flag).transform,
        top: rect.top,
        flagshipTop: machine.top,
      };
    });
  });
}

test('featured machine previews for free, starts once, and binds a normal battle', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The responsive matrix is covered by the geometry test.');
  const consoleErrors = consoleGuard(page);
  const api = await openFadecade(page);
  const main = page.getByRole('main');
  await expect(main).toBeVisible();
  await expect(page).toHaveURL(/\/game\/challenges$/);

  const featured = page.getByRole('button', { name: 'Open Straight to the Back road', exact: true });
  await hitTest(featured);
  await featured.click();
  expect(api.requests.starts).toHaveLength(0);

  const start = page.getByRole('button', { name: 'Start run · 1 entry', exact: true });
  await expect(page.getByRole('combobox', { name: 'Choose legal crew', exact: true })).toHaveValue(CREW_ID);
  await hitTest(start);
  await start.click();
  await expect.poll(() => api.requests.starts.length).toBe(1);
  expect(api.requests.starts[0]).toEqual({ deckId: CREW_ID });
  await expect.poll(() => api.requests.matches.length).toBe(1);
  expect(api.requests.matches[0]).toMatchObject({
    mode: 'practice',
    playerDeckId: CREW_ID,
    challengeRunId: RUN_ID,
  });
  await expect(page).toHaveURL(/\/game\/challenges$/);
  await page.screenshot({ path: `${screenshots}/battle-${testInfo.project.name}.png`, fullPage: true });
  expect(consoleErrors.filter(error => /same key/i.test(error))).toEqual([]);
});

test('responsive arcade has one scroll owner, loaded cover art, and reachable final actions', async ({ page }, testInfo) => {
  const consoleErrors = consoleGuard(page);
  await openFadecade(page);
  await expect(page.getByRole('main')).toBeVisible();
  await assertGeometry(page);
  await page.screenshot({ path: `${screenshots}/hub-${testInfo.project.name}.png` });
  await expect(page.getByText('2/2', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Personal best: 0 stops', { exact: true })).toBeVisible();
  await expect(page.getByText('1 ready to collect', { exact: true })).toHaveCount(2);
  await expect(page.getByText('Recent Road Log', { exact: true })).toHaveCount(0);

  const meaningfulImages = page.locator('main img');
  const count = await meaningfulImages.count();
  expect(count, 'the production Fadecade should use real cover images').toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    await expect.poll(() => meaningfulImages.nth(index).evaluate((image: HTMLImageElement) =>
      image.complete && image.naturalWidth > 0 && image.naturalHeight > 0)).toBe(true);
  }
  if (testInfo.project.name !== 'desktop') {
    const flagshipRect = await page.getByTestId('fadecade-flagship').boundingBox();
    const flagRects = await page.locator('.fadecade-chrome-flag').evaluateAll(flags =>
      flags.map(flag => flag.getBoundingClientRect().top));
    expect(flagshipRect).not.toBeNull();
    expect(Math.min(...flagRects), 'the flagship cabinet must lead the artwork on stacked layouts')
      .toBeGreaterThanOrEqual(flagshipRect!.y - 1);
  }

  const secondary = page.getByTestId('fadecade-training');
  await secondary.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${screenshots}/secondary-${testInfo.project.name}.png` });

  const finalAction = page.getByRole('button', { name: 'Open Straight to the Back road', exact: true });
  await finalAction.scrollIntoViewIfNeeded();
  await hitTest(finalAction);
  const beforeRoad = await hubLayout(page, page.getByTestId('fadecade-flagship'));
  await finalAction.click();
  const roadDialog = page.getByRole('dialog', { name: 'Straight to the Back', exact: true });
  await assertDialogFits(page, roadDialog);
  await expect(roadDialog.locator('img')).not.toHaveCount(0);
  const startAction = roadDialog.getByRole('button', { name: 'Start run · 1 entry', exact: true });
  await expect(startAction).toBeVisible();
  expect(await hubLayout(page, page.getByTestId('fadecade-flagship'))).toEqual(beforeRoad);
  await page.screenshot({ path: `${screenshots}/road-${testInfo.project.name}.png` });
  await hitTest(startAction);
  await page.screenshot({ path: `${screenshots}/road-action-${testInfo.project.name}.png` });
  await page.keyboard.press('Escape');
  await expect(roadDialog).toBeHidden();
  await expect(finalAction).toBeFocused();
  await assertGeometry(page);
  expect(consoleErrors.filter(error => /same key/i.test(error))).toEqual([]);
});

test('scroll-linked chrome reveals centered stats and honors reduced motion', async ({ page }, testInfo) => {
  test.skip(!['desktop', 'phone', 'short-phone', 'reduced-motion'].includes(testInfo.project.name),
    'Scroll geometry is sampled on desktop, narrow phones, and reduced motion.');
  await openFadecade(page);
  const stats = page.locator('.fadecade-chrome-banner--stats');
  await stats.evaluate(element => element.scrollIntoView({ block: 'center' }));
  await expect.poll(async () => stats.evaluate(element =>
    Number.parseFloat((element as HTMLElement).style.getPropertyValue('--chrome-reveal')))).toBeGreaterThanOrEqual(0.99);
  if (testInfo.project.name === 'phone' || testInfo.project.name === 'short-phone') {
    await page.screenshot({ path: `${screenshots}/stats-${testInfo.project.name}.png` });
  }

  if (testInfo.project.name === 'phone' || testInfo.project.name === 'short-phone') {
    await assertGeometry(page);
    return;
  }

  const flagship = page.getByTestId('fadecade-flagship');
  await flagship.scrollIntoViewIfNeeded();
  await expect(page.locator('.fadecade-chrome-flag')).toHaveCount(2);
  await expect.poll(async () => (await chromeState(page))?.every(flag => flag.reveal >= 0.95)).toBe(true);
  const upper = await chromeState(page);
  expect(upper).not.toBeNull();
  await page.screenshot({ path: `${screenshots}/flags-upper-${testInfo.project.name}.png` });

  await page.getByTestId('fadecade-training').scrollIntoViewIfNeeded();
  await page.waitForTimeout(testInfo.project.name === 'reduced-motion' ? 50 : 500);
  const away = await chromeState(page);
  expect(away).not.toBeNull();
  await page.screenshot({ path: `${screenshots}/flags-away-${testInfo.project.name}.png` });

  if (testInfo.project.name === 'reduced-motion') {
    expect(away!.map(flag => flag.reveal)).toEqual(upper!.map(flag => flag.reveal));
    expect(away!.map(flag => flag.transform)).toEqual(upper!.map(flag => flag.transform));
  } else {
    expect(away!.every(flag => flag.reveal < 0.05)).toBe(true);
    expect(away!.every(flag => flag.retract === 'true')).toBe(true);
  }
  await assertGeometry(page);
});

test('cabinet dialogs are modal, geometry-stable, trapped, and restore focus', async ({ page }, testInfo) => {
  const api = await openFadecade(page);
  const dailyCabinet = page.getByTestId('fadecade-daily');
  await dailyCabinet.scrollIntoViewIfNeeded();
  const dailyOpen = dailyCabinet.getByRole('button', { name: 'Open daily bounties', exact: true });
  const beforeDaily = await hubLayout(page, dailyCabinet);
  await dailyOpen.click();

  const dailyDialog = page.getByRole('dialog', { name: 'daily Bounties', exact: true });
  await assertDialogFits(page, dailyDialog);
  await expect(dailyDialog.locator('img')).not.toHaveCount(0);
  await expect(dailyDialog.getByTestId('panel-daily')).toContainText('Clock In');
  await expect(dailyDialog.getByText('75 Clout', { exact: true })).toBeVisible();
  await hitTest(dailyDialog.getByRole('button', { name: 'Claim Clock In', exact: true }));
  expect(await hubLayout(page, dailyCabinet)).toEqual(beforeDaily);
  expect(api.requests.starts).toHaveLength(0);
  expect(api.runs()).toHaveLength(0);
  const dailyShellTop = (await hubLayout(page, dailyCabinet)).shellTop;
  await page.mouse.move(2, 2);
  await page.mouse.wheel(0, 600);
  expect((await hubLayout(page, dailyCabinet)).shellTop, 'the hub must not wheel-scroll behind a modal')
    .toBe(dailyShellTop);
  if (testInfo.project.name === 'desktop' || testInfo.project.name === 'phone') {
    await page.screenshot({ path: `${screenshots}/bounty-popup-${testInfo.project.name}.png` });
  }

  await page.keyboard.press('Escape');
  await expect(dailyDialog).toBeHidden();
  await expect(dailyOpen).toBeFocused();
  await assertGeometry(page);

  const trainingCabinet = page.getByTestId('fadecade-training');
  await trainingCabinet.scrollIntoViewIfNeeded();
  const trainingOpen = trainingCabinet.getByRole('button', { name: 'Open training circuit', exact: true });
  const beforeTraining = await hubLayout(page, trainingCabinet);
  await trainingOpen.click();

  const trainingDialog = page.getByRole('dialog', { name: 'Training Circuit', exact: true });
  await assertDialogFits(page, trainingDialog);
  await expect(trainingDialog.locator('img')).not.toHaveCount(0);
  await expect(trainingDialog.getByTestId('panel-training')).toBeVisible();
  await hitTest(trainingDialog.getByRole('button', { name: 'Practice Open training', exact: true }));
  const focusables = trainingDialog.locator(
    'button:not([disabled]), select:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
  );
  const focusableCount = await focusables.count();
  expect(focusableCount, 'the training dialog should expose real keyboard actions').toBeGreaterThan(1);
  const first = focusables.first();
  const last = focusables.last();
  await first.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(last).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(first).toBeFocused();
  expect(await hubLayout(page, trainingCabinet)).toEqual(beforeTraining);
  expect(api.requests.starts).toHaveLength(0);
  expect(api.requests.matches).toHaveLength(0);
  if (testInfo.project.name === 'desktop' || testInfo.project.name === 'phone') {
    await page.screenshot({ path: `${screenshots}/training-popup-${testInfo.project.name}.png` });
  }

  await page.keyboard.press('Escape');
  await expect(trainingDialog).toBeHidden();
  await expect(trainingOpen).toBeFocused();
  await assertGeometry(page);

  for (const cabinet of [
    { testId: 'fadecade-weekly', openName: 'Open weekly bounties', title: 'weekly Bounties' },
    { testId: 'fadecade-events', openName: 'Open street events', title: 'Street Events' },
  ]) {
    const machine = page.getByTestId(cabinet.testId);
    await machine.scrollIntoViewIfNeeded();
    const opener = machine.getByRole('button', { name: cabinet.openName, exact: true });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: cabinet.title, exact: true });
    await assertDialogFits(page, dialog);
    await expect(dialog.locator('img')).not.toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  }
  await assertGeometry(page);
});

test('leaving an interrupted road preserves it; only explicit End run abandons', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Journey behavior is exercised once.');
  const api = await openFadecade(page, { activeRun: true, checkpoint: true });
  await expect.poll(() => api.requests.matches.length).toBe(0);
  const continueButton = page.getByRole('button', { name: 'Continue road', exact: true });
  await hitTest(continueButton);
  await continueButton.click();
  expect(api.requests.matches).toHaveLength(0);
  const continueFight = page.getByRole('button', { name: 'Continue fight', exact: true });
  await hitTest(continueFight);
  await continueFight.click();
  await expect.poll(() => api.requests.matches.length).toBe(1);
  expect(api.requests.starts).toHaveLength(0);
  expect(api.requests.matches[0]).toMatchObject({ mode: 'practice', challengeRunId: RUN_ID });

  await page.getByLabel('Battle menu', { exact: true }).click();
  const exit = page.getByRole('button', { name: 'Leave battle', exact: true });
  await hitTest(exit);
  await exit.click();
  await expect(page).toHaveURL(/\/game\/challenges$/);
  expect(api.requests.abandons).toBe(0);

  const resumedRoad = page.getByRole('dialog', { name: 'Straight to the Back', exact: true });
  await expect(resumedRoad).toBeVisible();
  const endRun = resumedRoad.getByRole('button', { name: 'End run', exact: true });
  await hitTest(endRun);
  await endRun.click();
  const confirm = resumedRoad.getByRole('button', { name: 'End run now', exact: true });
  await hitTest(confirm);
  await expect(resumedRoad.getByRole('button', { name: 'Keep run', exact: true })).toBeVisible();
  await confirm.click();
  await expect.poll(() => api.requests.abandons).toBe(1);
});

test('smaller training cabinet opens setup before its explicit practice launch', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Journey behavior is exercised once.');
  const api = await openFadecade(page);
  const training = page.getByTestId('fadecade-training');
  await expect(training).toBeVisible();
  expect(api.requests.matches).toHaveLength(0);
  await training.getByRole('button', { name: 'Open training circuit', exact: true }).click();
  const launch = page.getByTestId('panel-training').getByRole('button', { name: 'Practice Open training', exact: true });
  await hitTest(launch);
  await launch.click();
  await expect.poll(() => api.requests.matches.length).toBe(1);
  expect(api.requests.matches[0]).toMatchObject({ mode: 'practice' });
  expect(api.requests.matches[0]).not.toHaveProperty('challengeRunId');
  await expect(page).toHaveURL(/\/game\/challenges$/);
});

test('daily and weekly cabinet dialogs reveal authoritative claims', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Journey behavior is exercised once.');
  const api = await openFadecade(page);
  const dailyCabinet = page.getByTestId('fadecade-daily');
  await dailyCabinet.getByRole('button', { name: 'Open daily bounties', exact: true }).click();
  const daily = page.getByTestId('panel-daily').getByRole('button', { name: 'Claim Clock In', exact: true });
  await hitTest(daily);
  await daily.click();
  await expect.poll(() => api.requests.claims).toContain('daily-fade');
  await expect(page.getByText(/715/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Keep going →', exact: true }).click();
  const weeklyCabinet = page.getByTestId('fadecade-weekly');
  await weeklyCabinet.getByRole('button', { name: 'Open weekly bounties', exact: true }).click();
  const weekly = page.getByTestId('panel-weekly').getByRole('button', { name: 'Claim Road Regular', exact: true });
  await hitTest(weekly);
  await weekly.click();
  await expect.poll(() => api.requests.claims).toEqual(['daily-fade', 'weekly-road']);
  expect(api.bootstrap().profile.softCurrency).toBe(715);
  expect(api.bootstrap().profile.packTickets).toBe(2);
  await expect(page).toHaveURL(/\/game\/challenges$/);
});

test('missing optional art keeps controls operable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Missing-art resilience is independent of viewport.');
  await page.route(/\.(?:webp|png|jpe?g)(?:\?.*)?$/i, route => route.abort());
  await openFadecade(page);
  const featured = page.getByRole('button', { name: 'Open Straight to the Back road', exact: true });
  await hitTest(featured);
  await featured.click();
  const start = page.getByRole('button', { name: 'Start run · 1 entry', exact: true });
  await hitTest(start);
  const roadDialog = page.getByRole('dialog', { name: 'Straight to the Back', exact: true });
  await expect(roadDialog).toBeVisible();
  await expect(page.locator('.fadecade-chrome-flag[data-art-missing="true"]')).toHaveCount(2);
  await expect(page.locator('.fadecade-chrome-flag[data-art-missing="true"] .fadecade-chrome-content').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(roadDialog).toBeHidden();
  await assertGeometry(page);
});

test('a completed loss checkpoints real end-turn actions and returns to Fadecade', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The full real-game journey is intentionally run once.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const api = await openFadecade(page);
  const featured = page.getByRole('button', { name: 'Open Straight to the Back road', exact: true });
  await featured.click();
  await page.getByRole('button', { name: 'Start run · 1 entry', exact: true }).click();
  await expect.poll(() => api.requests.matches.length).toBe(1);

  for (let turn = 0; turn < 6; turn += 1) {
    const endTurn = await waitForEndTurn(page);
    await endTurn.click();
  }

  await expect.poll(() => api.requests.completions.length, { timeout: 30_000 }).toBe(1);
  expect(api.requests.checkpoints.length).toBeGreaterThanOrEqual(6);
  for (let index = 1; index < api.requests.checkpoints.length; index += 1) {
    const previous = api.requests.checkpoints[index - 1] as { moves: unknown[] };
    const current = api.requests.checkpoints[index] as { moves: unknown[] };
    expect(current.moves.slice(0, previous.moves.length)).toEqual(previous.moves);
  }
  const completion = api.requests.completions[0] as { moves: Array<{ endTurn?: boolean }> };
  expect(completion.moves.filter(move => move.endTurn)).toHaveLength(6);
  const returnAction = page.getByRole('button', { name: /view run summary|back to the road|return to the road/i });
  await hitTest(returnAction);
  await page.screenshot({ path: `${screenshots}/loss-desktop.png` });
  await returnAction.click();
  await expect(page).toHaveURL(/\/game\/challenges$/);
  await expect(page.getByText('Run over · 0 stops cleared', { exact: true })).toBeVisible();
  expect(api.requests.abandons).toBe(0);
});