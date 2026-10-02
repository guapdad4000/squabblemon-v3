import { expect, test, type Locator, type Page } from '@playwright/test';
import { ROOKIE_CORE_IDS, ROOKIE_FOUNDATION_IDS } from '@workspace/squabblemon-engine/data';
import { installProfileApi, profileBootstrap, signIn } from './fighter-id.fixture';

const sizes = [
  { label: 'phone-320', width: 320, height: 740 },
  { label: 'phone-390', width: 390, height: 844 },
  { label: 'short-landscape', width: 740, height: 360 },
  { label: 'ipad-portrait', width: 768, height: 1024 },
  { label: 'ipad-landscape', width: 1024, height: 768 },
  { label: 'desktop', width: 1440, height: 900 },
];
const player = (n: number) => ({
  friendCode: n.toString(16).toUpperCase().padStart(12, '0'),
  username: `fighter_${n}`,
  lastActiveAt: null,
  displayName: `THIS NAME IS EXTRAORDINARILY LONG ${n}`,
  avatarKey: 'hooper',
});
const self = { friendCode: 'ABCDEF123456', username: 'new_kid', lastActiveAt: null, displayName: 'NEW KID', avatarKey: 'rookie' };
function socialState(long = false) {
  return {
    self, homies: long ? Array.from({ length: 80 }, (_, n) => player(n + 1)) : [],
    incomingRequests: [], outgoingRequests: [], blocked: [], invitations: [],
    counts: { requests: 0, invitations: 0 },
  };
}
async function fixture(page: Page, long = false, bootstrap = profileBootstrap()) {
  await signIn(page);
  await installProfileApi(page, { bootstrap });
  let unavailable = false;
  let requests = 0;
  let currentState = socialState(long);
  await page.route('**/api/social', route => {
    requests++;
    return unavailable
      ? route.fulfill({ status: 503, json: { error: 'Homies temporarily unavailable.' } })
      : route.fulfill({ json: currentState });
  });
  await page.route('**/api/social/search*', route => {
    const q = (new URL(route.request().url()).searchParams.get('query') ?? '').toLowerCase().replace(/^@/, '');
    const matches = Array.from({ length: 80 }, (_, n) => player(n + 1)).filter(p => p.username.toLowerCase().startsWith(q) || p.displayName.toLowerCase().startsWith(q)).slice(0, 12);
    return route.fulfill({ json: { players: matches.map(p => ({ player: p, relationship: 'none', requestId: null })) } });
  });
  return {
    fail: () => { unavailable = true; },
    recover: () => { unavailable = false; },
    setState: (value: ReturnType<typeof socialState>) => { currentState = value; },
    requests: () => requests,
  };
}
async function target(locator: Locator) {
  await expect(locator).toBeVisible();
  const geometry = await locator.evaluate(node => {
    const r = node.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { height: r.height, rect: { x: r.x, y: r.y, width: r.width, bottom: r.bottom },
      viewport: { width: innerWidth, height: innerHeight },
      visible: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
      hitElement: hit?.tagName + '.' + (hit as HTMLElement | null)?.className,
      hit: hit === node || node.contains(hit) };
  });
  expect(geometry.height).toBeGreaterThanOrEqual(30);
  expect(geometry.visible).toBe(true);
  expect(geometry.hit, JSON.stringify(geometry)).toBe(true);
}
async function shot(page: Page, name: string) {
  const path = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path, animations: 'disabled' });
  await test.info().attach(name, { path, contentType: 'image/png' });
}

test('actual Fighter ID shell: empty Fadebook, supplied logo and final share control at six sizes', async ({ page }) => {
  await fixture(page);
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.goto('/squabblemon/game/settings#homies');
    await expect(page.getByTestId('tab-homies')).toHaveAttribute('aria-selected', 'true');
    const screen = page.getByTestId('homies-fadebook');
    await expect(screen.getByText('Your page is quiet.')).toBeVisible();
    await expect(screen.getByTestId('img-fadebook-logo')).toHaveAttribute('src', /fadebook-logo-transparent\.png$/);
    await expect(page.locator('.sq-device')).toHaveCount(0);
    const share = screen.getByTestId('button-share-link');
    await share.scrollIntoViewIfNeeded();
    await target(share);
    await expect(screen.getByTestId('text-username')).toHaveText('@new_kid');
    await shot(page, `homies-empty-${size.label}`);
  }
  // Only social HTTP is synthetic; GameApp, CityHeader, Settings and Fadebook render normally.
});

