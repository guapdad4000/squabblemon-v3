import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

const fixture = '/e2e/bounty-gang.fixture.html';
const screenshots = 'e2e/screenshots';
const phone = { width: 390, height: 844 };
const desktop = { width: 1280, height: 900 };

type Bootstrap = {
  profile: { softCurrency: number };
  missions: Array<{ id: string; status: string }>;
};

async function open(
  page: Page,
  query = 'screen=bounties&scenario=ready',
  viewport = desktop,
) {
  await page.setViewportSize(viewport);
  await page.goto(`${fixture}?${query}`, { waitUntil: 'networkidle' });
  await expect(page.locator('body')).not.toBeEmpty();
}

async function returnedBootstrap(page: Page) {
  return page.evaluate(() => {
    const current = window.__bountyGangFixture.cachedBootstrap() as unknown as Bootstrap;
    return {
      ...current,
      profile: { ...current.profile, softCurrency: current.profile.softCurrency + 137 },
      missions: current.missions.map((mission) =>
        mission.id === 'weekly-cleanse' ? { ...mission, status: 'claimed' } : mission),
    };
  });
}

async function hitTarget(locator: Locator) {
  await expect(locator).toBeVisible();
  expect(await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit === element || Boolean(hit && element.contains(hit));
  })).toBe(true);
}

