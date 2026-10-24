import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { loadingScenes } from '../src/lib/broadcastCatalog';
const fixture = '/e2e/loading.fixture.html';
const output = process.env.LOADING_OUTPUT || '/tmp/squabblemon-loading';
type FixtureWindow = Window & { finishLoading(): void; startLoading(phase?: string): void; changeLoadingPhase(phase: string): void; remountLoading(): void };

async function composition(page: import('@playwright/test').Page) {
  return page.locator('.street-broadcast-loader').evaluate(loader => {
    const box = (selector: string) => { const rect = loader.querySelector(selector)!.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }; };
    return { logo: box('.sbl-wordmark'), fighters: box('.sbl-fighters'), width: innerWidth, height: innerHeight,
      crop: getComputedStyle(loader.querySelector('.sbl-background')!).objectPosition,
      controls: loader.querySelectorAll('button,progress,[role="progressbar"],header,footer,ol').length,
      visibleText: [...loader.querySelectorAll('*')].filter(element => element.childNodes.length && [...element.childNodes].some(node => node.nodeType === 3 && node.textContent?.trim())).filter(element => getComputedStyle(element).clip !== 'rect(0px, 0px, 0px, 0px)').map(element => element.textContent?.trim()) };
  });
}

test('centered logo, tiny fighters and authored scenes keep a clean composition at phone and desktop sizes', async ({ page }) => {
  await mkdir(output, { recursive: true });
  await page.addInitScript(() => { localStorage.removeItem('squabblemon:last-loading-scene'); Math.random = () => (Number(new URL(location.href).searchParams.get('scene-index')) + .5) / 3; });
  for (const [width, height] of [[320,568], [390,844], [844,390], [1440,1000]]) {
    await page.setViewportSize({ width, height });
    for (let index = 0; index < loadingScenes.length; index++) {
      await page.goto(`${fixture}?phase=application&scene-index=${index}`);
      const loader = page.getByTestId('loading-screen');
      await expect(loader).toHaveAttribute('data-scene', loadingScenes[index].id);
      await page.locator('.sbl-wordmark').evaluate(image => (image as HTMLImageElement).decode());
      await page.locator('.sbl-background').evaluate(image => (image as HTMLImageElement).decode());
      const view = await composition(page);
      expect(Math.abs(view.logo.x + view.logo.width / 2 - width / 2)).toBeLessThan(1);
      expect(Math.abs(view.logo.y + view.logo.height / 2 - height / 2)).toBeLessThan(1);
      expect(view.fighters.width).toBeLessThanOrEqual(84);
      expect(view.fighters.y).toBeGreaterThan(view.logo.y + view.logo.height);
      expect(view.fighters.y + view.fighters.height).toBeLessThan(height);
      expect(view.controls).toBe(0); expect(view.visibleText).toEqual([]);
      await expect(loader.locator('video')).toHaveCount(0);
      await page.screenshot({ path: `${output}/${width}x${height}-${loadingScenes[index].id}.png` });
    }
  }
});

test('pre-React first paint adopts the same random scene and exact composition without a visible handoff', async ({ page }) => {
  await page.setViewportSize({ width:390, height:844 });
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(/\/src\/main\.tsx(?:\?|$)/, async route => { await gate; await route.fulfill({ contentType: 'application/javascript', body: 'import "/e2e/loading.fixture.tsx";' }); });
  await page.goto('/', { waitUntil:'commit' });
  await page.locator('.first-paint-loader .sbl-wordmark').waitFor();
  await page.locator('.sbl-wordmark').evaluate(image => (image as HTMLImageElement).decode());
  await expect(page.locator('.first-paint-loader')).toHaveAttribute('data-scene', /^loading-/);
  const scene = await page.locator('.first-paint-loader').getAttribute('data-scene');
  const before = await composition(page);
  await page.screenshot({ path: `${output}/first-paint-phone.png` });
  release();
  await expect(page.getByTestId('loading-screen')).toHaveAttribute('data-scene', scene!);
  expect(await composition(page)).toEqual(before);
  await page.screenshot({ path: `${output}/react-handoff-phone.png` });
});

test('random visits do not follow a fixed cycle or immediately repeat; phases share one episode', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => Number(localStorage.getItem('random-for-test') || '.1'); });
  await page.goto(`${fixture}?phase=application`);
  const first = await page.getByTestId('loading-screen').getAttribute('data-scene');
  await page.evaluate(() => { localStorage.setItem('squabblemon:last-loading-scene','loading-sunset-street'); localStorage.setItem('random-for-test','.99'); });
  await page.reload();
  await expect(page.getByTestId('loading-screen')).toHaveAttribute('data-scene','loading-fade-park');
  for (let index=0; index<4; index++) {
    const previous = await page.getByTestId('loading-screen').getAttribute('data-scene');
    await page.reload();
    expect(await page.getByTestId('loading-screen').getAttribute('data-scene')).not.toBe(previous);
  }
  expect(first).toBeTruthy();
  const scene = await page.getByTestId('loading-screen').getAttribute('data-scene');
  await page.evaluate(() => (window as FixtureWindow).changeLoadingPhase('account'));
  await expect(page.getByTestId('loading-status')).toHaveText('Checking your fighter tag');
  await page.evaluate(() => (window as FixtureWindow).remountLoading());
  await expect(page.getByTestId('loading-screen')).toHaveAttribute('data-scene',scene!);
});

