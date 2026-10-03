import { expect, test } from '@playwright/test';
import { profileBootstrap } from './fighter-id.fixture';
import { SQUABBLE_HOUSE_MAIL_ID } from '../src/lib/mailEvents';

const patch = {
  version: '1.9', title: 'The Last Waffle: Squabble House Story', date: '2026-10-03',
  overview: 'The diner is open. Six chapters, six puzzles, and four battle-earned House cards.',
  buffs: [], changes: ['Play the Squabble House story.'], artCardId: 'squabble-house-manager',
  publishedAt: '2026-10-03T08:00:00Z', mailStatus: 'complete',
};

for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
  test(`${viewport.name}: event art in Events and Mailman opens the playable arc`, async ({ page }) => {
    test.skip((test.info().project.name === 'chromium-phone') !== (viewport.name === 'phone'));
    await page.setViewportSize(viewport);
    await page.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
    await page.route('**/api/player/bootstrap', route => route.fulfill({ json: profileBootstrap({ id: 'e2e-player' }) }));
    await page.route('**/api/events/patches', route => route.fulfill({ json: [patch] }));
    await page.goto('/squabblemon/game/events?patch=1.9');
    const eventsBanner = page.getByTestId('patch-detail').locator('.patch-art--banner img');
    await expect(eventsBanner).toBeVisible();
    await expect.poll(() => eventsBanner.evaluate((img: HTMLImageElement) => img.naturalWidth), { timeout: 15000 }).toBeGreaterThan(2000);
    const letter = {
      id: SQUABBLE_HOUSE_MAIL_ID, title: `Patch 1.9: ${patch.title}`, sender: 'Squabblemon Team',
      body: `Patch 1.9 · October 3, 2026\n${patch.title}\n\n${patch.overview}`,
      sentAt: patch.publishedAt, readAt: null as string | null, claimedAt: null,
      gift: { softCurrency: 0, packTickets: 0, styleShards: 0 },
    };
    await page.route('**/api/player/mail**', route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: { messages: [letter] } });
      letter.readAt = patch.publishedAt;
      return route.fulfill({ json: { mail: letter, credited: false } });
    });
    await page.goto(`/squabblemon/game?notice=mail&letter=${SQUABBLE_HOUSE_MAIL_ID}`);
    const mailbox = page.getByRole('dialog', { name: 'Knock. Knock.' });
    await expect(mailbox).toBeVisible({ timeout: 30000 });
    const mailBanner = mailbox.locator('.mail-event-banner');
    await expect(mailBanner).toBeVisible();
    await expect.poll(() => mailBanner.evaluate((img: HTMLImageElement) => img.naturalWidth), { timeout: 15000 }).toBeGreaterThan(2000);
    await expect(mailbox.locator('.mail-gift')).toHaveCount(0);
    await expect(mailbox.getByRole('link', { name: /Play The Last Waffle/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await mailbox.getByRole('link', { name: /Play The Last Waffle/ }).click();
    await expect(page).toHaveURL(/\/game\/story\?season=special-squabble-house/);
  });
}