async function expectTransparentWebp(image: Locator, fileName: string) {
  await expect(image).toHaveAttribute('src', new RegExp(`${fileName.replace('.', '\\.')}$`));
  await expect.poll(() => image.evaluate((node: HTMLImageElement) =>
    node.complete && node.naturalWidth > 0)).toBe(true);
  const alpha = await image.evaluate((node: HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = node.naturalWidth;
    canvas.height = node.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(node, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = false;
    let visible = false;
    for (let index = 3; index < pixels.length; index += 4) {
      transparent ||= pixels[index] < 255;
      visible ||= pixels[index] > 0;
      if (transparent && visible) break;
    }
    return { transparent, visible };
  });
  expect(alpha, `${fileName} should contain real visible pixels and alpha`).toEqual({
    transparent: true,
    visible: true,
  });
}

function claimRoutes(page: Page) {
  const routes: Route[] = [];
  const urls: string[] = [];
  return {
    async install() {
      await page.route('**/api/player/missions/*/claim', async (route) => {
        routes.push(route);
        urls.push(route.request().url());
      });
    },
    routes,
    urls,
  };
}

test('claim waits for the authoritative response and full shot before revealing its reward', async ({ page }) => {
  const claims = claimRoutes(page);
  await claims.install();
  await open(page);

  const board = page.getByTestId('bounty-board');
  const pistol = page.getByTestId('bounty-pistol');
  const poster = page.getByTestId('bounty-poster').filter({ has: page.getByText('Clear the Air') });
  const claim = page.getByRole('button', { name: 'Claim reward for Clear the Air' });
  await expect(board).toBeVisible();
  await expect(poster).toHaveAttribute('data-mission-id', 'weekly-cleanse');
  await expect(pistol).toHaveAttribute('data-phase', 'idle');
  await expectTransparentWebp(pistol.locator('.bounty-hunter__pistol--idle'), 'pistol-idle.webp');
  await expectTransparentWebp(pistol.locator('.bounty-hunter__pistol--fired'), 'pistol-fired.webp');
  await board.screenshot({ path: `${screenshots}/bounty-board-initial-desktop.png`, animations: 'disabled' });

  await claim.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect.poll(() => claims.routes.length).toBe(1);
  expect(new URL(claims.urls[0]).pathname).toBe('/api/player/missions/weekly-cleanse/claim');
  expect(claims.routes[0].request().method()).toBe('POST');
  await expect(pistol).toHaveAttribute('data-phase', 'loading');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('bounty-impact')).toHaveCount(0);
  await expect(poster.getByTestId('bounty-bullet-hole')).toHaveCount(0);

  await claims.routes[0].fulfill({ json: await returnedBootstrap(page) });
  await expect(pistol).toHaveAttribute('data-phase', 'firing');
  await page.waitForFunction(() => {
    const pistol = document.querySelector<HTMLElement>('[data-testid="bounty-pistol"]');
    const fired = pistol?.querySelector<HTMLElement>('.bounty-hunter__pistol--fired');
    return pistol?.dataset.phase === 'firing'
      && fired !== null
      && Number.parseFloat(getComputedStyle(fired).opacity) > 0.9;
  }, undefined, { polling: 'raf' });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const impact = page.getByTestId('bounty-impact');
  await expect(impact).toBeVisible();
  await page.screenshot({ path: `${screenshots}/bounty-impact-desktop.png` });
  await expectTransparentWebp(impact, 'impact.webp');
  await expect(pistol).toHaveAttribute('data-phase', 'impact');
  await expect(page.getByRole('dialog', { name: 'Bounty collected' })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('+137');
  await expect(page.getByRole('dialog')).toContainText('Clout');
  await page.screenshot({ path: `${screenshots}/bounty-reward-desktop.png` });
  await expect(poster).toHaveAttribute('data-status', 'claimed');
  expect(claims.routes).toHaveLength(1);
  await page.getByRole('button', { name: 'Keep going' }).click();
  const bulletHole = poster.getByTestId('bounty-bullet-hole');
  await expect(bulletHole).toBeVisible();
  await expect(bulletHole).toHaveCSS('animation-name', 'none');
  await page.getByRole('button', { name: 'Experiments & mastery' }).click();
  await page.getByRole('button', { name: 'Bounties', exact: true }).click();
  await expect(bulletHole).toBeVisible();
});

test('saved collected posters keep bullet holes after a reload without replaying the shot', async ({ page }) => {
  await open(page, 'screen=bounties&scenario=claimed', phone);
  const collected = page.getByTestId('bounty-poster').filter({ hasText: 'Clear the Air' });
  const bulletHole = collected.getByTestId('bounty-bullet-hole');
  await expectTransparentWebp(bulletHole, 'impact.webp');
  await expect(bulletHole).toHaveCSS('animation-name', 'none');
  await page.reload({ waitUntil: 'networkidle' });
  await expect(bulletHole).toBeVisible();
  await expect(bulletHole).toHaveCSS('animation-name', 'none');
  await expect(page.getByTestId('bounty-pistol')).toHaveAttribute('data-phase', 'idle');
  await expect(page.getByTestId('bounty-impact')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('bounty-poster').filter({ hasText: 'Put in the Work' })
    .getByTestId('bounty-bullet-hole')).toHaveCount(0);
});

test('failed claims stay idle, show no reward, and permit one clean retry', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/player/missions/*/claim', async (route) => {
    requests += 1;
    if (requests === 1) {
      await route.fulfill({ status: 503, json: { message: 'Temporary outage' } });
    } else {
      await route.fulfill({ json: await returnedBootstrap(page) });
    }
  });
  await open(page);
  const claim = page.getByRole('button', { name: 'Claim reward for Clear the Air' });
  const pistol = page.getByTestId('bounty-pistol');
  await claim.click();
  await expect(page.getByRole('alert')).toContainText('try again');
  await expect(pistol).toHaveAttribute('data-phase', 'idle');
  await expect(page.getByTestId('bounty-impact')).toHaveCount(0);
  await expect(page.getByTestId('bounty-poster').filter({ hasText: 'Clear the Air' })
    .getByTestId('bounty-bullet-hole')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(claim).toBeEnabled();
  await claim.click();
  await expect(page.getByRole('dialog', { name: 'Bounty collected' })).toBeVisible();
  expect(requests).toBe(2);
});

test('non-claimable states, empty copy, and the mastery tab remain available', async ({ page }) => {
  await open(page, 'screen=bounties&scenario=ready');
  await expect(page.getByText('In Progress', { exact: true })).toBeVisible();
  await expect(page.getByText('Collected', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Claim reward for Put in the Work/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Claim reward for First Win/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Experiments & mastery' }).click();
  await expect(page.getByRole('region', { name: 'Experiments and mastery' })).toBeVisible();

  await open(page, 'screen=bounties&scenario=empty');
  await expect(page.getByRole('heading', { name: 'The city is quiet.' })).toBeVisible();
  await page.getByRole('button', { name: 'Experiments & mastery' }).click();
  await expect(page.getByRole('heading', { name: 'Your experiments. Your rewards.' })).toBeVisible();
});

for (const reduced of [
  { name: 'system', query: 'screen=bounties&scenario=ready', emulate: true },
  { name: 'profile', query: 'screen=bounties&scenario=ready&profileMotion=reduce', emulate: false },
] as const) {
  test(`${reduced.name} reduced motion skips gun effects but still reveals the saved reward`, async ({ page }) => {
    if (reduced.emulate) await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/api/player/missions/*/claim', async (route) => {
      await route.fulfill({ json: await returnedBootstrap(page) });
    });
    await open(page, reduced.query);
    await page.getByRole('button', { name: 'Claim reward for Clear the Air' }).click();
    await expect(page.getByRole('dialog', { name: 'Bounty collected' })).toBeVisible();
    await expect(page.getByTestId('bounty-pistol')).toHaveAttribute('data-phase', 'idle');
    await expect(page.getByTestId('bounty-impact')).toHaveCount(0);
    await expect(page.getByTestId('bounty-poster').filter({ hasText: 'Clear the Air' })
      .getByTestId('bounty-bullet-hole')).toBeVisible();
  });
}

