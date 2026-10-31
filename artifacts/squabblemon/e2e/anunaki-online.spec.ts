import { expect, test } from '@playwright/test';

test('both online seats see the correct tablet owner and each consumption without private state', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/squabblemon/e2e/anunaki-online.fixture.html');
  const a = page.getByTestId('seat-a'), b = page.getByTestId('seat-b');
  await expect(a.getByTestId('ancient-tablet-badge').nth(0)).toHaveAttribute('aria-label', /Your ancient tablet/);
  await expect(a.getByTestId('ancient-tablet-badge').nth(1)).toHaveAttribute('aria-label', /The Opps’ ancient tablet/);
  await expect(b.getByTestId('ancient-tablet-badge').nth(0)).toHaveAttribute('aria-label', /The Opps’ ancient tablet/);
  await expect(b.getByTestId('ancient-tablet-badge').nth(1)).toHaveAttribute('aria-label', /Your ancient tablet/);
  await expect(a.getByTestId('ancient-tablet-badge').nth(0).locator('img')).toHaveAttribute('src', /ancient-tablet\.webp/);
  await expect(a.getByTestId('ancient-tablet-badge').nth(0).locator('span')).toHaveCSS('height', '12px');
  await expect(a.getByTestId('ancient-tablet-badge').nth(0).locator('img')).toHaveCSS('filter', /drop-shadow\(rgba\(68, 255, 197/);
  await a.getByTestId('ancient-tablet-badge').nth(0).click();
  const details = page.getByRole('dialog', { name: /district view/i });
  await expect(details.getByRole('heading', { name: 'ancient tablet' })).toBeVisible();
  await expect(details.getByText('Ancient Tablet · ready to consume')).toBeVisible();
  await details.getByRole('button', { name: 'Close location details' }).click();
  await expect(page.getByTestId('privacy-a')).toContainText('pass');
  await expect(page.getByTestId('privacy-b')).toContainText('pass');
  await page.getByRole('button', { name: 'Consume player tablet' }).click();
  await Promise.all([expect(a.getByTestId('tablet-consume-0')).toBeAttached(), expect(b.getByTestId('tablet-consume-0')).toBeAttached()]);
  await page.getByRole('button', { name: 'Consume rival tablet' }).click();
  await Promise.all([expect(a.getByTestId('tablet-consume-1')).toBeAttached(), expect(b.getByTestId('tablet-consume-1')).toBeAttached()]);
  await expect(page.getByTestId('privacy-a')).toContainText('pass');
  await expect(page.getByTestId('privacy-b')).toContainText('pass');
  await expect(a.locator('.ancient-tablet-consume i').first()).toHaveCSS('animation-name', 'none');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});


test('normal-motion public consumption follows the V2 impact queue', async ({ page }) => {
  await page.emulateMedia({ reducedMotion:'no-preference' });
  await page.goto('/squabblemon/e2e/anunaki-online.fixture.html?motion');
  const a=page.getByTestId('seat-a'), b=page.getByTestId('seat-b');
  await page.getByRole('button',{name:'Consume player tablet'}).click();
  await Promise.all([expect(a.getByTestId('tablet-consume-0')).toBeAttached(),expect(b.getByTestId('tablet-consume-0')).toBeAttached()]);
  await expect(a.locator('.ancient-tablet-consume i').first()).toHaveCSS('animation-name','ancient-tablet-break');
});
