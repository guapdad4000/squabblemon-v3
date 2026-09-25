import { selectStreetOption } from './street-select.helper.mjs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  AUTH_KEY,
  installProfileApi,
  profileBootstrap,
  signIn,
} from './fighter-id.fixture';

const viewports = [
  { name: 'phone-320', width: 320, height: 740 },
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'ipad-portrait', width: 768, height: 1024 },
  { name: 'ipad-landscape', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'short-landscape', width: 740, height: 360 },
] as const;

function tab(page: Page, name: string) {
  return page.getByRole('tab', { name, exact: true });
}

async function openProfile(page: Page) {
  await page.goto('/squabblemon/game/settings');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

async function assertTarget(locator: Locator) {
  await expect(locator).toBeVisible();
  const geometry = await locator.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const hit = document.elementFromPoint(point.x, point.y);
    return {
      width: rect.width,
      height: rect.height,
      inViewport: rect.top >= 0 && rect.bottom <= innerHeight,
      hit: hit === node || !!hit && node.contains(hit),
    };
  });
  expect(geometry.inViewport).toBe(true);
  expect(geometry.height).toBeGreaterThanOrEqual(44);
  expect(geometry.hit).toBe(true);
}

async function attachScreenshot(page: Page, name: string) {
  await page.locator('.fighter-id-stage img').evaluateAll(async (images) => {
    await Promise.all(images.map(image => (image as HTMLImageElement).decode().catch(() => {})));
  });
  const path = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  await test.info().attach(name, { path, contentType: 'image/png' });
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test('fresh and established fighter identities show only earned account truth', async ({ page }) => {
  const api = await installProfileApi(page);
  await openProfile(page);

  await expect(page.getByRole('heading', { level: 1, name: 'NEW KID' })).toBeVisible();
  await expect(page.getByText('Level 1', { exact: true })).toBeVisible();
  await expect(page.getByText(/0\s*\/\s*250 XP/i)).toBeVisible();
  await expect(page.getByText(/No badges earned yet|Your first badge/i)).toBeVisible();
  await expect(page.getByText(/wins/i)).toHaveCount(0);

  api.setBootstrap(profileBootstrap({
    displayName: 'TWENTYFOURCHARACTERNAME!',
    avatarKey: 'legacy-profile-photo',
    xp: 1_125,
    level: 5,
    streetRep: 8_950,
    storyProgress: {
      gameplay: {
        wins: { kyle: 5, rastamon: 2 },
        experiments: {},
        rewardChoices: 0,
      },
    },
    unlockedCosmeticIds: ['badge:after-hours', 'badge:neighborhood'],
  }));
  await page.reload();

  await expect(page.getByRole('heading', { level: 1, name: 'TWENTYFOURCHARACTERNAME!' })).toBeVisible();
  await expect(page.getByText('Level 5', { exact: true })).toBeVisible();
  await expect(page.getByText(/125\s*\/\s*250 XP/i)).toBeVisible();
  await expect(page.getByText('KYLE', { exact: true })).toBeVisible();
  await expect(page.getByText(/Mastered/i)).toBeVisible();
  await expect(page.getByText(/After-hours champion/i)).toBeVisible();
  await expect(page.getByText(/Neighborhood champion/i)).toBeVisible();
  await expect(page.getByText(/7 wins|wins 7|total wins/i)).toHaveCount(0);
  await expect(page.locator('img[src*="legacy-profile-photo"]')).toHaveCount(0);

  await page.getByRole('button', { name: /Edit identity/i }).click();
  const portraitChoices = page.locator('.avatar-grid');
  await expect(portraitChoices).toBeVisible();
  await expect(portraitChoices.getByRole('button')).toHaveCount(2);
  await expect(portraitChoices.getByRole('button', { name: /Kyle/i })).toBeVisible();
  await expect(portraitChoices.getByRole('button', { name: /Rastamon/i })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('link', { name: 'Explore mastery & events →' }).click();
  await expect(page.getByRole('button', { name: 'Experiments & mastery' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'The wall of fame' })).toBeVisible();
});

test('profile draft cancel is local; save sends the exact contract and updates shared identity', async ({ page }) => {
  const api = await installProfileApi(page, { saveFailures: 1 });
  await openProfile(page);
  await page.getByRole('button', { name: /Edit identity/i }).click();

  const name = page.getByLabel(/Fighter tag/i);
  await name.fill('CANCELLED NAME');
  await page.getByRole('button', { name: /Rastamon/i }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'NEW KID' })).toBeVisible();
  await expect(page.getByRole('link', { name: /NEW KID/ })).toBeVisible();
  expect(api.saveCalls()).toBe(0);

  await page.getByRole('button', { name: /Edit identity/i }).click();
  await name.fill('SAVED FIGHTER');
  await page.getByRole('button', { name: /Rastamon/i }).click();
  const save = page.getByRole('button', { name: /Confirm|Save profile/i });
  await save.click();
  await expect(page.getByRole('alert')).toContainText(/could not|try again/i);
  expect(api.lastSave()).toEqual({ displayName: 'SAVED FIGHTER', avatarKey: 'rastamon' });

  await save.click();
  await expect(page.getByText(/Profile saved/i)).toBeVisible();
  expect(api.lastSave()).toEqual({ displayName: 'SAVED FIGHTER', avatarKey: 'rastamon' });
  await expect(page.getByRole('link', { name: /SAVED FIGHTER/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'SAVED FIGHTER' })).toBeVisible();
});

