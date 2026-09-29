import { expect, test, type Locator, type Page } from '@playwright/test';
import { profileBootstrap } from './fighter-id.fixture';

async function tabTo(page: Page, target: Locator, backwards = false) {
  await expect(target).toBeAttached();
  for (let i = 0; i < 90; i++) {
    if (await target.evaluate(el => document.activeElement === el)) {
      await expect(target).toBeFocused();
      return;
    }
    await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab');
  }
  throw new Error(`Real ${backwards ? 'Shift+Tab' : 'Tab'} navigation did not reach ${target}`);
}

test('keyboard activates card, detail, feedback shortcut, and the real Safehouse return link', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.context().addCookies([{
    name: 'events_test_seat', value: 'a', url: `http://127.0.0.1:${process.env.EVENTS_E2E_PORT}`,
  }]);
  await page.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
  await page.routeWebSocket('**', socket => socket.close());
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/player/bootstrap') return route.fulfill({
      json: profileBootstrap({ id: 'events-keyboard-player', displayName: 'Board Reader', avatarKey: 'kyle' }),
    });
    if (path.startsWith('/api/player/mail')) return route.fulfill({ json: { messages: [] } });
    if (path === '/api/events/feedback') return route.fulfill({ json: { posts: [], nextCursor: null } });
    return route.fulfill({ status: 503, json: { error: `Unrelated API: ${path}` } });
  });
  await page.goto('/squabblemon/game/events');
  await expect(page.getByTestId('page-events')).toBeVisible({ timeout: 60_000 });

  const expand = page.getByTestId('button-expand-block-party-weekend');
  await tabTo(page, expand);
  await page.keyboard.press('Enter');
  await expect(expand).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('detail-event-block-party-weekend')).toBeVisible();

  const detailAction = page.getByTestId('link-detail-block-party-weekend');
  await tabTo(page, detailAction);
  await expect(detailAction).toContainText('Enter the Fadecade');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/game\/challenges$/);
  await expect(page.locator('main.fadecade-hub')).toBeVisible();
  await expect(page.getByTestId('dialog-bulletin')).not.toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/game\/events$/);
  await expect(page.getByTestId('page-events')).toBeVisible();
  const feedbackShortcut = page.getByTestId('link-note-dev-note-balance');
  await tabTo(page, feedbackShortcut);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/game\/events\?section=feedback$/);
  const feedback = page.locator('#events-feedback');
  await expect(feedback).toBeFocused();
  await expect(feedback.getByRole('heading', { name: 'Send feedback to the devs' })).toBeVisible();

  const back = page.getByTestId('link-back-safehouse');
  await tabTo(page, back, true);
  await expect(back).toHaveAttribute('href', '/squabblemon/game');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/game$/);
  await expect(page.locator('.safehouse-stage')).toBeVisible();
  await expect(page.getByTestId('dialog-bulletin')).not.toBeVisible();
});