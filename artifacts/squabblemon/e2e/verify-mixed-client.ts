import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

/** Real old/new transport modules in browsers, connected to the test API. */
export async function verifyMixedClientBrowser(options: {origin: string; oldRoot: string; newRoot: string; queueUser: string; friendUser: string; friendCode: string}) {
  const roots = [options.oldRoot, options.newRoot];
  const files = roots.map(() => `e2e/mixed-transport-${randomUUID()}`);
  const source = `import { request } from '../src/lib/multiplayer';\n(window as any).compatRequest = request;`;
  const servers = [];
  const browser = await chromium.launch({headless: true});
  try {
    for (let i = 0; i < roots.length; i++) {
      await mkdir(resolve(roots[i], 'e2e'), {recursive: true});
      await writeFile(resolve(roots[i], `${files[i]}.ts`), source);
      await writeFile(resolve(roots[i], `${files[i]}.html`), `<html><body><script type="module" src="/${files[i]}.ts"></script></body></html>`);
      process.env.PORT = String(43401 + i); process.env.BASE_PATH = '/';
      const server = await createServer({root: roots[i], configFile: resolve(roots[i], 'vite.config.ts'), optimizeDeps: {noDiscovery: true, include: []}, server: {host: '127.0.0.1', port: 43401+i, strictPort: true, hmr: false}});
      await server.listen(); servers.push(server);
    }
    const open = async (index: number, userId: string) => {
      const page = await browser.newPage();
      const observed: string[] = [];
      page.on('pageerror', e => observed.push(e.message));
      const headers: string[] = [];
      await page.route('**/api/multiplayer**', async route => {
        const original = new URL(route.request().url());
        headers.push(route.request().headers()['x-squabblemon-capabilities'] ?? '');
        const response = await route.fetch({url: options.origin + original.pathname.split('/api/multiplayer')[1] + original.search,
          headers: {...route.request().headers(), 'x-test-user': userId}});
        await route.fulfill({response});
      });
      await page.goto(`http://127.0.0.1:${43401+index}/${files[index]}.html`);
      await page.waitForFunction(() => typeof (window as any).compatRequest === 'function', null, {timeout: 8000});
      return {page, headers, observed};
    };
    const call = (page: Awaited<ReturnType<typeof open>>['page'], path: string, body?: unknown) => page.evaluate(async ({path, body}) => {
      try { return {ok: true, data: await (window as any).compatRequest(path, body)}; }
      catch (error: any) { return {ok: false, status: error.status, message: error.data?.error ?? error.message}; }
    }, {path, body});
    const oldQueue = await open(0, options.queueUser), newQueue = await open(1, options.queueUser);
    const oldRank = await call(oldQueue.page, '/ranked');
    assert.equal(oldRank.ok, true); assert.equal(oldRank.data.room.status, 'waiting');
    const newRank = await call(newQueue.page, '/ranked');
    assert.equal(newRank.ok, true); assert.equal(newRank.data.room.status, 'active');
    const stale = await call(oldQueue.page, '/ranked');
    assert.equal(stale.ok, false); assert.equal(stale.status, 409); assert.match(stale.message, /Refresh the page/);
    const oldFriend = await open(0, options.friendUser), newFriend = await open(1, options.friendUser);
    const oldJoin = await call(oldFriend.page, `/${options.friendCode}/join`, {deckId: 'custom'});
    assert.equal(oldJoin.ok, false); assert.equal(oldJoin.status, 409);
    const newJoin = await call(newFriend.page, `/${options.friendCode}/join`, {deckId: 'custom'});
    assert.equal(newJoin.ok, true); assert.equal(newJoin.data.status, 'waiting');
    const oldReactions = await call(oldFriend.page, `/${options.friendCode}/reactions`);
    const newReactions = await call(newFriend.page, `/${options.friendCode}/reactions`);
    assert.equal(oldReactions.ok, true); assert.equal(oldReactions.data.latest.player, undefined);
    assert.equal(newReactions.ok, true); assert.equal(newReactions.data.latest.player?.reactionId, 'reaction:yakub:laugh:v1');
    assert(oldQueue.headers.every(value => value === '') && oldFriend.headers.every(value => value === ''));
    assert(newQueue.headers.every(value => value === 'anunaki-v1') && newFriend.headers.every(value => value === 'anunaki-v1'));
    for (const session of [oldQueue, newQueue, oldFriend, newFriend]) assert.deepEqual(session.observed, []);
    return {oldRank: oldRank.data.room.status, newRank: newRank.data.room.status, staleStatus: stale.status, oldJoin: oldJoin.status, newJoin: newJoin.data.status, legacyReactionFiltered: true, updatedReactionVisible: true};
  } finally {
    await browser.close();
    for (const server of servers) await server.close();
    for (let i = 0; i < roots.length; i++) for (const extension of ['ts', 'html']) await unlink(resolve(roots[i], `${files[i]}.${extension}`)).catch(() => {});
  }
}