test('crowded Fadebook last row remains wheel- and keyboard-reachable in full-height route', async ({ page }) => {
  await fixture(page, true);
  await page.goto('/squabblemon/game/settings#homies');
  const screen = page.getByTestId('homies-fadebook');
  const final = page.getByTestId('row-homie-fighter_80');
  for (const size of sizes) {
    await page.setViewportSize(size);
    await expect(screen).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
    const box = await page.locator('#fighter-panel-Homies').boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, Math.min(box!.y + box!.height / 2, size.height - 20));
    await page.mouse.wheel(0, 50_000);
    await expect(final, 'wheel alone reaches final row').toBeInViewport();
    await page.locator('#fighter-panel-Homies').focus();
    await page.keyboard.press('End');
    await expect(final).toBeInViewport();
    // A short landscape viewport can end with the last tile's top behind
    // the persistent Fighter ID tabs; wheel back until its actions clear them.
    if (size.height < 400) await page.mouse.wheel(0, -150);
    await expect(final).toBeInViewport();
    await target(final.getByTestId('button-invite-fighter_80'));
    await target(final.getByTestId('button-remove-fighter_80'));
    await target(final.getByTestId('button-block-fighter_80'));
    await shot(page, `homies-long-${size.label}`);
  }
});

test('logo failure, reduced motion, share fallback and failed social retry', async ({ page }) => {
  const api = await fixture(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/assets/homies/fadebook-logo-transparent.png', route => route.abort('failed'));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('Denied')) }, configurable: true });
  });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/squabblemon/game/settings#homies');
  const screen = page.getByTestId('homies-fadebook');
  await expect(screen.getByTestId('img-fadebook-logo')).toBeVisible();
  await expect.poll(() => screen.getByTestId('img-fadebook-logo').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 0)).toBe(true);
  await screen.getByTestId('button-share-link').click();
  await expect(screen.getByTestId('input-manual-share')).toHaveValue(/\/game\/settings\?friend=ABCDEF123456#homies$/);
  await shot(page, 'homies-art-share-fallback');
  api.fail();
  await page.reload();
  await expect(page.getByTestId('button-retry-social')).toBeVisible();
  api.recover();
  await page.getByTestId('button-retry-social').click();
  await expect(page.getByTestId('text-username')).toHaveText(`@${self.username}`);
  expect(api.requests()).toBeGreaterThan(1);
});

test('four tabs have keyboard navigation; unrelated menu does not fetch Fadebook logo', async ({ page }) => {
  await fixture(page);
  const art: string[] = [];
  page.on('request', request => { if (request.url().includes('/assets/homies/')) art.push(request.url()); });
  await page.goto('/squabblemon/game/settings#settings');
  expect(art).toHaveLength(0);
  await page.goto('/squabblemon/game/settings');
  const overview = page.getByRole('tab', { name: 'Overview' });
  await overview.focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Settings' })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(overview).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab', { name: 'Settings' })).toBeFocused();
  expect(art).toHaveLength(0);
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('tab-homies')).toBeFocused();
  await expect.poll(() => art.length).toBeGreaterThan(0);
});