test('pending identity save locks the whole dossier and cannot submit twice', async ({ page }) => {
  const api = await installProfileApi(page, { holdSave: true });
  await openProfile(page);
  await page.getByRole('button', { name: /Edit identity/i }).click();
  const input = page.getByLabel(/Fighter tag/i);
  await input.fill('ONE REQUEST');
  await page.getByRole('button', { name: /Rastamon/i }).click();
  const save = page.locator('.identity-editor button[type="submit"]');
  await save.click();
  await expect.poll(api.saveCalls).toBe(1);
  await expect(save).toBeDisabled();
  await expect(input).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  await expect(tab(page, 'Overview')).toBeDisabled();
  await expect(tab(page, 'Style')).toBeDisabled();
  await expect(tab(page, 'Settings')).toBeDisabled();
  await page.locator('.identity-editor').evaluate((form) => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  expect(api.saveCalls()).toBe(1);
  api.releaseSave();
  await expect(page.getByText('Profile saved.')).toBeVisible();
  expect(api.lastSave()).toEqual({ displayName: 'ONE REQUEST', avatarKey: 'rastamon' });
});

test('tabs support arrow, Home and End keys and react to mounted hash changes', async ({ page }) => {
  await installProfileApi(page);
  await openProfile(page);
  const overview = tab(page, 'Overview');
  const style = tab(page, 'Style');
  const settings = tab(page, 'Settings');
  await expect(overview).toHaveAttribute('aria-selected', 'true');
  await overview.focus();
  await page.keyboard.press('ArrowRight');
  await expect(style).toBeFocused();
  await expect(style).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(settings).toBeFocused();
  await expect(settings).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(overview).toBeFocused();
  await expect(overview).toHaveAttribute('aria-selected', 'true');

  await page.evaluate(() => { window.location.hash = '#promo-code'; });
  await expect(settings).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Got a code?', { exact: true })).toBeInViewport();
  await page.evaluate(() => { window.location.hash = '#style'; });
  await expect(style).toHaveAttribute('aria-selected', 'true');
});

test('legacy and failed portrait assets have a visible fallback', async ({ page }) => {
  await page.route('**/assets/characters/**', (route) => route.abort('failed'));
  await installProfileApi(page, { bootstrap: profileBootstrap({ avatarKey: 'kyle' }) });
  await openProfile(page);
  await expect(page.getByText(/Portrait unavailable|No photo/i)).toBeVisible();
  await attachScreenshot(page, 'fighter-id-missing-portrait');
});

test('phone identity editor shows selection, keeps a long draft in bounds and reaches Save', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await installProfileApi(page);
  await openProfile(page);
  await page.getByRole('button', { name: 'Edit Identity' }).click();
  await page.getByLabel(/Fighter tag/i).fill('TWENTYFOURCHARACTERNAME!');
  const choice = page.getByRole('button', { name: 'Rastamon', exact: true });
  await choice.click();
  await expect(choice).toHaveAttribute('aria-pressed', 'true');
  const portrait = choice.locator('.fighter-portrait');
  expect(await portrait.evaluate(node => getComputedStyle(node).boxShadow)).not.toBe('none');
  const panel = page.locator('.fighter-panel');
  await panel.focus();
  await page.keyboard.press('End');
  const save = page.locator('.identity-editor button[type="submit"]');
  await assertTarget(save);
  expect(await panel.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
  await attachScreenshot(page, 'fighter-id-editor-phone-320');
  await save.click();
  await expect(page.getByRole('status')).toHaveText('Profile saved.');
});

test('settings save preserves rewards, cosmetics and saved crew drafts', async ({ page }) => {
  const initial = profileBootstrap({
    unlockedCosmeticIds: ['badge:street-draft', 'style:kyle:stickers'],
    settings: {
      reducedMotion: false,
      turnTimerEnabled: true,
      cosmetics: {
        bannerCardId: 'kyle',
        bannerFinish: 'silver',
        stickers: ['kyle:smile'],
        cardBackgrounds: { kyle: 'blue-hour' },
      },
    },
  });
  const api = await installProfileApi(page, { bootstrap: initial });
  await openProfile(page);
  await tab(page, 'Settings').click();
  await expect(page.getByText('Developer Controls', { exact: true })).toHaveCount(0);
  await page.getByLabel(/Reduced motion/i).check();
  await page.getByLabel(/Turn timer/i).uncheck();
  await page.getByRole('button', { name: /Save settings/i }).click();
  await expect(page.getByRole('status').getByText('Settings saved.', { exact: true })).toBeVisible();

  expect(api.lastSave()).toEqual({ reducedMotion: true, turnTimerEnabled: false });
  const after = api.current().profile;
  expect(after.displayName).toBe('NEW KID');
  expect(after.savedDecks).toEqual(initial.profile.savedDecks);
  expect(after.unlockedCosmeticIds).toEqual(initial.profile.unlockedCosmeticIds);
  expect(after.settings.cosmetics).toEqual(initial.profile.settings.cosmetics);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-reduce-motion', 'true');
  await tab(page, 'Style').click();
  expect(await page.locator('.character-banner__fighter').evaluate(node => getComputedStyle(node).animationName)).toBe('none');
});

test('settings soundtrack remains operable without leaving the panel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installProfileApi(page);
  await page.goto('/squabblemon/game/settings#settings');
  await page.getByRole('tabpanel', { name: 'Settings' }).getByRole('button', { name: 'Music controls' }).click();
  const music = page.getByRole('dialog', { name: 'The Fade Tapes' });
  await expect(music).toBeVisible();
  await selectStreetOption(page, music.getByLabel('Choose music track'), '1');
  await expect(music.getByLabel('Choose music track')).toHaveAttribute('data-value', '1');
  await music.getByRole('button', { name: 'Close music controls' }).click();
  await expect(music).not.toBeVisible();
  await expect(tab(page, 'Settings')).toHaveAttribute('aria-selected', 'true');
});

