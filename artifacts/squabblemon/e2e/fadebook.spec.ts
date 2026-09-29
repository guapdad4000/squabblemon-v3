import { expect, test, type Page } from '@playwright/test';
import type { SocialInvitation, SocialLookup, SocialPlayer, SocialState } from '@workspace/api-client-react';
import { installProfileApi, profileBootstrap, signIn } from './fighter-id.fixture';

const person = (n: number, username = `fighter_${n}`): SocialPlayer => ({
  friendCode: n.toString(16).toUpperCase().padStart(12, '0'),
  username, displayName: `Fighter ${n}`, avatarKey: 'hooper', lastActiveAt: null,
});
const self = person(900, 'host');
const rival = person(1, 'rival');
const visitor = person(2, 'visitor');
const newcomer = person(3, 'newcomer');
const blocked = person(4, 'blocked_one');
const crowd = Array.from({ length: 30 }, (_, i) => person(i + 100, `crowd_${i + 1}`));
const all = [self, rival, visitor, newcomer, blocked, ...crowd];
const createdAt = '2026-09-23T09:00:00.000Z';
type Relation = SocialLookup['relationship'];

async function setup(page: Page, initial: Record<string, Relation> = {}) {
  await signIn(page);
  await installProfileApi(page, { bootstrap: profileBootstrap() });
  const self = person(900, 'host');
  const relations = new Map<string, Relation>(Object.entries(initial));
  const newerLookups = new Map<string, SocialLookup>();
  const failures = new Map<string, number>();
  const calls: string[] = [];
  const invitations: SocialInvitation[] = [];
  let failState = false;
  let hold: (() => void) | undefined;
  const gate = () => new Promise<void>(resolve => { hold = resolve; });
  let pendingGate: Promise<void> | undefined;
  let releaseSearch!: () => void;
  let pendingSearch: Promise<void> | undefined;
  let searchSnapshots = 0;
  const relation = (p: SocialPlayer): Relation => p.friendCode === self.friendCode ? 'self' : relations.get(p.username) ?? 'none';
  const requestId = (p: SocialPlayer) => `request-${p.username}`;
  const lookup = (p: SocialPlayer): SocialLookup => newerLookups.get(p.username) ?? ({
    player: p, relationship: relation(p),
    requestId: ['incoming', 'outgoing'].includes(relation(p)) ? requestId(p) : null,
  });
  const state = (): SocialState => {
    const select = (r: Relation) => all.filter(p => relation(p) === r);
    const incomingRequests = select('incoming').map(player => ({ id: requestId(player), player, createdAt }));
    const outgoingRequests = select('outgoing').map(player => ({ id: requestId(player), player, createdAt }));
    return {
      self, homies: select('homie'), incomingRequests, outgoingRequests, blocked: select('blocked'),
      invitations: structuredClone(invitations),
      counts: { requests: incomingRequests.length, invitations: invitations.filter(i => i.direction === 'incoming' && i.status === 'pending').length },
    };
  };
  await page.route('**/api/social**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (path === '/api/social' && method === 'GET') {
      return failState ? route.fulfill({ status: 503, json: { error: 'Connection unavailable.' } }) : route.fulfill({ json: state() });
    }
    if (path === '/api/social/search' && method === 'GET') {
      const query = (url.searchParams.get('query') ?? '').toLowerCase().replace(/^@/, '');
      const found = all.filter(p => (p.username.toLowerCase().startsWith(query) || p.displayName.toLowerCase().startsWith(query)) && p.friendCode !== self.friendCode && relation(p) !== 'blocked').slice(0, 12);
      // Snapshot on receipt, before any held response. A later mutation must
      // outrank this older answer, rather than appearing to belong to its state.
      const players = found.map(lookup);
      searchSnapshots++;
      if (pendingSearch) await pendingSearch;
      return route.fulfill({ json: { players } });
    }
    if (path.startsWith('/api/social/lookup/') && method === 'GET') {
      const p = all.find(item => item.friendCode === decodeURIComponent(path.split('/').at(-1)!).toUpperCase());
      return p ? route.fulfill({ json: lookup(p) }) : route.fulfill({ status: 404, json: { error: 'Unknown page.' } });
    }
    if (method === 'PATCH' && path === '/api/social/username') {
      const { username } = request.postDataJSON();
      calls.push(`username:${username}`);
      if (username === 'taken') return route.fulfill({ status: 409, json: { error: 'That username is already taken.' } });
      self.username = username;
      return route.fulfill({ json: state() });
    }
    if (method === 'POST' && path === '/api/social/requests') {
      const { friendCode } = request.postDataJSON();
      calls.push(`send:${friendCode}`);
      if (pendingGate) await pendingGate;
      if (failures.get('send')) { failures.set('send', failures.get('send')! - 1); return route.fulfill({ status: 503, json: { error: 'Request was not confirmed.' } }); }
      const p = all.find(item => item.friendCode === friendCode);
      if (!p || relation(p) !== 'none') return route.fulfill({ status: 409, json: { error: 'Relationship already exists.' } });
      relations.set(p.username, 'outgoing');
      return route.fulfill({ json: state() });
    }
    const respond = path.match(/^\/api\/social\/requests\/([^/]+)\/respond$/);
    if (method === 'POST' && respond) {
      const p = all.find(item => requestId(item) === respond[1]);
      const { action } = request.postDataJSON();
      calls.push(`${action}:${respond[1]}`);
      if (!p || !(action === 'accept' && (relation(p) === 'incoming' || newerLookups.get(p.username)?.relationship === 'incoming') ||
        ['decline', 'cancel'].includes(action) && ['incoming', 'outgoing'].includes(relation(p)))) {
        return route.fulfill({ status: 409, json: { error: 'Request changed.' } });
      }
      newerLookups.delete(p.username);
      relations.set(p.username, action === 'accept' ? 'homie' : 'none');
      return route.fulfill({ json: state() });
    }
    const remove = path.match(/^\/api\/social\/homies\/([^/]+)\/remove$/);
    const unblock = path.match(/^\/api\/social\/blocks\/([^/]+)\/remove$/);
    if (method === 'POST' && (remove || unblock || path === '/api/social/blocks')) {
      const code = remove?.[1] ?? unblock?.[1] ?? request.postDataJSON().friendCode;
      const p = all.find(item => item.friendCode === code);
      const action = remove ? 'remove' : unblock ? 'unblock' : 'block';
      calls.push(`${action}:${code}`);
      if (!p) return route.fulfill({ status: 404, json: { error: 'Unknown fighter.' } });
      relations.set(p.username, action === 'block' ? 'blocked' : 'none');
      return route.fulfill({ json: state() });
    }
    return route.fulfill({ status: 404, json: { error: `Unexpected ${method} ${path}` } });
  });
  return {
    state, calls, relations, invitations, newerLookups,
    failState(value: boolean) { failState = value; },
    failNext(action: string) { failures.set(action, 1); },
    holdSend() { pendingGate = gate(); },
    releaseSend() { hold?.(); pendingGate = undefined; },
    holdSearch() { pendingSearch = new Promise(resolve => { releaseSearch = resolve; }); },
    releaseSearch() { releaseSearch(); pendingSearch = undefined; },
    searchSnapshots: () => searchSnapshots,
  };
}

