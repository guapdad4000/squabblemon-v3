import { expect, test, type Page } from '@playwright/test';

const fixture = '/squabblemon/e2e/fade-marker.fixture.html';
const preferenceKey = 'squabblemon_battle_feedback';

type VoiceEvent = {
  name: string;
  event: 'created' | 'loadedmetadata' | 'play' | 'pause' | 'ended' | 'error';
  at: number;
  currentTime: number;
  duration: number;
};

async function observeNativeVoiceAudio(page: Page, audioEnabled = true) {
  await page.addInitScript(({ key, enabled }) => {
    localStorage.setItem(key, JSON.stringify({ audioEnabled: enabled, hapticsEnabled: false }));
    const NativeAudio = window.Audio;
    const events: VoiceEvent[] = [];
    (window as typeof window & { __voiceEvents: VoiceEvent[] }).__voiceEvents = events;
    window.Audio = new Proxy(NativeAudio, {
      construct(target, args) {
        const audio = Reflect.construct(target, args) as HTMLAudioElement;
        const src = String(args[0] ?? '');
        if (!src.includes('/audio/voice/dr-fade/')) return audio;
        const name = src.split('/').at(-1) ?? src;
        const record = (event: VoiceEvent['event']) => events.push({
          name,
          event,
          at: performance.now(),
          currentTime: audio.currentTime,
          duration: audio.duration,
        });
        record('created');
        for (const event of ['loadedmetadata', 'play', 'pause', 'ended', 'error'] as const) {
          audio.addEventListener(event, () => record(event));
        }
        return audio;
      },
    });
  }, { key: preferenceKey, enabled: audioEnabled });
}

async function routeLobby(page: Page, transitionToActive: boolean) {
  let searched = false;
  await page.route('**/api/multiplayer/ranked**', async route => {
    const isSearch = route.request().method() === 'POST';
    if (isSearch) searched = true;
    const room = searched
      ? {
          code: 'MARKER',
          status: !isSearch && transitionToActive ? 'active' : 'waiting',
          ranked: { queuedAt: new Date().toISOString() },
        }
      : null;
    await route.fulfill({ json: { room } });
  });
}

for (const format of [
  { extension: 'm4a', mime: 'audio/mp4' },
  { extension: 'ogg', mime: 'audio/ogg; codecs="vorbis"' },
] as const) {
  test(`fade marker ${format.extension} decodes and contains the complete phrase`, async ({ page }) => {
    await page.goto(fixture);
    const support = await page.evaluate(mime => document.createElement('audio').canPlayType(mime), format.mime);
    test.skip(!support, `${format.mime} is not supported by this browser`);

    await page.evaluate(async ({ extension }) => {
      const audio = new Audio(`/squabblemon/audio/voice/dr-fade/fade-marker.${extension}`);
      await new Promise<void>((resolve, reject) => {
        audio.addEventListener('loadedmetadata', () => resolve(), { once: true });
        audio.addEventListener('error', () => reject(new Error(`decode failed: ${audio.error?.message ?? 'unknown media error'}`)), { once: true });
        audio.load();
      });
      const duration = audio.duration;
      const button = document.createElement('button');
      button.id = 'play-asset';
      button.textContent = 'Play asset';
      document.body.append(button);
      (window as typeof window & { __assetPlayback: Promise<{ duration: number; elapsed: number; ended: boolean }> }).__assetPlayback =
        new Promise((resolve, reject) => {
          button.addEventListener('click', () => {
            const started = performance.now();
            audio.addEventListener('ended', () => resolve({
              duration,
              elapsed: (performance.now() - started) / 1000,
              ended: audio.ended,
            }), { once: true });
            audio.addEventListener('error', () => reject(new Error(`playback failed: ${audio.error?.message ?? 'unknown media error'}`)), { once: true });
            void audio.play().catch(reject);
          }, { once: true });
        });
    }, format);
    await page.locator('#play-asset').click();
    const result = await page.evaluate(() =>
      (window as typeof window & {
        __assetPlayback: Promise<{ duration: number; elapsed: number; ended: boolean }>;
      }).__assetPlayback,
    );

    expect(result.duration).toBeGreaterThanOrEqual(1.9);
    expect(result.duration).toBeLessThanOrEqual(2.3);
    expect(result.elapsed).toBeGreaterThanOrEqual(1.8);
    expect(result.ended).toBe(true);
  });
}

test('Find a fade marker survives the waiting-to-active lobby unmount', async ({ page }) => {
  await observeNativeVoiceAudio(page);
  await routeLobby(page, true);
  await page.goto(fixture);
  await expect(page.getByTestId('find-ranked-fade')).toBeEnabled();

  // Let the delayed welcome start first: Find a fade must stop it, then never
  // recreate it over the transition marker.
  await page.waitForTimeout(350);
  await page.getByTestId('find-ranked-fade').click();
  await expect(page.getByTestId('ranked-search')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByTestId('active-room')).toBeVisible();
  await expect.poll(() => page.evaluate(() =>
    (window as typeof window & { __voiceEvents: VoiceEvent[] }).__voiceEvents
      .some(event => event.name.startsWith('fade-marker.') && event.event === 'ended'),
  ), { timeout: 10_000 }).toBe(true);

  const events = await page.evaluate(() =>
    (window as typeof window & { __voiceEvents: VoiceEvent[] }).__voiceEvents,
  );
  const markerPlay = events.findIndex(event => event.name.startsWith('fade-marker.') && event.event === 'play');
  const markerEnd = events.findIndex(event => event.name.startsWith('fade-marker.') && event.event === 'ended');
  expect(markerPlay).toBeGreaterThan(-1);
  expect(markerEnd).toBeGreaterThan(markerPlay);
  expect(events[markerEnd].duration).toBeGreaterThanOrEqual(1.9);
  expect(events[markerEnd].currentTime).toBeCloseTo(events[markerEnd].duration, 1);
  // Native media emits "pause" immediately before "ended" at the natural end.
  // Only a pause before reaching that endpoint means the transition cut it off.
  expect(events.slice(markerPlay, markerEnd).some(event =>
    event.name.startsWith('fade-marker.') && event.event === 'pause'
      && (!Number.isFinite(event.duration) || event.currentTime < event.duration - 0.05),
  )).toBe(false);
  expect(events.slice(markerPlay + 1).some(event =>
    event.name.startsWith('fade-park-welcome.') && event.event === 'play',
  )).toBe(false);
});

test('muted feedback preference suppresses Fade Park voice', async ({ page }) => {
  await observeNativeVoiceAudio(page, false);
  await routeLobby(page, false);
  await page.goto(fixture);
  await page.waitForTimeout(350);
  await page.getByTestId('find-ranked-fade').click();
  await expect(page.getByTestId('ranked-search')).toBeVisible();
  expect(await page.evaluate(() =>
    (window as typeof window & { __voiceEvents: VoiceEvent[] }).__voiceEvents,
  )).toEqual([]);
});