test('style tab renders equipped finish and stickers, safe defaults, then reflects route equip cache', async ({ page }) => {
  const api = await installProfileApi(page, {
    bootstrap: profileBootstrap({
      unlockedCosmeticIds: ['style:kyle:stickers', 'style:kyle:banner-finish'],
      settings: {
        reducedMotion: false,
        turnTimerEnabled: true,
        cosmetics: {
          bannerCardId: 'kyle',
          bannerFinish: 'silver',
          stickers: ['kyle:smile'],
          cardBackgrounds: {},
        },
      },
    }),
  });
  await openProfile(page);
  await tab(page, 'Style').click();
  const banner = page.locator('.character-banner');
  await expect(banner).toHaveAttribute('data-finish', 'silver');
  await expect(banner.getByRole('img', { name: /smile/i })).toBeVisible();

  api.setBootstrap(profileBootstrap({
    settings: {
      reducedMotion: false,
      turnTimerEnabled: true,
      cosmetics: {
        bannerCardId: 'not-a-real-or-owned-card',
        bannerFinish: 'silver',
        stickers: ['missing:sticker'],
        cardBackgrounds: {},
      },
    },
  }));
  await page.reload();
  await tab(page, 'Style').click();
  await expect(page.getByText('No banner equipped', { exact: true })).toBeVisible();
  await expect(page.locator('.character-sticker')).toHaveCount(0);

  api.setBootstrap(profileBootstrap({
    unlockedCosmeticIds: ['style:kyle:stickers', 'style:kyle:banner-finish'],
  }));
  await page.reload();
  await page.goto('/squabblemon/game/style/kyle');
  await page.getByRole('button', { name: /Character banner/i }).click();
  await page.getByRole('button', { name: /Silver Lining/i }).click();
  await page.getByRole('button', { name: 'Equip banner' }).click();
  await expect(page.getByText(/Saved to your collection/i)).toBeVisible();
  expect(api.lastCosmetics()).toMatchObject({ bannerCardId: 'kyle', bannerFinish: 'silver' });
  await page.getByRole('link', { name: /NEW KID/ }).click();
  await expect(page).toHaveURL(/\/squabblemon\/game\/settings/);
  await tab(page, 'Style').click();
  await expect(page.locator('.character-banner')).toHaveAttribute('data-finish', 'silver');
  await attachScreenshot(page, 'fighter-id-equipped-style');
});