test('unmounting while a claim is pending updates cache without stale effects', async ({ page }) => {
  const claims = claimRoutes(page);
  await claims.install();
  await open(page);
  await page.getByRole('button', { name: 'Claim reward for Clear the Air' }).click();
  await expect.poll(() => claims.routes.length).toBe(1);
  await page.evaluate(() => window.__bountyGangFixture.setScreen('decks'));
  await expect(page.getByRole('heading', { name: 'The Lineup' })).toBeVisible();
  await claims.routes[0].fulfill({ json: await returnedBootstrap(page) });
  await page.waitForTimeout(1_000);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() =>
    window.__bountyGangFixture.cachedBootstrap()?.missions
      .find((mission) => mission.id === 'weekly-cleanse')?.status)).toBe('claimed');
  await page.evaluate(() => window.__bountyGangFixture.setScreen('bounties'));
  await expect(page.getByTestId('bounty-poster').filter({ hasText: 'Clear the Air' }))
    .toHaveAttribute('data-status', 'claimed');
  await expect(page.getByTestId('bounty-poster').filter({ hasText: 'Clear the Air' })
    .getByTestId('bounty-bullet-hole')).toBeVisible();
});

test('leaving during the shot cancels its impact and reward without losing the claim', async ({ page }) => {
  await page.route('**/api/player/missions/*/claim', async (route) => {
    await route.fulfill({ json: await returnedBootstrap(page) });
  });
  await open(page);
  await page.getByRole('button', { name: 'Claim reward for Clear the Air' }).click();
  await expect(page.getByTestId('bounty-pistol')).toHaveAttribute('data-phase', 'firing');
  await expect.poll(() => page.evaluate(() =>
    window.__bountyGangFixture.cachedBootstrap()?.missions
      .find((mission) => mission.id === 'weekly-cleanse')?.status)).toBe('claimed');
  await page.evaluate(() => window.__bountyGangFixture.setScreen('decks'));
  await page.waitForTimeout(1_000);
  await expect(page.getByTestId('bounty-impact')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(() => window.__bountyGangFixture.setScreen('bounties'));
  await expect(page.getByTestId('bounty-poster').filter({ hasText: 'Clear the Air' }))
    .toHaveAttribute('data-status', 'claimed');
});

for (const viewport of [
  { name: 'desktop', size: desktop, posterMax: 230, povMin: 300 },
  { name: 'phone', size: phone, posterMax: 180, povMin: 220 },
] as const) {
  test(`${viewport.name} bounty board has one scroll owner, compact posters, and a transparent foreground gun`, async ({ page }) => {
    await page.route('**/api/player/missions/*/claim', async route => {
      await route.fulfill({ status: 503, json: { message: 'Expected layout-test rejection' } });
    });
    await open(page, 'screen=bounties&scenario=ready', viewport.size);
    const board = page.getByTestId('bounty-board');
    const scroll = page.getByTestId('bounty-scroll');
    const pistol = page.getByTestId('bounty-pistol');
    const idlePistol = pistol.locator('.bounty-hunter__pistol--idle');

    const verticalScrollers = await board.locator('*').evaluateAll(elements =>
      elements.filter(element => {
        const node = element as HTMLElement;
        const overflow = getComputedStyle(node).overflowY;
        return (overflow === 'auto' || overflow === 'scroll')
          && node.scrollHeight > node.clientHeight + 1;
      }).map(element => ({
        className: (element as HTMLElement).className,
        testId: (element as HTMLElement).dataset.testid,
      })),
    );
    expect(verticalScrollers).toEqual([{
      className: 'bounty-hunter__scroll',
      testId: 'bounty-scroll',
    }]);

    for (const poster of await page.getByTestId('bounty-poster').all()) {
      const box = await poster.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeLessThanOrEqual(viewport.posterMax);
    }

    const [boardBox, povBefore, gunBox] = await Promise.all([
      board.boundingBox(),
      pistol.boundingBox(),
      idlePistol.boundingBox(),
    ]);
    expect(boardBox).not.toBeNull();
    expect(povBefore).not.toBeNull();
    expect(gunBox).not.toBeNull();
    const initialScrollBox = await scroll.boundingBox();
    expect(initialScrollBox).not.toBeNull();
    expect(initialScrollBox!.y + initialScrollBox!.height)
      .toBeCloseTo(boardBox!.y + boardBox!.height, 0);
    expect(povBefore!.height).toBeGreaterThanOrEqual(viewport.povMin);
    expect(povBefore!.height).toBeLessThanOrEqual(341);
    expect(gunBox!.width).toBeGreaterThanOrEqual(Math.min(300, viewport.size.width * 0.75));
    expect(gunBox!.height).toBeGreaterThanOrEqual(povBefore!.height * 0.9);
    expect(povBefore!.y).toBeGreaterThanOrEqual(boardBox!.y);
    expect(povBefore!.y + povBefore!.height).toBeLessThanOrEqual(boardBox!.y + boardBox!.height + 1);
    await expect(idlePistol).toHaveCSS('opacity', '1');
    await expect(pistol).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(pistol).toHaveCSS('background-image', 'none');
    await expect(pistol.locator('.bounty-hunter__wall')).toHaveCount(0);

    const descendantScrollTops = () => scroll.locator('*').evaluateAll(elements =>
      elements.map(element => (element as HTMLElement).scrollTop),
    );
    const nestedBeforeWheel = await descendantScrollTops();
    const scrollBox = await scroll.boundingBox();
    expect(scrollBox).not.toBeNull();
    await page.mouse.move(
      scrollBox!.x + scrollBox!.width / 2,
      scrollBox!.y + Math.min(80, scrollBox!.height / 2),
    );
    await page.mouse.wheel(0, 420);
    await expect.poll(() => scroll.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    expect(await descendantScrollTops()).toEqual(nestedBeforeWheel);

    await scroll.evaluate(element => { element.scrollTop = 0; });
    await page.getByRole('button', { name: 'Bounties' }).focus();
    await page.keyboard.press('PageDown');
    await expect.poll(() => scroll.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    expect(await descendantScrollTops()).toEqual(nestedBeforeWheel);

    const povAfter = await pistol.boundingBox();
    expect(povAfter).not.toBeNull();
    expect(povAfter!.y).toBeCloseTo(povBefore!.y, 0);
    expect(povAfter!.height).toBeCloseTo(povBefore!.height, 0);
    await expect(idlePistol).toBeVisible();

    await page.mouse.wheel(0, 10_000);
    await expect.poll(() => scroll.evaluate(element =>
      element.scrollHeight - element.clientHeight - element.scrollTop,
    )).toBeLessThanOrEqual(1);
    const [lastPosterBox, povAtBottom] = await Promise.all([
      page.getByTestId('bounty-poster').last().boundingBox(),
      pistol.boundingBox(),
    ]);
    expect(lastPosterBox).not.toBeNull();
    expect(povAtBottom).not.toBeNull();
    expect(lastPosterBox!.y + lastPosterBox!.height)
      .toBeLessThanOrEqual(povAtBottom!.y);

    const claim = page.getByRole('button', { name: 'Claim reward for Clear the Air' });
    await claim.scrollIntoViewIfNeeded();
    await hitTarget(claim);
    await claim.click();
    await expect(page.getByRole('alert')).toContainText('try again');
    await expect(idlePistol).toBeVisible();
    await hitTarget(claim);
  });
}

test('phone pistol stays board-anchored and cannot block a claim target', async ({ page }) => {
  await open(page, 'screen=bounties&scenario=ready', phone);
  const board = page.getByTestId('bounty-board');
  const pistol = page.getByTestId('bounty-pistol');
  const claim = page.getByRole('button', { name: 'Claim reward for Clear the Air' });
  const [boardBox, pistolBox] = await Promise.all([board.boundingBox(), pistol.boundingBox()]);
  expect(boardBox).not.toBeNull();
  expect(pistolBox).not.toBeNull();
  expect(pistolBox!.x).toBeGreaterThanOrEqual(boardBox!.x);
  expect(pistolBox!.x + pistolBox!.width).toBeLessThanOrEqual(boardBox!.x + boardBox!.width + 1);
  expect(pistolBox!.y + pistolBox!.height).toBeLessThanOrEqual(boardBox!.y + boardBox!.height + 1);
  expect(boardBox!.y + boardBox!.height - (pistolBox!.y + pistolBox!.height)).toBeLessThanOrEqual(40);
  await claim.scrollIntoViewIfNeeded();
  await hitTarget(claim);
  await board.screenshot({ path: `${screenshots}/bounty-board-initial-phone.png`, animations: 'disabled' });
});

test('phone claim keeps the shot visible and shows the confirmed reward after impact', async ({ page }) => {
  await page.route('**/api/player/missions/*/claim', async route => {
    await route.fulfill({ json: await returnedBootstrap(page) });
  });
  await open(page, 'screen=bounties&scenario=ready', phone);
  await page.getByRole('button', { name: 'Claim reward for Clear the Air' }).click();
  const pistol = page.getByTestId('bounty-pistol');
  await expect(pistol).toHaveAttribute('data-phase', 'firing');
  const bounds = await pistol.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(phone.height);
  await expect(page.getByTestId('bounty-impact')).toBeVisible();
  await page.screenshot({ path: `${screenshots}/bounty-shot-phone.png`, animations: 'allow' });
  await expect(page.getByRole('dialog', { name: 'Bounty collected' })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('+137');
});

test('backgrounding a confirmed shot skips remaining effects and reveals its reward once', async ({ page }) => {
  await page.route('**/api/player/missions/*/claim', async route => {
    await route.fulfill({ json: await returnedBootstrap(page) });
  });
  await open(page);
  await page.getByRole('button', { name: 'Claim reward for Clear the Air' }).click();
  await expect(page.getByTestId('bounty-pistol')).toHaveAttribute('data-phase', 'firing');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByTestId('bounty-pistol')).toHaveAttribute('data-phase', 'idle');
  await expect(page.getByTestId('bounty-impact')).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Bounty collected' })).toHaveCount(1);
});

async function expectBackdrop(page: Page, artwork: 'mobile' | 'desktop') {
  const backdrop = page.getByTestId('gang-backdrop');
  const image = backdrop.locator('img');
  await expect(backdrop).toBeVisible();
  await expect.poll(() => image.evaluate((node: HTMLImageElement) =>
    node.complete && node.naturalWidth > 0 ? node.currentSrc : '')).toMatch(
      new RegExp(`gang-${artwork}\\.webp$`),
    );
  await expect(backdrop).toHaveCSS('pointer-events', 'none');
}

for (const viewport of [
  { name: 'desktop', size: desktop, artwork: 'desktop' as const },
  { name: 'phone', size: phone, artwork: 'mobile' as const },
] as const) {
  test(`${viewport.name} gang artwork is responsive and stays behind real list and builder controls`, async ({ page }) => {
    await open(page, 'screen=decks&scenario=ready', viewport.size);
    await expectBackdrop(page, viewport.artwork);
    const deckButton = page.getByRole('button', { name: 'Edit deck: The Regression Crew' });
    await hitTarget(deckButton);
    await deckButton.click();
    await expect(page).toHaveURL(/\/game\/decks\/fixture-gang$/);

    await page.evaluate(() => window.__bountyGangFixture.setScreen('editor'));
    await expectBackdrop(page, viewport.artwork);
    const name = page.getByRole('textbox', { name: 'Deck name' });
    await hitTarget(name);
    await name.fill('Backdrop-safe Crew');
    await expect(name).toHaveValue('Backdrop-safe Crew');
    const save = page.getByRole('button', { name: /Save deck/ });
    await save.scrollIntoViewIfNeeded();
    await hitTarget(save);
    await save.click();
    await expect(page.getByRole('status')).toContainText('Deck saved');
    await expect.poll(() => page.evaluate(() => window.__bountyGangFixture.callbacks()))
      .toMatchObject({
        saveCalls: 1,
        lastSaved: {
          name: 'Backdrop-safe Crew',
          cardIds: expect.any(Array),
          heroCardId: expect.any(String),
        },
      });
    expect(await page.evaluate(() =>
      window.__bountyGangFixture.callbacks().lastSaved?.cardIds.length)).toBe(10);
  });
}