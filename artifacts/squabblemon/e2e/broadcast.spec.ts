import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadingScenes, rewardClips } from '../src/lib/broadcastCatalog';
import { selectRewardClip } from '../src/lib/rewardBroadcast';

const fixture = '/e2e/broadcast.fixture.html';
const artifactDir = join(process.cwd(), 'e2e/artifacts/broadcast');
mkdirSync(artifactDir, { recursive: true });

test('every live-catalog clip and loading scene is served, postered, and browser-decodable', async ({ page }) => {
  for (const tag of ['victory', 'defeat', 'draw', 'reward'] as const) {
    const pool = rewardClips.filter(clip => clip.tags.includes(tag));
    expect(pool.length, `${tag} must have a reachable clip pool`).toBeGreaterThanOrEqual(2);
    expect(pool.every(clip => clip.poster && clip.video), `${tag} pool must be fully postered`).toBe(true);
    const first = selectRewardClip(tag);
    const second = selectRewardClip(tag);
    expect(pool.some(clip => clip.id === first?.id), `${tag} selector returns a compatible exported clip`).toBe(true);
    expect(pool.some(clip => clip.id === second?.id), `${tag} selector returns a compatible exported clip`).toBe(true);
    expect(second?.id, `${tag} selector avoids immediate repeat`).not.toBe(first?.id);
  }
  await page.goto(`${fixture}?audit=1`, { waitUntil: 'domcontentloaded' });
  const media = [...rewardClips, ...loadingScenes];
  const responses = new Map<string, { status: number; type: string }>();
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.pathname.includes('/brand/broadcast/')) responses.set(url.pathname, {
      status: response.status(), type: response.headers()['content-type'] ?? '',
    });
  });
  const decoded = await page.evaluate(async (entries) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:fixed;left:-10px;top:0;width:2px;height:2px;opacity:0;overflow:hidden';
    document.body.append(root);
    const waitEvent = (element: HTMLMediaElement | HTMLImageElement, event: string, timeout = 12000) =>
      new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeout);
        element.addEventListener(event, () => { clearTimeout(timer); resolve(); }, { once: true });
        element.addEventListener('error', () => { clearTimeout(timer); reject(new Error(`Asset failed during ${event}: ${element.currentSrc || (element as HTMLImageElement).src}`)); }, { once: true });
      });
    const results = [];
    for (const item of entries) {
      const poster = new Image();
      poster.src = `/${item.poster}`;
      await waitEvent(poster, 'load');
      if (!poster.naturalWidth || !poster.naturalHeight) throw new Error(`Empty poster: ${item.poster}`);
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.poster = poster.src;
      root.append(video);
      const metadata = waitEvent(video, 'loadedmetadata');
      const canplay = waitEvent(video, 'canplay');
      video.src = `/${item.video}`;
      video.load();
      await Promise.all([metadata, canplay]);
      await video.play();
      await Promise.race([
        new Promise<void>(resolve => {
          if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(() => resolve());
          else window.setTimeout(resolve, 350);
        }),
        new Promise<void>(resolve => window.setTimeout(resolve, 2500)),
      ]);
      video.pause();
      results.push({ id: item.id, video: item.video, poster: item.poster, duration: video.duration, width: video.videoWidth, height: video.videoHeight, posterWidth: poster.naturalWidth, posterHeight: poster.naturalHeight });
      video.remove();
    }
    root.remove();
    return results;
  }, media);

  expect(decoded, 'all clips and scenes should be actually decoded by Chromium').toHaveLength(media.length);
  for (const asset of decoded) {
    expect(asset.width, `${asset.id} decoded width`).toBeGreaterThan(0);
    expect(asset.height, `${asset.id} decoded height`).toBeGreaterThan(0);
    expect(asset.posterWidth, `${asset.id} poster width`).toBeGreaterThan(0);
    expect(asset.posterHeight, `${asset.id} poster height`).toBeGreaterThan(0);
    const catalog = media.find(item => item.id === asset.id)!;
    if ('duration' in catalog) {
      expect(asset.duration, `${asset.id} short-clip duration`).toBeGreaterThanOrEqual(1);
      expect(asset.duration, `${asset.id} short-clip duration`).toBeLessThanOrEqual(3);
      expect(Math.abs(asset.duration - catalog.duration), `${asset.id} declared vs decoded duration`).toBeLessThanOrEqual(0.36);
    } else expect(asset.duration, `${asset.id} loading-loop duration`).toBeGreaterThan(4.5);
    expect(responses.get(`/${asset.video}`)?.status, `${asset.video} response`).toBeGreaterThanOrEqual(200);
    expect(responses.get(`/${asset.video}`)?.type, `${asset.video} MIME`).toMatch(/^video\/mp4\b/i);
    expect(responses.get(`/${asset.poster}`)?.type, `${asset.poster} MIME`).toMatch(/^image\/jpeg\b/i);
  }
});