test('short waits and player readiness never wait for optional media; active video cleans up on unmount', async ({ page }) => {
  const optional: string[] = [];
  page.on('request', request => { if (/broadcast\/loading\/(?:[^/?]+\.mp4|fighters\.webp)(?:\?|$)/.test(request.url())) optional.push(request.url()); });
  await page.goto(`${fixture}?phase=scene`);
  await page.evaluate(() => (window as FixtureWindow).finishLoading());
  await expect(page.getByText('Ready',{exact:true})).toBeVisible();
  await page.waitForTimeout(1400); expect(optional).toEqual([]);
  await page.evaluate(() => (window as FixtureWindow).startLoading('scene'));
  await expect(page.locator('.sbl-fighters')).toHaveAttribute('src',/\/fighters\.webp$/);
  await expect(page.locator('.sbl-video')).toHaveAttribute('data-playing','true');
  await page.evaluate(() => { (window as any).detachedVideo=document.querySelector('video'); (window as FixtureWindow).finishLoading(); });
  await expect(page.getByText('Ready',{exact:true})).toBeVisible();
  expect(await page.evaluate(() => {const video=(window as any).detachedVideo as HTMLVideoElement;return {paused:video.paused,src:video.getAttribute('src')};})).toEqual({paused:true,src:null});
});

test('reduced motion, data saving and hidden tabs keep still posters and no optional requests', async ({ page }) => {
  await page.addInitScript(() => {
    const connection=Object.assign(new EventTarget(),{saveData:true,effectiveType:'4g',downlink:5});
    Object.defineProperty(navigator,'connection',{configurable:true,value:connection});
  });
  const optional: string[]=[];
  page.on('request',request=>{if(/broadcast\/loading\/(?:[^/?]+\.mp4|fighters\.webp)(?:\?|$)/.test(request.url()))optional.push(request.url());});
  await page.goto(`${fixture}?phase=account`); await page.waitForTimeout(1400);
  await expect(page.locator('video')).toHaveCount(0); await expect(page.locator('.sbl-fighters')).toHaveAttribute('src',/fighters-still\.webp$/); expect(optional).toEqual([]);
  await page.evaluate(()=>{const connection=(navigator as any).connection; connection.saveData=false;connection.dispatchEvent(new Event('change'));});
  await expect(page.locator('.sbl-video')).toHaveAttribute('data-playing','true');
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(page.locator('video')).toHaveCount(0); await expect(page.locator('.sbl-fighters')).toHaveAttribute('src',/fighters-still\.webp$/);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(1400); await expect(page.locator('video')).toHaveCount(0);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.locator('.sbl-video')).toHaveAttribute('data-playing','true');
  await page.evaluate(()=>{document.documentElement.dataset.reduceMotion='true';});
  await expect(page.locator('video')).toHaveCount(0); await expect(page.locator('.sbl-fighters')).toHaveAttribute('src',/fighters-still\.webp$/);
});

test('media errors retain authored stills and accessible loading status without extra UI', async ({ page }) => {
  await page.route('**/brand/broadcast/loading/*.mp4',route=>route.abort());
  await page.route('**/brand/broadcast/loading/fighters.webp',route=>route.abort());
  await page.goto(`${fixture}?phase=player`); await page.waitForTimeout(1600);
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.locator('.sbl-fighters')).toHaveAttribute('src',/fighters-still\.webp$/);
  expect(await page.locator('.sbl-background').evaluate(image=>(image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole('status')).toHaveText('Loading your gang and rewards');
  expect((await composition(page)).visibleText).toEqual([]);
  await page.evaluate(()=>(window as FixtureWindow).finishLoading());
  await expect(page.getByText('Ready',{exact:true})).toBeVisible();
});


test('unavailable fighter animation and still hide the decoration in React and first paint', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/brand/broadcast/loading/fighters*.webp', route => route.abort());
  await page.goto(`${fixture}?phase=application`);
  await expect(page.locator('.sbl-fighters')).toHaveCSS('visibility', 'hidden');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForTimeout(500);
  await expect(page.locator('.sbl-fighters')).toHaveAttribute('src', /fighters-still\.webp$/);
  await expect(page.locator('.sbl-fighters')).toHaveCSS('visibility', 'hidden');
  await expect(page.locator('.sbl-wordmark')).toBeVisible();
  expect((await composition(page)).visibleText).toEqual([]);
  await page.screenshot({ path: `${output}/missing-fighters-react.png` });
  await page.route(/\/src\/main\.tsx(?:\?|$)/, route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.goto('/');
  await expect(page.locator('.first-paint-loader')).toBeVisible();
  await expect(page.locator('.sbl-fighters')).toHaveCSS('visibility', 'hidden');
  await page.waitForTimeout(500);
  await expect(page.locator('.sbl-fighters')).toHaveAttribute('src', /fighters-still\.webp$/);
  await expect(page.locator('.sbl-fighters')).toHaveCSS('visibility', 'hidden');
  await expect(page.locator('.sbl-wordmark')).toBeVisible();
  expect((await composition(page)).visibleText).toEqual([]);
  await page.screenshot({ path: `${output}/missing-fighters-first-paint.png` });
});
