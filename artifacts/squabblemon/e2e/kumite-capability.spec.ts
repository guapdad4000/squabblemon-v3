import { expect, test } from '@playwright/test';

for (const needsRefresh of [true, false]) test(`Kumite ${needsRefresh ? 're-advertises' : 'does not repeat'} capability for a registered player`, async ({ page }) => {
  const now = Date.now();
  const registration = { deckId: 'locked-original-deck', deckName: 'Locked gang', hero: 'cornball', registeredAt: now - 1000, clientNeedsUpdate: needsRefresh };
  const current = { tournament: { id: 'capability-week', weekLabel: 'Test week', status: 'registration', registrationOpensAt: now - 86400000, startsAt: now + 86400000, endsAt: now + 172800000, capacity: 8, poolCount: 1, poolSize: 8, entrants: [], pools: [], finals: [], champion: null }, registration, currentMatch: null, serverTime: now, rules: { roundHours: 6, turnSeconds: 75 }, progression: null };
  let posts = 0;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/kumite/**', async route => {
    const request = route.request();
    if (new URL(request.url()).pathname.endsWith('/winners')) return route.fulfill({ json: { winners: [], serverTime: now } });
    if (new URL(request.url()).pathname.endsWith('/register')) {
      posts++;
      expect(request.method()).toBe('POST');
      expect(request.postDataJSON()).toEqual({ deckId: 'locked-original-deck' });
      expect(request.headers()['x-squabblemon-capabilities']).toBe('anunaki-v1');
      registration.clientNeedsUpdate = false;
    }
    await route.fulfill({ json: current });
  });
  await page.goto('/squabblemon/e2e/kumite.fixture.html');
  await expect(page.getByRole('button', { name: 'Enter Kumite' })).toBeVisible();
  if (needsRefresh) await expect.poll(() => posts).toBe(1);
  await page.getByRole('button', { name: 'Enter Kumite' }).click();
  expect(errors).toEqual([]);
  await expect(page.getByText('Locked gang').first()).toBeVisible();
  await page.waitForTimeout(300);
  expect(posts).toBe(needsRefresh ? 1 : 0);
});