test('real root first-paint poster and mounted React loader share one boot scene', async ({ page }) => {
  let releaseMain!: () => void;
  let mainRequested!: () => void;
  let releaseApp!: () => void;
  let appRequested!: () => void;
  const mainGate = new Promise<void>(resolve => { releaseMain = resolve; });
  const mainSeen = new Promise<void>(resolve => { mainRequested = resolve; });
  const appGate = new Promise<void>(resolve => { releaseApp = resolve; });
  const appSeen = new Promise<void>(resolve => { appRequested = resolve; });
  const broadcasts: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.includes('/brand/broadcast/')) broadcasts.push(url.pathname);
  });
  await page.route('**/src/main.tsx*', async route => {
    mainRequested();
    await mainGate;
    await route.continue();
  });
  await page.route('**/src/App.tsx*', async route => {
    appRequested();
    await appGate;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'commit' });
  await mainSeen;
  const root = page.locator('#root');
  const bootScene = await root.getAttribute('data-boot-loading-scene');
  expect(loadingScenes.some(scene => scene.id === bootScene)).toBe(true);
  const boot = loadingScenes.find(scene => scene.id === bootScene)!;
  const firstPaint = page.locator('#first-paint-loading-scene');
  await expect(firstPaint).toHaveAttribute('src', new RegExp(boot.poster.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
  await expect(firstPaint).toBeVisible();
  expect(broadcasts.filter(path => path.endsWith('.mp4'))).toEqual([]);
  await page.screenshot({ path: join(artifactDir, 'root-first-paint.png'), fullPage: true });
  releaseMain();
  await appSeen;
  await expect(page.getByTestId('loading-screen')).toHaveAttribute('data-scene', boot.id, { timeout: 30_000 });
  await page.screenshot({ path: join(artifactDir, 'root-react-loader.png'), fullPage: true });
  expect(broadcasts.filter(path => path.endsWith('.mp4'))).toEqual([]);
  releaseApp();
});