async function open(page: Page, suffix = '') {
  await page.goto(`/squabblemon/game/settings${suffix}#homies`);
  // Cold Vite module transforms can keep the real lazy-loaded route on its
  // suspense shell longer than Playwright's normal five-second assertion.
  await expect(page.getByTestId('homies-fadebook')).toBeVisible({ timeout: 20_000 });
  return page.getByTestId('homies-fadebook');
}
async function section(page: Page, name: 'Homies' | 'Requests' | 'Find Players') {
  const tab = page.getByRole('tablist', { name: 'Fadebook sections' }).getByRole('tab', { name: new RegExp(`^${name}`) });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}
async function search(page: Page, query: string) {
  await section(page, 'Find Players');
  await page.getByRole('searchbox', { name: 'Search by player name or @username' }).fill(query);
  await expect(page.getByTestId('list-search')).toBeVisible();
}
async function refresh(page: Page, api: Awaited<ReturnType<typeof setup>>) {
  const before = api.calls.length;
  await page.reload();
  await expect(page.getByTestId('homies-fadebook')).toBeVisible();
  expect(api.calls).toHaveLength(before);
}
async function screenshot(page: Page, label: string) {
  const path = test.info().outputPath(`${label}.png`);
  await page.screenshot({ path, animations: 'disabled' });
  await test.info().attach(label, { path, contentType: 'image/png' });
}

