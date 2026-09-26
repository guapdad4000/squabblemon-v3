import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from '@playwright/test';
import { createServer } from 'vite';

export async function verifyRankedBrowser({ origin, accounts, forceBot }: {
  origin: string; accounts: Array<{ userId: string; bootstrap: unknown }>;
  forceBot: (code: string) => Promise<void>;
}) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const fixture = `e2e/park-browser-${randomUUID()}.tsx`;
  process.env.PORT = '4201'; process.env.BASE_PATH = '/';
  const source = `import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Switch, Route } from 'wouter';
import { Multiplayer } from '../src/pages/game/Multiplayer';
import '../src/index.css';
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const profile = (window as any).__profile; document.documentElement.dataset.reduceMotion = 'true';
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={client}><Switch><Route path='/game/online/:code'>{p => <Multiplayer key={p.code} code={p.code} bootstrap={profile} />}</Route><Route><Multiplayer bootstrap={profile} /></Route></Switch></QueryClientProvider></StrictMode>);`;
  await writeFile(resolve(root, fixture), source);
  const server = await createServer({ root, configFile: resolve(root, 'vite.config.ts'), server: { host: '127.0.0.1', port: 4201, strictPort: true } });
  const output = resolve(root, '../../screenshots'); await mkdir(output, { recursive: true });
  const errors: string[] = [];
  let browser;
  try {
    await server.listen(); browser = await chromium.launch({ channel: 'msedge', headless: true });
    const pages: Page[] = [];
    for (const [index, account] of accounts.entries()) {
      const page = await browser.newPage({ viewport: index === 0 ? { width: 1280, height: 900 } : { width: 390, height: 844 }, reducedMotion: 'reduce' });
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(bootstrap => { (window as any).__profile = bootstrap; }, account.bootstrap);
      await page.route('**/api/multiplayer**', async route => {
        const suffix = new URL(route.request().url()).pathname.split('/api/multiplayer')[1];
        const response = await route.fetch({ url: origin + suffix, headers: { ...route.request().headers(), 'x-test-user': account.userId } });
        await route.fulfill({ response });
      });
      await page.route('**/game/**', async route => {
        if (!new URL(route.request().url()).pathname.startsWith('/game/')) return route.continue();
        const html = await server.transformIndexHtml('/game/online', `<html><head><meta name='viewport' content='width=device-width, initial-scale=1' /></head><body><div id='root'></div><script type='module' src='/${fixture}'></script></body></html>`);
        await route.fulfill({ contentType: 'text/html', body: html });
      });
      await page.goto('http://127.0.0.1:4201/game/online');
      await page.getByTestId('find-ranked-fade').waitFor();
      pages.push(page);
    }
    const [a, b] = pages;
    const noOverflow = async (p: Page) => assert(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal overflow');
    for (const p of pages) { await noOverflow(p); await p.screenshot({ path: resolve(output, `fade-park-${p.viewportSize()!.width}.png`), fullPage: true }); }
    await b.setViewportSize({ width: 320, height: 740 }); await noOverflow(b);
    await b.screenshot({ path: resolve(output, 'fade-park-320.png'), fullPage: true });
    await b.setViewportSize({ width: 390, height: 844 });
    await a.getByTestId('find-ranked-fade').click(); await a.getByTestId('ranked-search').waitFor();
    await a.getByRole('button', { name: 'Hang up — cancel search', exact: true }).click();
    await a.getByTestId('find-ranked-fade').waitFor();
    await a.getByTestId('find-ranked-fade').click(); await a.getByTestId('ranked-search').waitFor();
    await b.getByTestId('find-ranked-fade').click();
    await Promise.all(pages.map(p => p.getByTestId('online-battle').waitFor()));
    for (const p of pages) {
      await p.getByTestId('battle-arena').waitFor();
      await p.getByTestId('match-arrival').waitFor({ state: 'hidden', timeout: 2000 });
      assert.equal(await p.locator('.online-arena').count(), 0, 'legacy vertical board is gone');
      const bounds = await p.locator('.battlefield-grid > [data-drop-lane]').evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
      assert.equal(bounds.length, 3); assert(Math.abs(bounds[0].y - bounds[2].y) < 2, 'all three districts sit side by side');
      const actions = await p.locator('.battle-actions').boundingBox(); assert(actions && actions.y + actions.height <= p.viewportSize()!.height + 1, 'actions fit inside viewport');
      await noOverflow(p);
    }
    const activeIndex = await a.getByTestId('online-battle').getAttribute('data-turn') === 'you' ? 0 : 1;
    const active = pages[activeIndex], rival = pages[1 - activeIndex];
    const code = new URL(active.url()).pathname.split('/').at(-1)!;
    const read = async (index: number) => (await fetch(`${origin}/${code}`, { headers: { 'x-test-user': accounts[index].userId } })).json();
    const snapshot = await read(activeIndex);
    const card = snapshot.hand.find((c: any) => c.costs.some((cost: number, lane: number) => cost <= snapshot.motion[snapshot.seat] && !snapshot.lockedLanes?.includes(lane)));
    assert(card, 'opening hand has a legal play');
    const lane = card.costs.findIndex((cost: number, lane: number) => cost <= snapshot.motion[snapshot.seat] && !snapshot.lockedLanes?.includes(lane));
    await active.getByTestId('hand-tray').locator(`[data-instance-id="${card.instanceId}"]`).click();
    await active.getByTestId(`lane-${lane}`).click();
    await active.getByTestId('button-lock').click();
    await active.getByTestId('hand-tray').locator(`[data-instance-id="${card.instanceId}"]`).waitFor({ state: 'hidden' });
    await rival.locator(`.battlefield-grid [data-instance-id="${card.instanceId}"]`).waitFor();
    for (const [i, p] of pages.entries()) {
      const latest = await read(i);
      await p.waitForFunction(revision => Number(document.querySelector('[data-testid=online-battle]')?.getAttribute('data-revision')) >= revision, latest.revision);
      await p.waitForTimeout(750);
      for (const score of latest.scores) {
        assert.equal(Number(await p.getByTestId(`score-player-${score.lane}`).innerText()), score[latest.seat]);
        assert.equal(Number(await p.getByTestId(`score-cpu-${score.lane}`).innerText()), score[latest.seat === 'player' ? 'cpu' : 'player']);
      }
      await p.screenshot({ path: resolve(output, `pvp-shared-board-${p.viewportSize()!.width}.png`) });
    }
    await active.getByTestId('button-next-round').click();
    await rival.getByTestId('button-next-round').waitFor();
    await rival.reload(); await rival.getByTestId('battle-arena').waitFor();
    assert.equal(await rival.getByTestId('online-battle').getAttribute('data-turn'), 'you', 'reload resumes the same turn');
    await rival.getByLabel('Battle menu', { exact: true }).click();
    await rival.getByRole('button', { name: /exit|leave|surrender/i }).first().click();
    await rival.getByRole('button', { name: 'Surrender', exact: true }).click();
    await Promise.all(pages.map(p => p.getByTestId('ranked-result').waitFor()));
    for (const p of pages) assert.equal(await p.getByRole('button', { name: /rematch/i }).count(), 0);
    await b.getByRole('button', { name: 'Back to Fade Park', exact: true }).click();
    await b.getByTestId('find-ranked-fade').waitFor();
    await b.getByRole('link', { name: /Friend fades/ }).click();
    await b.getByRole('button', { name: 'Create friend fade', exact: true }).click();
    const privateCode = await b.getByTestId('online-room-code').innerText();
    await a.goto('http://127.0.0.1:4201/game/online/' + privateCode);
    await a.getByRole('button', { name: 'Join your friend', exact: true }).click();
    await Promise.all(pages.map(p => p.getByTestId('online-ready').click()));
    await Promise.all(pages.map(p => p.getByTestId('battle-arena').waitFor()));
    await a.getByTestId('match-arrival').waitFor({ state: 'hidden', timeout: 2000 });
    const surrender = async (p: Page) => {
      await p.getByLabel('Battle menu', { exact: true }).click();
      await p.getByRole('button', { name: 'Leave battle', exact: true }).click();
      await p.getByRole('button', { name: 'Surrender', exact: true }).click();
    };
    await surrender(a);
    await a.getByRole('button', { name: 'Ask for a rematch', exact: true }).click();
    await b.getByRole('button', { name: 'Accept rematch', exact: true }).click();
    await Promise.all(pages.map(p => p.getByTestId('online-ready').click()));
    await Promise.all(pages.map(p => p.getByTestId('battle-arena').waitFor()));
    await a.getByTestId('match-arrival').waitFor({ state: 'hidden', timeout: 2000 });
    assert.equal(await a.getByTestId('online-battle').getAttribute('data-status'), 'active');
    await surrender(a);
    await b.getByRole('button', { name: 'Back to friend fades', exact: true }).click();
    await b.getByRole('link', { name: /Fade Park/ }).click();
    await b.getByTestId('find-ranked-fade').click();
    await b.getByTestId('ranked-search').waitFor();
    await b.screenshot({ path: resolve(output, 'fade-park-search-phone.png'), fullPage: true });
    const queue = await (await fetch(`${origin}/ranked`, { headers: { 'x-test-user': accounts[1].userId } })).json();
    await forceBot(queue.room.code);
    await b.getByTestId('battle-arena').waitFor();
    await b.getByText(/Rival \/\/ Park bot/i).waitFor();
    await noOverflow(b);
    assert.deepEqual(errors, []);
    console.log('Browser → real API → isolated database: ranked search, cancel, pairing, shared board at 390/1280px, 320px lobby, card play, opponent sync, reconnect, rank result, private invites, rematches and bot fallback passed.');
  } catch (error) {
    console.error('Browser console:', errors);
    for (const context of browser?.contexts() ?? []) for (const page of context.pages()) {
      console.error('Browser state:', page.url(), (await page.locator('body').innerText()).slice(0, 2200));
      await page.screenshot({ path: resolve(output, 'fade-park-failure-' + page.viewportSize()?.width + '.png'), fullPage: true });
    }
    throw error;
  } finally { await browser?.close(); await server.close(); await unlink(resolve(root, fixture)); }
}