test('RewardReveal presents eligible confirmed receipts once, keeps FIFO, and preserves Escape dismissal', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = function () {
      this.dispatchEvent(new Event('playing'));
      return Promise.resolve();
    };
  });
  let failedClaims = 0;
  await page.route('**/api/e2e/rewards/**', async route => {
    const request = route.request();
    const action = new URL(request.url()).pathname.split('/').at(-1);
    if (request.method() !== 'POST') return route.fulfill({ status: 405 });
    if (action === 'failure') {
      failedClaims++;
      return route.fulfill({ status: 503, json: { error: 'Simulated claim failure.' } });
    }
    if (action === 'mission' || action === 'promo') return route.fulfill({ json: {
      profile: { id: 'broadcast-fixture-player', softCurrency: 125, packTickets: 0, styleShardBalances: {}, streetRep: 0, xp: 0, ownedCardIds: [], unlockedCosmeticIds: [] },
    } });
    if (action === 'story-card') return route.fulfill({ json: {
      bootstrap: { profile: { id: 'broadcast-fixture-player', softCurrency: 100, packTickets: 0, styleShardBalances: {}, streetRep: 0, xp: 0, ownedCardIds: [], unlockedCosmeticIds: [] } },
      rewards: [{ kind: 'currency', id: 'xp', amount: 5, rewardKey: 'story-fixture:xp' }],
    } });
    if (action === 'story-clout') return route.fulfill({ json: {
      bootstrap: { profile: { id: 'broadcast-fixture-player', softCurrency: 150, packTickets: 0, styleShardBalances: {}, streetRep: 0, xp: 0, ownedCardIds: [], unlockedCosmeticIds: [] } },
      rewards: [{ kind: 'currency', id: 'clout', amount: 50, rewardKey: 'story-fixture:clout' }],
    } });
    return route.fulfill({ status: 404, json: { error: `Unmocked receipt action: ${action}` } });
  });
  await page.goto(`${fixture}?hold-media=1`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Failed action' }).click();
  await expect.poll(() => failedClaims).toBe(1);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Mission receipt', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('reward-stinger')).toBeVisible();
  await expect(dialog.getByTestId('reward-stinger').locator('video')).toBeVisible();
  const oldVideo = await dialog.getByTestId('reward-stinger').locator('video').elementHandle();
  await dialog.getByRole('button', { name: /Show rewards/ }).click();
  await expect(dialog.getByTestId('reward-stinger')).toHaveCount(0);
  await expect(dialog.getByRole('heading', { name: 'mission receipt' })).toBeVisible();
  await page.evaluate(() => {
    const fixture = (window as Window & { broadcastFixture?: { duplicateMission(): void; remountPresenter(): void } }).broadcastFixture!;
    fixture.duplicateMission();
    fixture.remountPresenter();
  });
  await expect(dialog.getByTestId('reward-stinger')).toHaveCount(0);
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'mission receipt' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Queue two' }).click();
  await expect(dialog.getByTestId('reward-stinger')).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'fifo first' })).toBeVisible();
  // A stale media error from the consumed receipt must not dismiss or consume the next item.
  await oldVideo?.evaluate(video => video.dispatchEvent(new Event('error')));
  await expect(dialog.getByTestId('reward-stinger')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog.getByRole('heading', { name: 'fifo second' })).toBeVisible();
  await oldVideo?.evaluate(video => video.dispatchEvent(new Event('error')));
  await expect(dialog.getByRole('heading', { name: 'fifo second' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Promo receipt' }).click();
  await expect(dialog.getByRole('heading', { name: 'promo receipt' })).toBeVisible();
  await expect(page.getByTestId('reward-stinger')).toBeVisible();
  await page.getByRole('button', { name: /Show rewards/ }).click();
  await expect(dialog.getByRole('heading', { name: 'promo receipt' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Story non-Clout receipt' }).click();
  await expect(page.getByTestId('reward-stinger')).toBeVisible();
  await page.getByRole('button', { name: /Show rewards/ }).click();
  await expect(dialog.getByText('Story reward delivered')).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep going' }).click();

  await page.getByRole('button', { name: 'Story Clout opt-out' }).click();
  await expect(dialog.getByTestId('reward-stinger')).toHaveCount(0);
  await expect(dialog.getByText('Clout balance')).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep going' }).click();

  await page.getByRole('button', { name: 'Battle opt-out receipt' }).click();
  await expect(dialog.getByTestId('reward-stinger')).toHaveCount(0);
  await expect(dialog.getByRole('heading', { name: 'battle haul' })).toBeVisible();
  await dialog.getByRole('button', { name: /Keep going/ }).click();
  await page.getByRole('button', { name: 'Level opt-out receipt' }).click();
  await expect(dialog.getByTestId('reward-stinger')).toHaveCount(0);
  await expect(dialog.getByText(/LEVEL 02/)).toBeVisible();
  await dialog.getByRole('button', { name: /Keep applying pressure/ }).click();
});

test('selected clip is the only library request; responsive broadcast screenshots fit all viewports', async ({ page }) => {
  const broadcastRequests: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/brand/broadcast/')) broadcastRequests.push(new URL(request.url()).pathname);
  });
  await page.goto(`${fixture}?clip=selected&visual=1`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('reward-stinger')).toBeVisible();
  await expect.poll(() => broadcastRequests.some(path => path.endsWith(rewardClips[0].video))).toBe(true);
  expect(new Set(broadcastRequests.filter(path => path.endsWith('.mp4')))).toEqual(new Set([`/${rewardClips[0].video}`]));

  const viewports = [
    { name: 'phone-portrait', width: 390, height: 844 },
    { name: 'phone-landscape', width: 844, height: 390 },
    { name: 'tablet', width: 1024, height: 768 },
    { name: 'desktop', width: 1440, height: 900 },
  ];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const frame = page.getByTestId('reward-stinger').locator('.reward-stinger__frame');
    await expect(frame).toBeVisible();
    const box = await frame.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
    await page.screenshot({ path: join(artifactDir, `reward-${viewport.name}.png`), fullPage: true });
  }
});

test('reduced motion, Data Saver, 3G, and low downlink bypass video while continuing', async ({ page }) => {
  await page.goto(fixture, { waitUntil: 'domcontentloaded' });
  const requests: string[] = [];
  const trackRequest = (request: import('@playwright/test').Request) => {
    if (request.url().includes('/brand/broadcast/') && request.url().endsWith('.mp4')) requests.push(request.url());
  };
  let completions = 0;
  let mounted = false;
  for (const policy of ['save-data', '3g', 'low-downlink', 'reduced-motion']) {
    if (mounted) {
      await page.getByRole('button', { name: 'Unmount media' }).click();
      await expect(page.getByTestId('reward-stinger')).toHaveCount(0);
      mounted = false;
    }
    if (policy === 'reduced-motion') await page.emulateMedia({ reducedMotion: 'reduce' });
    else await page.emulateMedia({ reducedMotion: 'no-preference' });
    requests.length = 0;
    page.on('request', trackRequest);
    const connection = policy === 'save-data' ? { saveData: true, effectiveType: '4g', downlink: 10 }
      : policy === '3g' ? { saveData: false, effectiveType: '3g', downlink: 2 }
        : policy === 'low-downlink' ? { saveData: false, effectiveType: '4g', downlink: 0.5 }
          : { saveData: false, effectiveType: '4g', downlink: 10 };
    await page.evaluate(value => {
      const simulated = Object.assign(new EventTarget(), value);
      Object.defineProperty(navigator, 'connection', { configurable: true, value: simulated });
    }, connection);
    await page.getByRole('button', { name: 'Remount media' }).click();
    mounted = true;
    completions++;
    await expect(page.getByTestId('stinger-complete-count')).toHaveText(String(completions));
    expect(requests, `${policy} must not request a video`).toEqual([]);
    page.off('request', trackRequest);
  }
});

test('blocked playback, request errors, stalls, and unmounts settle without stale callbacks', async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError'));
  });
  const page = await context.newPage();
  await page.goto(`${fixture}?media=1`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('stinger-complete-count')).toHaveText('1');
  await page.getByRole('button', { name: 'Unmount media' }).click();
  await expect(page.getByTestId('reward-stinger')).toHaveCount(0);
  await page.waitForTimeout(800);
  await expect(page.getByTestId('stinger-complete-count')).toHaveText('1');
  await context.close();

  const failed = await browser.newPage();
  await failed.route('**/brand/broadcast/**/*.mp4', route => route.abort());
  await failed.goto(`${fixture}?media=1`, { waitUntil: 'domcontentloaded' });
  await expect(failed.getByTestId('stinger-complete-count')).toHaveText('1');
  await failed.close();

  const stalled = await browser.newPage();
  await stalled.route('**/brand/broadcast/**/*.mp4', route => new Promise<void>(() => {}));
  await stalled.goto(`${fixture}?media=1`, { waitUntil: 'domcontentloaded' });
  await stalled.getByTestId('reward-stinger').locator('video').dispatchEvent('stalled');
  await expect(stalled.getByTestId('stinger-complete-count')).toHaveText('1', { timeout: 3000 });
  await stalled.close();
});

