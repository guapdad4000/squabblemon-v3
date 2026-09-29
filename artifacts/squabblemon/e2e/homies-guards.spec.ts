import { expect, test, type Page } from '@playwright/test';
import { installProfileApi, profileBootstrap, signIn } from './fighter-id.fixture';

const self = { friendCode: 'ABCDEF123456', username: 'new_kid', lastActiveAt: null, displayName: 'NEW KID', avatarKey: 'rookie' };
const rival = { friendCode: '000000000001', username: 'the_rival', lastActiveAt: null, displayName: 'THE RIVAL', avatarKey: 'hooper' };
const other = { friendCode: '000000000002', username: 'second_fighter', lastActiveAt: null, displayName: 'SECOND FIGHTER', avatarKey: 'wifey' };
const requestId = 'a5cb97d1-8810-4867-843f-a9fdafc11a91';
const incomingId = 'b5cb97d1-8810-4867-843f-a9fdafc11a92';
const createdAt = '2026-09-23T09:00:00.000Z';
type Player = typeof self;
type Request = { id: string; player: Player; createdAt: string };
type State = {
  self: Player; homies: Player[]; incomingRequests: Request[];
  outgoingRequests: Request[]; blocked: Player[]; invitations: never[];
  counts: { requests: number; invitations: number };
};
function state(overrides: Partial<State> = {}): State {
  const next = { self, homies: [], incomingRequests: [], outgoingRequests: [], blocked: [], invitations: [],
    counts: { requests: 0, invitations: 0 }, ...overrides };
  return { ...next, counts: { requests: next.incomingRequests.length, invitations: 0 } };
}
async function apiFixture(page: Page, options: { holdSend?: boolean } = {}) {
  await signIn(page);
  await installProfileApi(page, { bootstrap: profileBootstrap() });
  let current: State = state();
  let releaseSend!: () => void;
  const gate = new Promise<void>(resolve => { releaseSend = resolve; });
  const mutations: { path: string; body: unknown }[] = [];
  await page.route('**/api/social/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const body = req.method() === 'GET' ? undefined : req.postDataJSON();
    if (req.method() === 'GET' && (path.includes('/lookup/') || path.endsWith('/search'))) {
      const query = (url.searchParams.get('query') ?? '').toLowerCase();
      const code = decodeURIComponent(path.split('/').at(-1)!).toUpperCase();
      const players = path.endsWith('/search')
        ? [self, rival, other].filter(entry => entry.username.includes(query) && entry !== self)
        : [self, rival, other].filter(entry => entry.friendCode === code);
      if (!players.length && !path.endsWith('/search')) return route.fulfill({ status: 404, json: { error: 'Player not found.' } });
      const results = players.map(player => {
      const playerCode = player.friendCode;
      const relationship = player === self ? 'self' : current.blocked.some(item => item.friendCode === playerCode) ? 'blocked'
        : current.homies.some(item => item.friendCode === playerCode) ? 'homie'
          : current.incomingRequests.some(item => item.player.friendCode === playerCode) ? 'incoming'
            : current.outgoingRequests.some(item => item.player.friendCode === playerCode) ? 'outgoing' : 'none';
      const request = [...current.incomingRequests, ...current.outgoingRequests].find(item => item.player.friendCode === playerCode);
      return { player, relationship, requestId: request?.id ?? null };
      });
      return route.fulfill({ json: path.endsWith('/search') ? { players: results } : results[0] });
    }
    mutations.push({ path, body });
    if (req.method() === 'POST' && path.endsWith('/requests')) {
      const code = (body as { friendCode: string }).friendCode;
      if (code !== rival.friendCode) return route.fulfill({ status: 400, json: { error: 'Wrong friend code.' } });
      if (options.holdSend) await gate;
      current = state({ ...current, outgoingRequests: [...current.outgoingRequests, { id: requestId, player: rival, createdAt }] });
    } else if (req.method() === 'POST' && path.includes('/requests/') && path.endsWith('/respond')) {
      const id = path.split('/').at(-2)!;
      const action = (body as { action: string }).action;
      const incoming = current.incomingRequests.find(item => item.id === id);
      const outgoing = current.outgoingRequests.find(item => item.id === id);
      if (!incoming && !outgoing) return route.fulfill({ status: 404, json: { error: 'Request not found.' } });
      if (action === 'accept' && incoming) current = state({ ...current, homies: [...current.homies, incoming.player],
        incomingRequests: current.incomingRequests.filter(item => item.id !== id) });
      else if (action === 'decline' && incoming) current = state({ ...current,
        incomingRequests: current.incomingRequests.filter(item => item.id !== id) });
      else if (action === 'cancel' && outgoing) current = state({ ...current,
        outgoingRequests: current.outgoingRequests.filter(item => item.id !== id) });
      else return route.fulfill({ status: 400, json: { error: 'Invalid request action.' } });
    } else if (req.method() === 'POST' && path.includes('/homies/') && path.endsWith('/remove')) {
      const code = path.split('/').at(-2)!;
      current = state({ ...current, homies: current.homies.filter(item => item.friendCode !== code) });
    } else if (req.method() === 'POST' && path.endsWith('/blocks')) {
      const code = (body as { friendCode: string }).friendCode;
      const blocked = [rival, other].find(item => item.friendCode === code);
      if (!blocked) return route.fulfill({ status: 404, json: { error: 'Player not found.' } });
      current = state({ ...current, blocked: [...current.blocked, blocked],
        homies: current.homies.filter(item => item.friendCode !== code) });
    } else if (req.method() === 'POST' && path.includes('/blocks/') && path.endsWith('/remove')) {
      const code = path.split('/').at(-2)!;
      current = state({ ...current, blocked: current.blocked.filter(item => item.friendCode !== code) });
    } else return route.fulfill({ status: 404, json: { error: `Unhandled social fixture route: ${path}` } });
    return route.fulfill({ json: current });
  });
  await page.route('**/api/social', route => route.fulfill({ json: current }));
  return {
    state: () => structuredClone(current),
    set: (next: State) => { current = structuredClone(next); },
    mutations: () => [...mutations],
    releaseSend,
  };
}