test('actual authenticated shell uses supplied logo, handle, editable name and collision feedback', async ({ page }) => {
  const api = await setup(page);
  const fb = await open(page);
  const logo = fb.getByRole('img', { name: 'Fadebook' });
  await expect(logo).toHaveAttribute('src', /\/assets\/homies\/fadebook-logo-transparent\.png$/);
  await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(fb.getByTestId('text-username')).toHaveText('@host');
  await expect(page.locator('.sq-device, .sq-device__screen')).toHaveCount(0);
  await expect(fb).not.toContainText(self.friendCode);
  await fb.getByRole('button', { name: 'Change' }).click();
  const input = fb.getByRole('textbox', { name: 'New username' });
  await input.fill('@taken');
  await fb.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(fb.getByRole('alert')).toContainText('already taken');
  await expect(fb.getByTestId('text-username')).toHaveCount(0);
  await input.fill('new_host');
  await fb.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(fb.getByTestId('text-username')).toHaveText('@new_host');
  expect(api.calls).toEqual(['username:taken', 'username:new_host']);
  await refresh(page, api);
  await expect(page.getByTestId('text-username')).toHaveText('@new_host');
  await section(page, 'Requests');
  await section(page, 'Find Players');
  await section(page, 'Homies');
});

test('Find Players accepts player-name prefixes and @username without claiming an exact handle', async ({ page }) => {
  await setup(page);
  await open(page);
  await section(page, 'Find Players');
  const field = page.getByRole('searchbox', { name: 'Search by player name or @username' });
  await expect(field).toHaveAttribute('placeholder', 'Player name or @username');
  await expect(page.locator('#fb-search-help')).toContainText('3–24 characters');
  await field.fill('FIGHTER 100');
  await page.getByTestId('button-search').click();
  await expect(page.getByTestId('row-found-crowd_1')).toContainText('Fighter 100');
  await field.fill('@CROWD_1');
  await page.getByTestId('button-search').click();
  await expect(page.getByTestId('row-found-crowd_1')).toContainText('@crowd_1');
  await field.fill('ighter 100');
  await expect(page.getByText('No players found for “ighter 100”.')).toBeVisible();
  await field.fill('a'.repeat(25));
  await expect(page.getByTestId('button-search')).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('up to 24 characters');
});

test('search caps at 12 named portrait results; confirmation precedes one send, cancel and safe existing relationship', async ({ page }) => {
  const api = await setup(page, { rival: 'homie' });
  await open(page);
  await search(page, 'crowd_');
  const results = page.getByTestId('list-search').locator('li');
  await expect(results).toHaveCount(12);
  const found = page.getByTestId('row-found-crowd_1');
  await expect(found).toContainText('Fighter 100');
  await expect(found).toContainText('@crowd_1');
  await expect(found.locator('img')).toHaveCount(1);
  expect(api.calls).toHaveLength(0);
  api.holdSend();
  const send = found.getByRole('button', { name: 'Add Homie' });
  await send.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(found.getByRole('button', { name: /Sending/ })).toBeDisabled();
  api.releaseSend();
  await expect(found).toContainText('Request sent');
  expect(api.calls.filter(call => call === `send:${crowd[0].friendCode}`)).toHaveLength(1);
  await found.getByRole('button', { name: 'Cancel' }).click();
  await expect(found.getByRole('button', { name: 'Add Homie' })).toBeVisible();
  expect(api.calls).toContain('cancel:request-crowd_1');
  await page.getByRole('searchbox', { name: 'Search by player name or @username' }).fill('rival');
  const existing = page.getByTestId('row-found-rival');
  await expect(existing).toContainText('Homies');
  await expect(existing.getByRole('button', { name: 'Add Homie' })).toHaveCount(0);
  expect(api.calls.filter(call => call === `send:${rival.friendCode}`)).toHaveLength(0);
});

test('newer search and shared-link lookup incoming receipts beat stale cached state and accept exact request id', async ({ page }) => {
  const api = await setup(page);
  api.newerLookups.set('newcomer', { player: newcomer, relationship: 'incoming', requestId: 'request-newcomer' });
  api.newerLookups.set('visitor', { player: visitor, relationship: 'incoming', requestId: 'request-visitor' });
  await open(page, `?friend=${visitor.friendCode}`);
  const linked = page.getByTestId('card-lookup');
  await expect(linked).toContainText('@visitor');
  await expect(linked.getByRole('button', { name: 'Accept request' })).toBeVisible();
  await linked.getByRole('button', { name: 'Accept request' }).click();
  await expect(linked).toContainText('Homies');
  expect(api.calls).toContain('accept:request-visitor');
  await page.getByRole('searchbox', { name: 'Search by player name or @username' }).fill('newcomer');
  const found = page.getByTestId('list-search').getByTestId('row-found-newcomer');
  await expect(found.getByRole('button', { name: 'Accept request' })).toBeVisible();
  await found.getByRole('button', { name: 'Accept request' }).click();
  await expect(found).toContainText('Homies');
  expect(api.calls).toContain('accept:request-newcomer');
  expect(api.calls.filter(call => call.startsWith('send:'))).toHaveLength(0);
});

