import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import release from '../src/lib/streetLegendsRelease.json' with { type: 'json' };
import letterPreview from '../../deliverables/release-mail-1-11/mail-preview.json' with { type: 'json' };
import { getMailEventPresentation } from '../src/lib/mailEvents';

const screenshots = resolve(import.meta.dirname, '../../deliverables/release-mail-1-11/screenshots');
mkdirSync(screenshots, { recursive: true });
for (const [name, width, height] of [['desktop', 1440, 1050], ['mobile', 390, 844]] as const) {
  test(`${name}: release mail, full banner, and repeat-safe gift presentation`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    let claims = 0;
    const letter = { ...letterPreview, sentAt: '2026-10-06T18:00:00Z', readAt: null as string | null, claimedAt: null as string | null };
    await page.route('**/api/player/mail**', route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: { messages: [letter] } });
      const credited = route.request().url().endsWith('/claim') && !letter.claimedAt;
      letter.readAt ??= '2026-10-06T18:01:00Z';
      if (credited) { claims++; letter.claimedAt = '2026-10-06T18:02:00Z'; }
      return route.fulfill({ json: { mail: letter, credited } });
    });
    await page.goto(`/squabblemon/e2e/release-mail.fixture.html?letter=${letter.id}`);
    const mail = page.getByRole('dialog', { name: 'Knock. Knock.' });
    await expect(mail).toBeVisible();
    await expect(mail.locator('.mail-body')).toHaveText(letter.body);
    const banner = mail.locator('.mail-event-banner');
    await expect.poll(() => banner.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 2172)).toBe(true);
    const size = await banner.boundingBox();
    expect(size!.width / size!.height).toBeCloseTo(3, 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `${screenshots}/mail-${name}.png` });
    await expect(mail.locator('.mail-gift')).toContainText('10 Pack Tickets');
    await mail.getByRole('button', { name: 'Claim your gift' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${screenshots}/gift-${name}.png` });
    await mail.getByRole('button', { name: 'Claim your gift' }).click();
    await expect.poll(() => claims).toBe(1);
    await expect(mail.getByRole('button', { name: /Gift claimed/ })).toBeDisabled();
    await page.reload();
    await expect(mail.getByRole('button', { name: /Gift claimed/ })).toBeDisabled();
    expect(claims).toBe(1);
    expect(errors).toEqual([]);
  });
  test(`${name}: Events preview uses all of the wide banner`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/squabblemon/e2e/release-mail.fixture.html?view=notes');
    const art = page.getByTestId('patch-art');
    await expect.poll(() => art.locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    const box = await art.boundingBox();
    expect(box!.width / box!.height).toBeCloseTo(3, 1);
    await expect(page.getByTestId('patch-events-preview')).toContainText(release.title);
    await page.screenshot({ path: `${screenshots}/notes-${name}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}
test('release presentation is bound to the authoritative campaign ID', () => {
  expect(getMailEventPresentation(letterPreview.id)?.bannerAssetId).toBe('assets/events/street-legends-patch-1-11.webp');
  expect(getMailEventPresentation('patch_1-11_wrong')).toBeUndefined();
  expect(getMailEventPresentation('unknown')).toBeUndefined();
});