test('promo deep link is retry-safe, duplicate-safe, updates cache and exposes reward links', async ({ page }) => {
  const api = await installProfileApi(page, { promoFailures: 1, holdPromo: true });
  await page.goto('/squabblemon/game/settings#promo-code');
  await expect(page.getByRole('heading', { name: /Got a code/i })).toBeInViewport();
  const input = page.getByLabel(/Promo code/i);
  const redeem = page.getByRole('button', { name: /Redeem(?: code)?/i });
  await input.fill(' street-heat ');
  await redeem.click();
  await expect(redeem).toBeDisabled();
  await input.evaluate((element) => {
    element.closest('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await expect.poll(api.promoCalls).toBe(1);
  api.releasePromo();
  await expect(page.getByRole('alert')).toContainText('Promo service is catching its breath.');

  await redeem.click();
  await expect(page.getByText(/STREET-HEAT redeemed/i)).toBeVisible();
  expect(api.promoCalls()).toBe(2);
  const receipt = page.getByRole('dialog', { name: /Promo rewards/i });
  await expect(receipt).toBeVisible();
  await expect(receipt).toContainText('+2');
  await expect(receipt).toContainText('+750');
  await receipt.getByRole('button', { name: /Keep going/i }).click();
  await expect(page.getByRole('link', { name: /Open packs/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Build your gang/i })).toBeVisible();
  await expect(page.getByRole('link', { name: '1000 Clout. Open Fade Market' })).toBeVisible();

  await input.fill('ALREADY-IN');
  await redeem.click();
  await expect(page.getByText(/already redeemed/i)).toBeVisible();
  await expect(page.getByRole('dialog', { name: /Promo rewards/i })).toHaveCount(0);
});

test('local preview changes are session-only and promo is disabled', async ({ page }) => {
  await page.route('**/api/player/bootstrap', (route) => route.abort('failed'));
  await openProfile(page);
  await page.getByRole('button', { name: /Edit identity/i }).click();
  await page.getByLabel(/Fighter tag/i).fill('SESSION ONLY');
  await page.getByRole('button', { name: /Confirm|Save profile/i }).click();
  await expect(page.getByRole('status').getByText(
    'Preview identity applied for this session only. Refresh restores the preview.',
    { exact: true },
  )).toBeVisible();
  await expect(page.getByRole('link', { name: /SESSION ONLY/ })).toBeVisible();
  await tab(page, 'Settings').click();
  await expect(page.getByLabel(/Promo code/i)).toBeDisabled();
  await page.reload();
  await tab(page, 'Overview').click();
  await expect(page.getByRole('heading', { name: 'Test Player' })).toBeVisible();
});

test('responsive profile has one scroll owner, reachable hit-tested actions and inert decoration', async ({ page }) => {
  await installProfileApi(page, {
    bootstrap: profileBootstrap({
      displayName: 'TWENTYFOURCHARACTERNAME!',
      unlockedCosmeticIds: ['badge:after-hours', 'badge:street-draft', 'badge:neighborhood'],
      storyProgress: { gameplay: { wins: { kyle: 5, rastamon: 4 } } },
    }),
  });
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await openProfile(page);
    await expect(tab(page, 'Overview')).toHaveAttribute('aria-selected', 'true');
    await assertTarget(page.getByRole('button', { name: 'Edit Identity' }));
    await attachScreenshot(page, `fighter-id-overview-${viewport.name}`);
    await tab(page, 'Style').click();
    await expect(page.getByText('No banner equipped', { exact: true })).toBeVisible();
    await attachScreenshot(page, `fighter-id-style-${viewport.name}`);
    const settingsTab = tab(page, 'Settings');
    await assertTarget(settingsTab);
    await settingsTab.click();
    const signOut = page.getByRole('button', { name: 'Sign Out' });
    const panel = page.locator('.fighter-panel');
    const panelBox = await panel.boundingBox();
    expect(panelBox).not.toBeNull();
    await page.mouse.move(panelBox!.x + panelBox!.width / 2, panelBox!.y + Math.min(panelBox!.height / 2, 100));
    await page.mouse.wheel(0, 4_000);
    await panel.focus();
    await page.keyboard.press('End');
    await assertTarget(signOut);
    const layout = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>('.fighter-id-stage')!;
      const overflowing = [stage, ...stage.querySelectorAll<HTMLElement>('*')]
        .filter((el) => {
          const style = getComputedStyle(el);
          return /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
        })
        .map((el) => el.className || el.tagName);
      const decor = [...stage.querySelectorAll<HTMLElement>('[aria-hidden="true"], .page-decor')]
        .filter((el) => getComputedStyle(el).position === 'absolute' || getComputedStyle(el).position === 'fixed')
        .every((el) => getComputedStyle(el).pointerEvents === 'none');
      return { overflowing, decor, width: document.documentElement.scrollWidth };
    });
    expect(layout.overflowing).toHaveLength(1);
    expect(layout.decor).toBe(true);
    expect(layout.width).toBeLessThanOrEqual(viewport.width);
    await attachScreenshot(page, `fighter-id-settings-${viewport.name}`);
  }
});

test('system reduced motion is honored and final sign out clears auth', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installProfileApi(page, {
    bootstrap: profileBootstrap({
      settings: {
        reducedMotion: false,
        turnTimerEnabled: true,
        cosmetics: { bannerCardId: 'kyle', bannerFinish: 'base', stickers: [], cardBackgrounds: {} },
      },
    }),
  });
  await openProfile(page);
  await tab(page, 'Style').click();
  await expect(page.locator('.character-banner')).toBeVisible();
  expect(await page.locator('.character-banner__fighter').evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
  await tab(page, 'Settings').click();
  const signOut = page.getByRole('button', { name: 'Sign Out' });
  await signOut.scrollIntoViewIfNeeded();
  await assertTarget(signOut);
  await signOut.click();
  await expect(page.getByRole('link', { name: 'Sign Up' })).toBeVisible();
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), AUTH_KEY)).toBeNull();
});