test('delayed old NONE search cannot reopen Add after shared-link request commits outgoing', async ({ page }) => {
  const api = await setup(page);
  api.holdSearch();
  await open(page, `?friend=${newcomer.friendCode}`);
  const linked = page.getByTestId('card-lookup');
  await expect(linked.getByTestId('button-add-newcomer')).toBeVisible();
  await page.getByTestId('input-search').fill('newcomer');
  await expect.poll(api.searchSnapshots).toBe(1);
  // The API fixture captured NONE at the start of the held search.
  expect(api.state().outgoingRequests).toHaveLength(0);
  await linked.getByTestId('button-add-newcomer').click();
  await expect(linked.getByTestId('button-cancel-found-newcomer')).toBeVisible();
  expect(api.state().outgoingRequests[0]?.id).toBe('request-newcomer');
  api.releaseSearch();
  const row = page.getByTestId('list-search').getByTestId('row-found-newcomer');
  await expect(row).toContainText('Request sent');
  await expect(row.getByTestId('button-cancel-found-newcomer')).toBeVisible();
  await expect(row.getByTestId('button-add-newcomer')).toHaveCount(0);
  expect(api.calls.filter(call => call === `send:${newcomer.friendCode}`)).toHaveLength(1);
});

test('top of desktop Fadebook shows supplied transparent logo, profile and first portraits', async ({ page }) => {
  await setup(page, { rival: 'homie', visitor: 'homie' });
  await page.setViewportSize({ width: 1280, height: 800 });
  const fb = await open(page);
  await expect(fb.getByTestId('img-fadebook-logo')).toBeVisible();
  await expect(fb.getByTestId('text-username')).toHaveText('@host');
  await expect(fb.getByTestId('row-homie-rival').locator('img')).toBeVisible();
  await page.locator('#fighter-panel-Homies').evaluate(node => { node.scrollTop = 0; });
  await screenshot(page, 'fadebook-desktop-top');
});

test('incoming accept, decline, remove, block and unblock preserve authoritative relationships', async ({ page }) => {
  const api = await setup(page, { visitor: 'incoming', rival: 'homie', newcomer: 'incoming', blocked_one: 'blocked' });
  await open(page);
  await section(page, 'Requests');
  await page.getByTestId('row-incoming-request-visitor').getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByTestId('row-incoming-request-visitor')).toHaveCount(0);
  await page.getByTestId('row-incoming-request-newcomer').getByRole('button', { name: 'Decline' }).click();
  await section(page, 'Homies');
  await expect(page.getByTestId('row-homie-visitor')).toContainText('@visitor');
  page.on('dialog', dialog => void dialog.accept());
  await page.getByTestId('row-homie-rival').getByRole('button', { name: 'Remove Fighter 1' }).click();
  await expect(page.getByTestId('row-homie-rival')).toHaveCount(0);
  await page.getByTestId('row-homie-visitor').getByRole('button', { name: 'Block Fighter 2' }).click();
  await expect(page.getByTestId('row-blocked-visitor')).toBeVisible();
  await page.getByTestId('row-blocked-visitor').getByRole('button', { name: 'Unblock' }).click();
  await expect(page.getByTestId('row-blocked-visitor')).toHaveCount(0);
  expect(api.calls).toEqual([
    'accept:request-visitor', 'decline:request-newcomer', `remove:${rival.friendCode}`,
    `block:${visitor.friendCode}`, `unblock:${visitor.friendCode}`,
  ]);
  await refresh(page, api);
  await expect(page.getByTestId('row-blocked-blocked_one')).toBeVisible();
});

test('failed social read and failed send show retry without claiming success', async ({ page }) => {
  const api = await setup(page);
  api.failState(true);
  await page.goto('/squabblemon/game/settings#homies');
  await expect(page.getByRole('alert')).toContainText('Connection unavailable');
  api.failState(false);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByTestId('homies-fadebook')).toBeVisible();
  await search(page, 'newcomer');
  api.failNext('send');
  await page.getByTestId('row-found-newcomer').getByRole('button', { name: 'Add Homie' }).click();
  await expect(page.getByTestId('status-homies')).toContainText('Request was not confirmed.');
  await expect(page.getByTestId('row-found-newcomer').getByRole('button', { name: 'Add Homie' })).toBeEnabled();
  await page.getByTestId('row-found-newcomer').getByRole('button', { name: 'Add Homie' }).click();
  await expect(page.getByTestId('row-found-newcomer')).toContainText('Request sent');
  expect(api.calls.filter(c => c === `send:${newcomer.friendCode}`)).toHaveLength(2);
});

