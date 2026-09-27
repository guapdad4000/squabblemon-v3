import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const origin = 'http://127.0.0.1:4196';
if (process.env.ONLINE_E2E !== '1' || process.env.ONLINE_E2E_REACTIONS !== '1' ||
    !process.env.DATABASE_URL || new URL(process.env.DATABASE_URL).hostname !== '127.0.0.1')
  throw new Error('Run the reaction journey only through the owned PGlite reactions-browser runner.');
const binary = process.env.BROWSER_PATH ?? ['/repl/tools/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
if (!binary) throw new Error('No Chromium executable found. Set BROWSER_PATH to an installed Chromium binary.');
const browser = await chromium.launch({ executablePath: binary, headless: true });
const folder = 'screenshots/reactions';
await mkdir(folder, { recursive: true });
const checks = [], errors = [];
const pass = label => { checks.push(label); console.log('PASS:', label); };
const contexts = [];
async function seat(name, phone = false) {
  const context = await browser.newContext({
    viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    reducedMotion: 'reduce', ...(phone ? { isMobile: true, hasTouch: true } : {}),
  });
  contexts.push(context);
  await context.addCookies([{ name: 'online_test_seat', value: name, url: origin }]);
  await context.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  return { context, page };
}
async function api(context, method, path, data) {
  const response = await context.request[method](origin + path, data === undefined ? undefined : { data });
  assert.equal(response.status(), 200, `${method} ${path}: ${response.status()} ${await response.text()}`);
  return response.json();
}
const ids = ['big-w', 'lets-go', 'reaction:dr-fade:laugh:v1', 'reaction:dr-fade:rage:v1'];
const names = ['Big W', "Let's go", 'Dr. Fade — Laugh', 'Dr. Fade — Rage'];
const slotNames = ['Big W', "Let's go", 'Laugh', 'Rage'];
const tray = page => page.getByTestId('tray-pvp-reactions');
const slots = async page => page.locator('[data-testid^="slot-reaction-"]:not([data-testid^="slot-reaction-empty"])').evaluateAll(nodes => nodes.map(node => node.querySelector('.pvp-slot__name')?.textContent));
async function editor(page) {
  await page.goto(origin + '/game/settings#reactions');
  await page.getByTestId('section-pvp-reactions').waitFor();
  assert.equal(await page.getByRole('heading', { name: 'PvP Reactions' }).count(), 1);
}
const picker = page => page.getByRole('region', { name: 'Your reaction collection' });
const grid = (page, label) => picker(page).locator(`.pvp-reaction-grid[aria-label="${label}"]`);
async function openPicker(page) {
  await page.getByRole('button', { name: 'Choose a reaction' }).click();
  await grid(page, 'Equipped reactions').waitFor();
  assert.equal(await picker(page).getByRole('button', { name: 'Quick tray' }).getAttribute('aria-pressed'), 'true');
}
try {
  const a = await seat('a');
  const b = await seat('b', true);
  const initial = (await api(a.context, 'get', '/api/player/bootstrap')).profile;
  assert(initial.id.startsWith('online-browser-'));
  assert.deepEqual(initial.settings.reactionTray, ids.slice(0, 2), 'missing legacy tray resolves to the two starters');
  await editor(a.page);
  assert.deepEqual(await slots(a.page), slotNames.slice(0, 2));
  assert.equal(await a.page.getByTestId('button-reaction-tray-save').isDisabled(), true);
  assert.equal(await a.page.getByTestId('card-reaction-' + ids[2]).count(), 0, 'locked stickers are not in the owned grid');
  assert.equal(await a.page.getByTestId('pack-locked-reaction-pack:dr-fade:v1').count(), 1);
  pass('Missing saved tray resolves to starter stickers; locked Dr Fade is not equippable.');

  await a.page.getByTestId('link-reaction-market').click();
  await a.page.getByRole('heading', { name: 'Block Talk.' }).waitFor();
  assert.equal(await a.page.getByRole('navigation', { name: 'Shop departments' }).getByRole('button').count(), 3);
  assert.equal(await a.page.getByRole('button', { name: 'Reactions', exact: true }).getAttribute('aria-pressed'), 'true');
  const reactionTotal = Number((await a.page.getByTestId('text-reaction-collection').innerText()).match(/\/ (\d+)/)?.[1]);
  assert.equal(reactionTotal, 40);
  assert.equal(await a.page.locator('.reaction-shop__sticker').count(), reactionTotal);
  assert.equal(await a.page.locator('.reaction-shop__wall .reaction-shop__shelf').count(), 10);
  await a.page.screenshot({ path: `${folder}/shop-desktop.jpg`, type: 'jpeg', quality: 83 });
  await a.page.getByTestId('button-buy-reaction-reaction-pack:dr-fade:v1').click();
  await a.page.getByTestId('button-buy-reaction-reaction-pack:dr-fade:v1').getByText('Already collected').waitFor();
  assert.match(await a.page.getByTestId('text-reaction-collection').innerText(), /6 \/ 40/);
  assert.match(await a.page.locator('.corner-store__wallet').innerText(), /200/);
  assert((await api(a.context, 'get', '/api/player/bootstrap')).profile.unlockedCosmeticIds.includes('reaction-pack:dr-fade:v1'));
  await a.page.getByTestId('link-equip-reaction-reaction-pack:dr-fade:v1').click();
  assert.match(a.page.url(), /\/game\/settings#reactions$/);
  await a.page.getByTestId('card-reaction-' + ids[2]).waitFor();
  pass('Dr Fade purchase travels through the live API and unlocks profile equip controls.');

  await a.page.getByTestId('button-reaction-toggle-' + ids[2]).click();
  await a.page.getByTestId('button-reaction-toggle-' + ids[3]).click();
  assert.deepEqual(await slots(a.page), slotNames);
  assert.equal(await a.page.getByTestId('button-reaction-toggle-reaction:dr-fade:shocked:v1').isDisabled(), true);
  await a.page.getByTestId('button-reaction-remove-' + ids[1]).click();
  assert.deepEqual(await slots(a.page), [slotNames[0], slotNames[2], slotNames[3]]);
  await a.page.getByTestId('button-reaction-toggle-' + ids[1]).click();
  await a.page.getByTestId('button-reaction-earlier-' + ids[1]).click();
  assert.deepEqual(await slots(a.page), [slotNames[0], slotNames[2], slotNames[1], slotNames[3]]);
  await a.page.getByTestId('button-reaction-later-' + ids[0]).focus();
  await a.page.keyboard.press('Enter');
  const wanted = [ids[2], ids[0], ids[1], ids[3]];
  assert.deepEqual(await slots(a.page), [slotNames[2], slotNames[0], slotNames[1], slotNames[3]]);
  pass('Add/remove/reorder with keyboard preserves four ordered slots and prevents a fifth.');

  let failed = false;
  await a.page.route('**/api/player/profile', async route => {
    if (route.request().method() === 'PATCH' && !failed) {
      failed = true; await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary tray failure' }) });
    } else await route.continue();
  });
  await a.page.getByTestId('button-reaction-tray-save').click();
  await a.page.getByTestId('status-reaction-tray').filter({ hasText: /Temporary tray failure|Could not save/ }).waitFor();
  assert.deepEqual(await slots(a.page), [slotNames[2], slotNames[0], slotNames[1], slotNames[3]], 'failed save retains draft');
  assert.deepEqual((await api(a.context, 'get', '/api/player/bootstrap')).profile.settings.reactionTray, ids.slice(0, 2), 'failed save did not mutate server');
  await a.page.getByTestId('button-reaction-tray-save').getByText('Retry save').click();
  await a.page.getByTestId('status-reaction-tray').filter({ hasText: /^Saved\./ }).waitFor();
  assert.deepEqual((await api(a.context, 'get', '/api/player/bootstrap')).profile.settings.reactionTray, wanted);
  await a.page.unroute('**/api/player/profile');
  await a.page.screenshot({ path: `${folder}/profile-desktop.jpg`, type: 'jpeg', quality: 84 });
  await a.page.reload();
  await a.page.getByTestId('section-pvp-reactions').waitFor();
  assert.deepEqual(await slots(a.page), [slotNames[2], slotNames[0], slotNames[1], slotNames[3]]);
  const aAgain = await seat('a', true);
  await editor(aAgain.page);
  assert.deepEqual(await slots(aAgain.page), [slotNames[2], slotNames[0], slotNames[1], slotNames[3]]);
  const changedElsewhere = [ids[2], ids[0]];
  await api(a.context, 'patch', '/api/player/profile', { reactionTray: changedElsewhere });
  await aAgain.page.reload();
  await aAgain.page.getByTestId('section-pvp-reactions').waitFor();
  assert.deepEqual(await slots(aAgain.page), [slotNames[2], slotNames[0]], 'clean editor adopts independent-context save after reload');
  await aAgain.page.getByTestId('button-reaction-toggle-' + ids[1]).click();
  assert.deepEqual(await slots(aAgain.page), [slotNames[2], slotNames[0], slotNames[1]]);
  await api(a.context, 'patch', '/api/player/profile', { reactionTray: wanted });
  aAgain.page.once('dialog', dialog => dialog.dismiss());
  await aAgain.page.getByRole('tab', { name: 'Settings' }).click();
  assert.deepEqual(await slots(aAgain.page), [slotNames[2], slotNames[0], slotNames[1]], 'rejected navigation retains dirty draft');
  assert.equal(await aAgain.page.getByTestId('status-reaction-tray').getAttribute('data-state'), 'dirty');
  const refreshed = aAgain.page.waitForResponse(response => response.url().endsWith('/api/player/bootstrap') && response.status() === 200);
  await aAgain.page.evaluate(async () => {
    // Headless Chromium does not reliably emit a real tab visibility event.
    // Exercise React Query's actual focus manager, used by the running app.
    const { focusManager } = await import('/node_modules/.vite-online-browser-e2e/deps/@tanstack_react-query.js');
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });
  await refreshed;
  assert.deepEqual(await slots(aAgain.page), [slotNames[2], slotNames[0], slotNames[1]], 'actual bootstrap background refetch must retain unsaved draft');
  await aAgain.page.getByTestId('button-reaction-tray-reset').click();
  assert.deepEqual(await slots(aAgain.page), [slotNames[2], slotNames[0], slotNames[1], slotNames[3]], 'reset takes recently refreshed server tray');
  await aAgain.page.reload();
  await aAgain.page.getByTestId('section-pvp-reactions').waitFor();
  assert.deepEqual(await slots(aAgain.page), [slotNames[2], slotNames[0], slotNames[1], slotNames[3]], 'clean reload adopts independent-context save');
  await aAgain.page.getByTestId('button-reaction-preview-' + ids[2]).click();
  assert.match(await aAgain.page.getByTestId('button-reaction-preview-' + ids[2]).locator('img').getAttribute('src'), /\/laugh\.webp$/, 'reduced-motion preview loads static poster, not GIF/animated WebP');
  await aAgain.page.getByTestId('button-reaction-remove-' + ids[3]).click();
  await aAgain.page.getByTestId('button-reaction-toggle-' + ids[3]).click();
  await aAgain.page.getByTestId('button-reaction-earlier-' + ids[3]).click();
  const phoneSave = aAgain.page.getByTestId('button-reaction-tray-save');
  await aAgain.page.mouse.wheel(0, 900);
  await phoneSave.scrollIntoViewIfNeeded();
  const phoneSaveBounds = await phoneSave.evaluate(el => {
    const rect = el.getBoundingClientRect();
    const panel = el.closest('.fighter-panel').getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, panelTop: panel.top, panelBottom: panel.bottom };
  });
  assert(phoneSaveBounds.top >= phoneSaveBounds.panelTop && phoneSaveBounds.bottom <= phoneSaveBounds.panelBottom &&
    phoneSaveBounds.left >= 0 && phoneSaveBounds.right <= 390, 'phone save button must be fully within the real scrolling panel and viewport');
  await phoneSave.focus();
  await aAgain.page.keyboard.press('Enter');
  await aAgain.page.getByTestId('status-reaction-tray').filter({ hasText: /^Saved\./ }).waitFor();
  assert.deepEqual((await api(aAgain.context, 'get', '/api/player/bootstrap')).profile.settings.reactionTray, [ids[2], ids[0], ids[3], ids[1]]);
  await aAgain.page.getByTestId('button-reaction-later-' + ids[3]).click();
  await phoneSave.click();
  await aAgain.page.getByTestId('status-reaction-tray').filter({ hasText: /^Saved\./ }).waitFor();
  assert.deepEqual((await api(aAgain.context, 'get', '/api/player/bootstrap')).profile.settings.reactionTray, wanted);
  await aAgain.page.screenshot({ path: `${folder}/profile-phone.jpg`, type: 'jpeg', quality: 84 });
  assert(await aAgain.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'phone profile horizontal overflow');
  pass('500 save/retry, independent clean reload and dirty background-refetch preservation, phone scroll-and-keyboard save, static reduced-motion art.');

  for (const { page } of [a, b]) {
    await page.goto(origin + '/game/online?tab=friends');
    await page.getByRole('button', { name: 'Create friend fade' }).waitFor();
  }
  await a.page.getByRole('button', { name: 'Create friend fade' }).click();
  const code = await a.page.getByTestId('online-room-code').innerText();
  assert.match(code, /^[A-F0-9]{12}$/);
  await b.page.goto(origin + '/game/online/' + code);
  await b.page.getByRole('button', { name: 'Join your friend' }).click();
  await b.page.getByTestId('online-room').waitFor();
  await Promise.all([a.page, b.page].map(page => page.waitForFunction(() => !document.querySelector('[data-testid="online-ready"]')?.disabled)));
  await Promise.all([a.page, b.page].map(page => page.getByTestId('online-ready').click()));
  await Promise.all([a.page, b.page].map(page => page.getByTestId('online-battle').waitFor()));
  const view = await api(a.context, 'get', `/api/multiplayer/${code}/reactions`);
  assert.deepEqual(view.tray, wanted);
  assert.deepEqual(view.owned.slice(0, 2), ids.slice(0, 2));
  await openPicker(a.page);
  assert.deepEqual(await grid(a.page, 'Equipped reactions').getByRole('button').evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label'))), [names[2], names[0], names[1], names[3]].map(n => 'Send ' + n));
  await a.page.screenshot({ path: `${folder}/battle-desktop.jpg`, type: 'jpeg', quality: 84 });
  await picker(a.page).getByRole('button', { name: /^All owned \(/ }).click();
  assert.equal(await grid(a.page, 'All owned reactions').getByRole('button', { name: 'Send Dr. Fade — Shocked' }).count(), 1);
  assert.equal(await picker(a.page).getByRole('button', { name: /^All owned \(/ }).innerText(), 'All owned (6)');
  assert.equal(await grid(a.page, 'All owned reactions').getByRole('button', { name: 'Send Hold that L' }).count(), 0, 'locked reaction cannot be sent');
  await a.page.keyboard.press('Escape');
  assert.equal(await picker(a.page).count(), 0);
  assert.equal(await a.page.getByRole('button', { name: 'Choose a reaction' }).evaluate(el => el === document.activeElement), true);
  await openPicker(a.page);
  await picker(a.page).getByRole('button', { name: /^All owned \(/ }).click();
  await grid(a.page, 'All owned reactions').getByRole('button', { name: 'Send Dr. Fade — Shocked' }).click();
  await b.page.locator('.pvp-reaction-bubble--rival img[alt="Dr. Fade — Shocked"]').waitFor();
  assert.equal((await api(a.context, 'get', `/api/multiplayer/${code}/reactions`)).latest.player.reactionId, 'reaction:dr-fade:shocked:v1');
  await a.page.getByRole('button', { name: 'Choose a reaction' }).click();
  await grid(a.page, 'Equipped reactions').waitFor();
  await a.page.waitForFunction(() => !document.querySelector('[aria-label="Send Dr. Fade — Laugh"]')?.disabled);
  await grid(a.page, 'Equipped reactions').getByRole('button', { name: 'Send Dr. Fade — Laugh' }).click();
  await b.page.locator('.pvp-reaction-bubble--rival').waitFor();
  await openPicker(a.page);
  assert.equal(await grid(a.page, 'Equipped reactions').getByRole('button', { name: 'Send Big W' }).isDisabled(), true);
  await picker(a.page).getByText(/Next reaction in \d+s/).waitFor();
  await picker(a.page).getByRole('button', { name: 'Close reactions' }).click();
  await b.page.getByRole('button', { name: 'Choose a reaction' }).click();
  await b.page.screenshot({ path: `${folder}/battle-phone.jpg`, type: 'jpeg', quality: 84 });
  await picker(b.page).getByRole('checkbox', { name: 'Hide opponent reactions' }).check();
  assert.equal(await b.page.locator('.pvp-reaction-bubble--rival').count(), 0);
  await b.page.reload();
  await b.page.getByTestId('online-battle').waitFor();
  await openPicker(b.page);
  assert.equal(await picker(b.page).getByRole('checkbox', { name: 'Hide opponent reactions' }).isChecked(), true);
  await grid(b.page, 'Equipped reactions').getByRole('button', { name: "Send Let's go" }).click();
  await a.page.locator('.pvp-reaction-bubble--rival').waitFor();
  await a.page.locator('.pvp-reaction-bubble--rival').waitFor({ state: 'detached', timeout: 9000 });
  pass('Live room delivers ordered quick tray and an actual owned-outside-tray send; excludes locked, enforces cooldown/mute and survives reconnect.');

  // Complete the same room and exercise the real rematch command path.
  async function command(context, action) {
    const current = await api(context, 'get', `/api/multiplayer/${code}`);
    return api(context, 'post', `/api/multiplayer/${code}/actions`, {
      requestId: randomUUID(), expectedRevision: current.revision, command: { type: action },
    });
  }
  const live = await api(a.context, 'get', `/api/multiplayer/${code}`);
  await command(live.activeSeat === live.seat ? a.context : b.context, 'surrender');
  await a.page.waitForFunction(() => document.querySelector('[data-testid="online-battle"]')?.getAttribute('data-status') === 'complete');
  await command(a.context, 'rematch');
  await command(b.context, 'rematch');
  const rematch = await api(a.context, 'get', `/api/multiplayer/${code}`);
  assert.equal(rematch.gameNumber, live.gameNumber + 1);
  assert.equal(rematch.status, 'waiting');
  await Promise.all([a.page, b.page].map(page => page.waitForFunction(() => !document.querySelector('[data-testid="online-ready"]')?.disabled)));
  await Promise.all([a.page, b.page].map(page => page.getByTestId('online-ready').click()));
  await a.page.getByTestId('online-battle').waitFor();
  await a.page.waitForFunction(() => document.querySelector('[data-testid="online-battle"]')?.getAttribute('data-status') === 'active');
  const second = await api(a.context, 'get', `/api/multiplayer/${code}/reactions`);
  assert.deepEqual(second.tray, wanted);
  assert(Object.values(second.latest).every(event => event.gameNumber < rematch.gameNumber), 'retained reaction history belongs only to game one');
  await a.page.waitForFunction(() => document.querySelector('[data-testid="online-battle"]')?.getAttribute('data-status') === 'active' &&
    !document.querySelector('.pvp-reaction-bubble'));
  await openPicker(a.page);
  assert.deepEqual(await grid(a.page, 'Equipped reactions').getByRole('button').evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label'))), [names[2], names[0], names[1], names[3]].map(n => 'Send ' + n));
  pass('Same-room game-two rematch resets old bubbles and retains saved quick tray in order.');
  for (const { page } of [a, b, aAgain]) assert.equal(await page.locator('vite-error-overlay').count(), 0);
  assert.deepEqual(errors, []);
} finally {
  await writeFile(`${folder}/verification.json`, JSON.stringify({ complete: checks.length === 6 && errors.length === 0, checks, errors }, null, 2));
  await browser.close();
}