test('username search retries after a network error and keeps typed handle through rotations', async ({ page }) => {
  await fixture(page);
  let attempts = 0;
  await page.route('**/api/social/search*', route => {
    attempts++;
    if (attempts === 1) return route.fulfill({ status: 503, json: { error: 'Search unavailable.' } });
    return route.fulfill({ json: { players: [{ player: { ...player(19), displayName: 'THE INTENDED FIGHTER' }, relationship: 'none', requestId: null }] } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/squabblemon/game/settings#homies');
  await page.getByTestId('tab-fb-find').click();
  const field = page.getByTestId('input-search');
  const username = player(19).username;
  await field.fill(username);
  await expect(page.getByTestId('homies-fadebook').getByRole('alert')).toContainText('Search unavailable.');
  await expect(field).toHaveValue(username);
  await page.setViewportSize({ width: 740, height: 360 });
  await expect(field).toHaveValue(username);
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByTestId('list-search')).toContainText('THE INTENDED FIGHTER');
  await expect(page.getByTestId(`button-add-${username}`)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(field).toHaveValue(username);
  await expect(page.getByTestId('list-search')).toContainText('THE INTENDED FIGHTER');
  expect(attempts).toBe(2);
});

test('incoming indicator survives refresh and updates after disconnected menu recovery', async ({ page }) => {
  const api = await fixture(page);
  const pending = {
    ...socialState(),
    incomingRequests: [{ id: 'b1c91a55-48c3-43e9-8e1d-74b083b2fd11', player: player(23), createdAt: '2026-09-23T09:00:00.000Z' }],
    counts: { requests: 1, invitations: 0 },
  };
  api.setState(pending);
  await page.goto('/squabblemon/game/settings#homies');
  await expect(page.getByTestId('tab-homies').locator('.fighter-tab__badge')).toContainText('1');
  await page.reload();
  await expect(page.getByTestId('tab-homies').locator('.fighter-tab__badge')).toContainText('1');
  api.fail();
  await page.reload();
  await expect(page.getByTestId('button-retry-social')).toBeVisible();
  await page.context().setOffline(true);
  await page.context().setOffline(false);
  api.recover();
  api.setState(socialState());
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  // The provider automatically refetches on reconnection; its Retry button
  // disappears as soon as recovery succeeds (manual retry is covered above).
  await expect(page.getByTestId('text-username')).toHaveText(`@${self.username}`);
  // The currently mounted menu must clear the stale badge without another navigation.
  await expect(page.getByTestId('tab-homies').locator('.fighter-tab__badge')).toHaveCount(0, { timeout: 15_000 });
});

test('Friendly Fades room activity: server times, expiry warnings, refreshed rows and links at six sizes', async ({ page }) => {
  await fixture(page);
  const minute = 60_000;
  const serverNow = Date.now() - 2 * 60 * minute;
  let expiry = serverNow + 3 * minute;
  let lastPlayedAt = serverNow - 8 * minute;
  await page.route('**/api/multiplayer', route => route.fulfill({ json: {
    serverNow,
    rooms: [
      { code: 'ABCDEF123456', status: 'complete', rival: 'THIS RIVAL HAS AN EXTRAORDINARILY LONG NAME',
        gameNumber: 2, series: { you: 2, rival: 1, draws: 1 }, lastActivityAt: serverNow - minute,
        lastPlayedAt, expiresAt: expiry },
      { code: '123456ABCDEF', status: 'waiting', rival: 'Waiting for a friend',
        gameNumber: 1, series: { you: 0, rival: 0, draws: 0 }, lastActivityAt: serverNow,
        lastPlayedAt: null, expiresAt: serverNow + 30 * minute },
      { code: 'FEDCBA654321', status: 'waiting', rival: 'Old room',
        gameNumber: 2, series: { you: 1, rival: 0, draws: 0 }, lastActivityAt: serverNow - 20 * minute,
        lastPlayedAt: null, expiresAt: serverNow + 10 * minute },
    ],
  } }));
  await page.goto('/squabblemon/game/online?tab=friends');
  await page.getByRole('tab', { name: /Your rooms/ }).click();
  const list = page.getByTestId('list-rooms');
  const nearExpiry = page.getByTestId('link-room-ABCDEF123456');
  await expect(nearExpiry).toContainText('Last played 8m ago');
  await expect(nearExpiry).toContainText('Expiring soon · ~3m left');
  await expect(nearExpiry).toContainText('2–1 · 1D');
  await expect(page.getByTestId('link-room-123456ABCDEF')).toContainText('Not played yet · Last active just now');
  await expect(page.getByTestId('link-room-FEDCBA654321')).toContainText('Last active 20m ago');
  // The phone's clock is two hours ahead: only the server snapshot drives labels.
  await expect(nearExpiry).toHaveAttribute('href', /\/game\/online\/ABCDEF123456$/);
  for (const size of sizes) {
    await page.setViewportSize(size);
    await list.scrollIntoViewIfNeeded();
    await expect(nearExpiry).toBeVisible();
    const bounds = await list.evaluate(element => {
      const listRect = element.getBoundingClientRect();
      const rows = Array.from(element.querySelectorAll('.ff-room__activity'));
      return { listFits: listRect.left >= 0 && listRect.right <= innerWidth,
        labelsFit: rows.every(row => row.scrollWidth <= row.clientWidth),
        expiryBorder: getComputedStyle(element.querySelector('[data-expiring]')!).borderLeftColor };
    });
    expect(bounds.listFits).toBe(true);
    expect(bounds.labelsFit).toBe(true);
    expect(bounds.expiryBorder).not.toBe('rgba(0, 0, 0, 0)');
    await shot(page, `friendly-room-activity-${size.label}`);
  }
  // The existing poll reflects a rival starting a new fade without reloading.
  expiry = serverNow + 30 * minute;
  lastPlayedAt = serverNow;
  await expect(nearExpiry).toContainText('Last played just now', { timeout: 15_000 });
  await expect(nearExpiry).toContainText('~30m left');
  await expect(nearExpiry.locator('..')).not.toHaveAttribute('data-expiring', 'true');
  await nearExpiry.click();
  await expect(page).toHaveURL(/\/game\/online\/ABCDEF123456$/);
});

test('actual Friendly Fades shell: empty, crowded, selected homie and legal crew at six sizes', async ({ page }) => {
  test.setTimeout(120_000);
  const readyCrew = (id: string, name: string) => ({
    id, name, heroCardId: 'hooper', cardIds: [...ROOKIE_CORE_IDS],
    recipeId: null, valid: true, issues: [],
  });
  const api = await fixture(page, false, profileBootstrap({
    ownedCardIds: [...ROOKIE_FOUNDATION_IDS],
    savedDecks: [readyCrew('crew-one', 'FIRST LEGAL CREW'), readyCrew('crew-two', 'SECOND LEGAL CREW')],
  }));
  await page.route('**/api/multiplayer', route => route.request().method() === 'GET'
    ? route.fulfill({ json: { rooms: [] } })
    : route.fulfill({ status: 400, json: { error: 'A screenshot may not create a room.' } }));
  await page.goto('/squabblemon/game/online?tab=friends');
  const screen = page.getByTestId('friendly-fades-device');
  await expect(screen).toBeVisible({ timeout: 30_000 });
  await expect(screen.getByText('No homies on your phone yet.')).toBeVisible();
  const setup = screen.getByRole('region', { name: 'Set up a fade' });
  await expect(setup.getByRole('link', { name: 'Add a homie' })).toHaveAttribute('href', '/squabblemon/game/settings#homies');
  await expect(setup.locator('.fa-sectionhead').getByLabel('Room code')).toBeVisible();
  const sentTab = setup.getByRole('tab', { name: /Sent invites/ });
  const roomsTab = setup.getByRole('tab', { name: /Your rooms/ });
  await expect(sentTab).toHaveAttribute('aria-selected', 'true');
  await expect(setup.getByRole('tabpanel', { name: /Sent invites/ })).toContainText('No invites out right now.');
  await roomsTab.click();
  await expect(roomsTab).toHaveAttribute('aria-selected', 'true');
  await expect(setup.getByRole('tabpanel', { name: 'Your rooms' })).toContainText('No rooms yet.');
  await sentTab.click();
  await expect(setup.getByRole('tabpanel', { name: 'Your rooms' })).toBeHidden();
  await page.setViewportSize(sizes[5]);
  await page.locator('.immersive-shell').evaluate(element => { element.scrollTop = 0; });
  await expect(page.locator('.fa-hud-logo img')).toBeVisible();
  await shot(page, 'friendly-fades-hero-desktop');
  await page.setViewportSize(sizes[1]);
  await page.locator('.immersive-shell').evaluate(element => { element.scrollTop = 0; });
  await expect(page.getByRole('navigation', { name: 'Fight modes' }).getByRole('link', { name: /Friendly Fades/ })).toHaveAttribute('aria-current', 'page');
  await shot(page, 'friendly-fades-hero-phone');
  for (const size of sizes) {
    await page.setViewportSize(size);
    await screen.getByTestId('button-open-room').scrollIntoViewIfNeeded();
    await target(screen.getByTestId('button-open-room'));
    await shot(page, `friendly-fades-empty-${size.label}`);
  }

  api.setState(socialState(true));
  await page.reload();
  await expect(screen.getByTestId('button-target-000000000050')).toBeVisible();
  for (const size of sizes) {
    await page.setViewportSize(size);
    await screen.getByTestId('button-target-000000000050').scrollIntoViewIfNeeded();
    await expect(screen.getByTestId('button-target-000000000050')).toBeInViewport();
    await shot(page, `friendly-fades-long-${size.label}`);
  }

  const chosen = screen.getByTestId('button-target-000000000050');
  await chosen.click();
  const secondCrew = screen.getByRole('group', { name: 'Choose your crew' }).getByRole('button', { name: /SECOND LEGAL CREW/ });
  await secondCrew.click();
  for (const size of sizes) {
    await page.setViewportSize(size);
    await expect(chosen).toHaveAttribute('aria-checked', 'true');
    await expect(secondCrew).toHaveAttribute('aria-pressed', 'true');
    const send = screen.getByTestId('button-send-invitation');
    await send.scrollIntoViewIfNeeded();
    await target(send);
    await expect(send).toBeEnabled();
    await shot(page, `friendly-fades-selected-crew-${size.label}`);
  }
});

test('shared link survives disposable sign-in, actual profile/terms and starter reward action without sending a request', async ({ page }) => {
  // Tutorial combat is accelerated by an API fixture after the REAL profile
  // confirmation; real auth gate, reward screen/action, and route shell remain.
  const code = 'ABCDEF123456';
  let step: 'profile' | 'reward' | 'complete' = 'profile';
  const actions: string[] = [];
  const bootstrap = () => profileBootstrap({
    id: 'new-homie-account', displayName: 'NEW KID', onboardingStep: step,
    tutorialCompleted: step !== 'profile', starterRewardClaimed: step === 'complete',
    starterDeckId: step === 'profile' ? null : 'vibes',
    ageConfirmedAt: step === 'profile' ? null : '2026-09-23T09:00:00.000Z',
    termsAcceptedAt: step === 'profile' ? null : '2026-09-23T09:00:00.000Z',
  });
  await page.route('**/api/player/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path.endsWith('/bootstrap')) return route.fulfill({ json: bootstrap() });
    if (request.method() === 'POST' && path.endsWith('/onboarding')) {
      const body = request.postDataJSON();
      actions.push(body.action);
      if (body.action === 'accept-terms') {
        expect(body).toMatchObject({ displayName: 'LINK NEWCOMER', ageConfirmed: true, termsAccepted: true });
        step = 'reward';
      } else if (body.action === 'claim-reward') step = 'complete';
      else return route.fulfill({ status: 400, json: { error: 'Unexpected accelerated fixture step.' } });
      return route.fulfill({ json: bootstrap() });
    }
    return route.fulfill({ status: 404, json: { error: `Unexpected player endpoint: ${path}` } });
  });
  const socialMutations: string[] = [];
  await page.route('**/api/social/**', route => {
    if (route.request().method() !== 'GET') {
      socialMutations.push(route.request().url());
      return route.fulfill({ status: 500, json: { error: 'A link may not mutate.' } });
    }
    return route.fulfill({ json: { player: self, relationship: 'none' } });
  });
  await page.route('**/api/social', route => route.fulfill({ json: socialState() }));
  await page.goto(`/squabblemon/game/settings?friend=${code}#homies`);
  await expect(page).toHaveURL(/\/sign-in/);
  await page.getByRole('button', { name: 'Sign in test account' }).click();
  await expect(page.getByRole('heading', { name: 'Create Profile' })).toBeVisible();
  await page.getByLabel('Display Name').fill('LINK NEWCOMER');
  await page.getByLabel('I am at least 13 years old.').check();
  await page.getByLabel('I accept the Terms of Service.').check();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await page.getByRole('button', { name: 'Claim Rewards' }).click();
  await expect(page).toHaveURL(new RegExp(`/game/settings\\?friend=${code}#homies`));
   await expect(page.getByTestId('card-lookup')).toContainText(`@${self.username}`);
   await expect(page.getByTestId(`button-add-${self.username}`)).toBeVisible();
  expect(actions).toEqual(['accept-terms', 'claim-reward']);
  expect(socialMutations).toEqual([]);
});