test('legacy link resolves a named player without auto-send; blocked clipboard provides manual link, never visible code input', async ({ page }) => {
  const api = await setup(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('Permission denied')) } });
  });
  const fb = await open(page, `?friend=${newcomer.friendCode}`);
  await expect(page.getByRole('tablist', { name: 'Fadebook sections' }).getByRole('tab', { name: /Find Players/ })).toHaveAttribute('aria-selected', 'true');
  const linked = fb.getByTestId('card-lookup');
  await expect(linked).toContainText('Fighter 3');
  await expect(linked).toContainText('@newcomer');
  await expect(linked.getByRole('button', { name: 'Add Homie' })).toBeVisible();
  expect(api.calls).toHaveLength(0);
  await fb.getByTestId('button-share-link').click();
  await expect(fb.getByTestId('input-manual-share')).toHaveValue(new RegExp(`/game/settings\\?friend=${self.friendCode}#homies$`));
  await expect(fb.locator('input:not([readonly])')).not.toHaveValue(self.friendCode);
  await expect(fb).not.toContainText(self.friendCode);
  await linked.getByRole('button', { name: 'Dismiss' }).click();
  await expect(linked).toHaveCount(0);
});

test('another-session relationship refresh overrides stale search answer without discarding username draft', async ({ page }) => {
  const api = await setup(page);
  await open(page);
  await search(page, 'newcomer');
  const found = page.getByTestId('row-found-newcomer');
  await expect(found.getByRole('button', { name: 'Add Homie' })).toBeVisible();
  await page.getByTestId('button-edit-username').click();
  await page.getByTestId('input-username').fill('my_unsaved_name');
  api.relations.set('newcomer', 'incoming');
  // Foreground focus refreshes the current social query, not the stale search snapshot.
  const response = page.waitForResponse(res => new URL(res.url()).pathname === '/api/social' && res.status() === 200);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await response;
  await expect(page.getByTestId('input-username')).toHaveValue('my_unsaved_name');
  await expect(found.getByRole('button', { name: 'Accept request' })).toBeVisible();
  expect(api.calls).toHaveLength(0);
});

test('crowded real route scrolls final actions by wheel without clipping at phone, tablet and desktop widths', async ({ page }) => {
  await setup(page, Object.fromEntries(crowd.map(p => [p.username, 'homie'])));
  await open(page);
  for (const { width, height } of [
    { width: 320, height: 740 }, { width: 390, height: 844 },
    { width: 768, height: 1024 }, { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const final = page.getByTestId('row-homie-crowd_30');
    await expect(final).toBeAttached();
    const panel = page.locator('#fighter-panel-Homies');
    const bounds = await panel.boundingBox();
    expect(bounds).not.toBeNull();
    await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + Math.min(bounds!.height / 2, height - bounds!.y - 20));
    await page.mouse.wheel(0, 50000);
    await expect(final, 'wheel, not Playwright auto-scroll, must expose final row').toBeInViewport();
    const action = final.getByRole('button', { name: 'Invite Fighter 129 to a Friendly Fade' });
    await expect(action).toBeInViewport();
    const hit = await action.evaluate(node => {
      const rect = node.getBoundingClientRect();
      const at = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return at === node || node.contains(at);
    });
    expect(hit).toBe(true);
    await expect(page.getByTestId('homies-fadebook')).not.toContainText('Online now');
    await expect(final).toContainText('No recent activity');
    if (width === 390 || width === 1280) await screenshot(page, `fadebook-${width}`);
  }
  await page.getByTestId('row-homie-crowd_30').getByRole('button', { name: /Invite Fighter 129/ }).click();
  await expect(page).toHaveURL(new RegExp(`/game/online\\?tab=friends&homie=${crowd.at(-1)!.friendCode}`));
});

test('Requests retains invitations and opens confirmation route without silently accepting', async ({ page }) => {
  const api = await setup(page);
  api.invitations.push({
    id: 'invite-one', roomCode: 'AABBCCDDEEFF', direction: 'incoming',
    player: rival, status: 'pending', expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });
  await open(page);
  await section(page, 'Requests');
  const invite = page.getByTestId('row-invitation-invite-one');
  await expect(invite).toContainText('@rival');
  await expect(invite.getByRole('button', { name: 'View invite' })).toBeVisible();
  await invite.getByRole('button', { name: 'View invite' }).click();
  await expect(page).toHaveURL(/\/game\/online\?tab=friends&invite=invite-one/);
  expect(api.calls).toHaveLength(0);
});