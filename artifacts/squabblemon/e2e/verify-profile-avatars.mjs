import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { installProfileApi, profileBootstrap, signIn } from './fighter-id.fixture.ts';
import { STICKER_AVATARS, stickerAvatarKey } from '../../../lib/squabblemon-engine/src/cosmetics.ts';

const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4198';
const profilePath = process.env.PROFILE_PATH ?? '/game/settings';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const selected = STICKER_AVATARS.find(({ set, sticker }) => set.cardId === 'buddy' && sticker.image);
assert(selected);
const key = stickerAvatarKey(selected.sticker.id);
try {
  for (const [device, width, height] of [['desktop', 1440, 1000], ['phone', 390, 844], ['small-phone', 320, 740], ['landscape', 740, 360]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await signIn(page);
    await page.routeWebSocket('**', () => {});
    const api = await installProfileApi(page, { bootstrap: profileBootstrap({ displayName: 'BIG BUD ENERGY', avatarKey: key, level: 12, xp: 2840, streetRep: 8940, unlockedCosmeticIds: ['mastery:kyle', 'badge:after-hours'] }) });
    await page.goto(`${origin}${profilePath}`);
    await page.getByRole('heading', { name: 'BIG BUD ENERGY' }).waitFor();
    const panel = page.locator('.fighter-panel');
    const layout = await panel.evaluate(el => ({ scrollbar: getComputedStyle(el).scrollbarWidth, horizontal: el.scrollWidth > el.clientWidth + 1, height: el.clientHeight }));
    assert.equal(layout.scrollbar, 'none'); assert.equal(layout.horizontal, false); assert(layout.height > 100);
    await page.locator('.id-card__photo img').evaluate(async image => image.decode());
    await page.screenshot({ path: `screenshots/profile-overview-${device}.png` });
    await page.getByRole('button', { name: 'Edit Identity', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Search avatars' }).fill('buddy');
    const choice = page.locator('.avatar-choice--sticker').nth(1);
    await choice.click();
    const chosen = await choice.locator('[data-avatar-key]').getAttribute('data-avatar-key');
    await page.getByRole('textbox', { name: 'Fighter tag (max 24)' }).fill('MY STICKER ID');
    await page.locator('.avatar-toolbar').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `screenshots/profile-avatar-picker-${device}.png` });
    await page.getByRole('button', { name: 'Save profile', exact: true }).click();
    await page.getByRole('heading', { name: 'MY STICKER ID' }).waitFor();
    assert.equal(api.lastSave().avatarKey, chosen);
    await page.reload();
    await page.getByRole('heading', { name: 'MY STICKER ID' }).waitFor();
    assert.equal(await page.locator('.id-card__photo [data-avatar-key]').getAttribute('data-avatar-key'), chosen);
    for (const tab of ['Style', 'Settings']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      assert.equal(await panel.evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
      await page.screenshot({ path: `screenshots/profile-${tab.toLowerCase()}-${device}.png` });
    }
    await panel.evaluate(el => { el.scrollTop = el.scrollHeight; });
    assert((await panel.evaluate(el => el.scrollTop)) > 0);
    assert.deepEqual(errors, []);
    console.log('PASS', device, 'avatar save/reload, tabs, no horizontal overflow, hidden scrollbar with scroll retained');
    await page.close();
  }
  for (const width of [1280, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    await signIn(page);
    await page.routeWebSocket('**', () => {});
    await installProfileApi(page, { bootstrap: profileBootstrap({ displayName: 'STICKER FIGHTER', avatarKey: key }) });
    await page.goto(`${origin}/e2e/profile-avatars.fixture.html?mode=pvp`);
    await page.getByTestId('pvp-player-avatar').waitFor();
    const intro = page.getByTestId('match-arrival');
    await intro.waitFor();
    const spacing = await intro.evaluate(el => ({
      fightersBottom: Math.max(...[...el.querySelectorAll('.match-poster__fighter')].map(card => card.getBoundingClientRect().bottom)),
      footerTop: el.querySelector('footer p').getBoundingClientRect().top,
    }));
    assert(spacing.fightersBottom < spacing.footerTop, 'Versus identities must not overlap the footer');
    assert.equal(await page.getByTestId('pvp-player-avatar').locator('[data-avatar-key]').getAttribute('data-avatar-key'), key);
    assert.equal(await page.getByTestId('pvp-rival-avatar').locator('[data-avatar-key]').getAttribute('data-avatar-key'), 'sticker:kyle:point');
    await page.getByTestId('match-arrival').waitFor({ state: 'hidden' });
    await page.screenshot({ path: `screenshots/profile-pvp-${width}.png` });
    console.log('PASS', width, 'PvP shows both standalone and atlas sticker avatars');
    await page.close();
  }
} finally { await browser.close(); }