test('dirty Style blocks pending Homies header link and keyboard tabs until Stay is resolved', async ({ page }) => {
  const api = await apiFixture(page);
  api.set(state({ incomingRequests: [{ id: incomingId, player: rival, createdAt }] }));
  await page.goto('/squabblemon/game/settings#style');
  const style = page.getByRole('tab', { name: 'Style' });
  await expect(style).toHaveAttribute('aria-selected', 'true');
  const owned = page.getByTestId('grid-pvp-reactions-owned').locator('[data-testid^="button-reaction-toggle-"]').first();
  await owned.click();
  await expect(page.getByTestId('status-reaction-tray')).toHaveAttribute('data-state', 'dirty');
  const originalDraft = await page.getByTestId('tray-pvp-reactions').innerText();
  await expect(page.getByTestId('homies-pending-count')).toHaveText('1');
  const link = page.locator('.city-header__identity');
  await expect(link).toHaveAttribute('href', /\/game\/settings#homies$/);
  page.once('dialog', dialog => dialog.dismiss());
  await link.click();
  await expect(style).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/\/game\/settings#style$/);
  await expect(page.getByTestId('tray-pvp-reactions')).toHaveText(originalDraft, { useInnerText: true });
  page.once('dialog', dialog => dialog.dismiss());
  await style.focus();
  await page.keyboard.press('ArrowRight');
  await expect(style).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/\/game\/settings#style$/);
  await expect(page.getByTestId('tray-pvp-reactions')).toHaveText(originalDraft, { useInnerText: true });
  expect(api.mutations()).toEqual([]);
});

test('busy Homies locks all four tabs; send, cancel, decline, remove, block and unblock show server truth', async ({ page }) => {
  const api = await apiFixture(page, { holdSend: true });
  await page.goto('/squabblemon/game/settings#homies');
  const homies = page.getByTestId('tab-homies');
  await page.getByTestId('tab-fb-find').click();
  await page.getByTestId('input-search').fill(rival.username);
  await expect(page.getByTestId(`row-found-${rival.username}`)).toContainText(`@${rival.username}`);
  await page.getByTestId(`button-add-${rival.username}`).click();
  await expect.poll(() => api.mutations().length).toBe(1);
  for (const name of ['overview', 'style', 'homies', 'settings']) await expect(page.getByTestId(`tab-${name}`)).toBeDisabled();
  await page.keyboard.press('ArrowRight');
  await expect(homies).toHaveAttribute('aria-selected', 'true');
  api.releaseSend();
  await page.getByTestId('tab-fb-requests').click();
  await expect(page.getByTestId(`row-outgoing-${requestId}`)).toBeVisible();
  await expect(homies).toBeEnabled();
  await page.getByTestId(`button-cancel-${requestId}`).click();
  await expect(page.getByTestId(`row-outgoing-${requestId}`)).toHaveCount(0);
  expect(api.state().outgoingRequests).toHaveLength(0);

  api.set(state({ incomingRequests: [{ id: incomingId, player: rival, createdAt }] }));
  await page.reload();
  await expect(page.getByTestId('tab-homies').locator('.fighter-tab__badge')).toHaveText('1');
  await page.getByTestId('tab-fb-requests').click();
  await page.getByTestId(`button-decline-${incomingId}`).click();
  await expect(page.getByTestId(`row-incoming-${incomingId}`)).toHaveCount(0);
  await expect(page.getByTestId('tab-homies').locator('.fighter-tab__badge')).toHaveCount(0);

  api.set(state({ homies: [rival, other] }));
  await page.reload();
  page.once('dialog', dialog => dialog.accept());
  await page.getByTestId(`button-remove-${rival.username}`).click();
  await expect(page.getByTestId(`row-homie-${rival.username}`)).toHaveCount(0);
  await expect(page.getByTestId(`row-homie-${other.username}`)).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByTestId(`button-block-${other.username}`).click();
  await expect(page.getByTestId(`row-homie-${other.username}`)).toHaveCount(0);
  await expect(page.getByTestId(`row-blocked-${other.username}`)).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByTestId(`button-unblock-${other.username}`).click();
  await expect(page.getByTestId(`row-blocked-${other.username}`)).toHaveCount(0);
  expect(api.state().homies).toEqual([]);
  expect(api.state().blocked).toEqual([]);
  expect(api.mutations().map(item => item.path)).toEqual([
    '/api/social/requests',
    `/api/social/requests/${requestId}/respond`,
    `/api/social/requests/${incomingId}/respond`,
    `/api/social/homies/${rival.friendCode}/remove`,
    '/api/social/blocks',
    `/api/social/blocks/${other.friendCode}/remove`,
  ]);
});