test('cold optional player code fails open, can be skipped immediately, and cannot play after a late import', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', { configurable: true,
      value: Object.assign(new EventTarget(), { saveData: false, effectiveType: '4g', downlink: 10 }) });
  });
  const videos: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/brand/broadcast/') && request.url().endsWith('.mp4')) videos.push(request.url());
  });
  for (const failure of ['rejected', 'delayed', 'skipped']) {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/RewardStinger.tsx*', async route => {
      if (failure === 'rejected') return route.abort();
      await gate;
      await route.continue().catch(() => {});
    });
    await page.goto('/e2e/deferred-broadcast.fixture.html', { waitUntil: 'domcontentloaded' });
    if (failure === 'skipped') await page.getByRole('button', { name: /Show rewards/ }).click();
    await expect(page.getByRole('status')).toHaveText('Rewards shown · 1', { timeout: 2500 });
    release();
    await page.waitForTimeout(300);
    await expect(page.getByRole('status')).toHaveText('Rewards shown · 1');
    await expect(page.getByTestId('reward-stinger')).toHaveCount(0);
    expect(videos).toEqual([]);
    await page.unrouteAll({ behavior: 'wait' });
  }
});

test('hiding a mounted broadcast releases its video and ignores subsequent media events', async ({ page }) => {
  await page.goto(`${fixture}?media=1`, { waitUntil: 'domcontentloaded' });
  const video = page.getByTestId('reward-stinger').locator('video');
  await expect(video).toBeVisible();
  const handle = await video.elementHandle();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByTestId('stinger-complete-count')).toHaveText('1');
  expect(await handle!.evaluate(element => ({ paused: (element as HTMLVideoElement).paused, src: element.getAttribute('src') })))
    .toEqual({ paused: true, src: null });
  await handle!.evaluate(element => {
    element.dispatchEvent(new Event('ended'));
    element.dispatchEvent(new Event('error'));
  });
  await expect(page.getByTestId('stinger-complete-count')).toHaveText('1');
});