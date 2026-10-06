import { expect, test, type Page } from '@playwright/test';
import { profileBootstrap } from './fighter-id.fixture';
import { PREPARED_PATCHES } from '../src/lib/preparedPatches';

const published = { version: '1.4.2', title: 'The corner holds', date: '2026-09-25', overview: 'A quieter opening turn.', buffs: ['Buddy gains 2 guard.'], changes: ['The first draw is clearer.'], publishedAt: '2026-09-25T12:00:00Z', mailStatus: 'delivering' };
async function signIn(page: Page) {
  await page.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
  await page.route('**/api/player/bootstrap', route => route.fulfill({ json: profileBootstrap({ id: 'e2e-player' }) }));
}
test('official notes deep-link, read without promising a gift, and handle an unavailable feed', async ({ page }) => {
  await signIn(page);
  let failed = false;
  await page.route('**/api/events/patches', route => failed ? route.fulfill({ status: 503, json: { error: 'offline' } }) : route.fulfill({ json: [published] }));
  await page.goto('/squabblemon/game/events?patch=1.4.2');
  await expect(page.getByTestId('patch-detail')).toContainText('Buddy gains 2 guard.', { timeout: 30_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await expect(page.getByTestId('patch-detail')).toContainText('Mail is still making its rounds');
  await expect(page.locator('#patch-detail-heading')).toBeFocused();
  failed = true;
  await page.reload();
  await expect(page.getByTestId('button-retry-patches')).toBeVisible();
});
test('partial mail delivery never claims every player received a letter', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/events/patches', route => route.fulfill({ json: [{ ...published, mailStatus: 'partial' }] }));
  await page.goto('/squabblemon/game/events?patch=1.4.2');
  await expect(page.getByTestId('patch-detail')).toContainText('some letters outstanding');
  await expect(page.getByTestId('patch-detail')).toContainText('a missing letter is not a gift you can claim yet');
});
test('a patch letter reaches the existing Mailman, preserves its date and lines, and is claimable only once', async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page);
  let claims = 0;
  const letter = {
    id: 'patch-letter-142', title: 'Patch 1.4.2: The corner holds', sender: 'Squabblemon Team',
    body: 'Patch 1.4.2 · September 25, 2026\nThe corner holds\n\nA quieter opening turn.\n\nBuffs\n• Buddy gains 2 guard.\n\nChanges\n• The first draw is clearer.',
    sentAt: '2026-09-25T12:00:00Z', readAt: null as string | null, claimedAt: null as string | null,
    gift: { softCurrency: 50, packTickets: 1, styleShards: 0 },
  };
  await page.route('**/api/player/mail**', route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'GET') return route.fulfill({ json: { messages: [letter] } });
    letter.readAt ??= '2026-09-25T12:05:00Z';
    const credited = path.endsWith('/claim') && !letter.claimedAt;
    if (credited) { claims++; letter.claimedAt = '2026-09-25T12:06:00Z'; }
    return route.fulfill({ json: { mail: letter, credited } });
  });
  await page.route('**/api/events/patches', route => route.fulfill({ json: [published] }));
  await page.goto('/squabblemon/game?notice=mail&letter=patch-letter-142');
  const mailbox = page.getByRole('dialog', { name: 'Knock. Knock.' });
  await expect(mailbox).toBeVisible({ timeout: 60_000 });
  await expect(mailbox.locator('.mail-from')).toContainText('2026');
  await expect(mailbox.locator('.mail-body')).toContainText('September 25, 2026');
  await expect(mailbox.locator('.mail-body')).toHaveText(letter.body);
  await expect(mailbox.locator('.mail-body')).toHaveCSS('white-space', 'pre-wrap');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await expect(mailbox.locator('.mail-gift')).toContainText('50 Clout');
  await expect(mailbox.locator('.mail-gift')).toContainText('1 Pack Tickets');
  await mailbox.getByRole('button', { name: 'Claim your gift' }).click();
  await expect(mailbox.getByRole('button', { name: /Gift claimed/ })).toBeDisabled();
  expect(claims).toBe(1);
  await page.reload();
  await expect(mailbox).toBeVisible({ timeout: 60_000 });
  await expect(mailbox.getByRole('button', { name: /Gift claimed/ })).toBeDisabled();
  expect(claims).toBe(1);
});
test('desk refuses a 403 and shows no editor', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/admin/patches', route => route.fulfill({ status: 403, json: { error: 'forbidden' } }));
  await page.goto('/squabblemon/game/admin/patches');
  await expect(page.getByText('Desk unavailable.')).toBeVisible();
  await expect(page.getByTestId('form-patch')).toHaveCount(0);
});
test('save, inspect the mail and audience, confirm exact version, then lock publication', async ({ page }) => {
  await signIn(page);
  let draft: Record<string, unknown> | null = null;
  let publishedCount = 0;
  await page.route('**/api/admin/patches**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET' && url.pathname.endsWith('/preview')) return route.fulfill({ json: { patch: draft, letter: { id: 'mail-1', sender: 'The Safehouse', title: 'Patch dispatch', body: 'Hello block.\n\nA quieter opening turn.', gift: { softCurrency: 50, packTickets: 0, styleShards: 0 } }, audienceCount: 17 } });
    if (request.method() === 'GET') return route.fulfill({ json: draft ? [draft] : [] });
    if (url.pathname.endsWith('/publish')) {
      expect(request.postDataJSON()).toEqual({ confirmVersion: '2026-09-25T12:00:00Z' });
      publishedCount++;
      draft = { ...draft, status: 'published', intendedCount: 17 };
      return route.fulfill({ json: draft });
    }
    draft = { ...request.postDataJSON(), id: 'draft-1', status: 'draft', createdAt: '2026-09-25T12:00:00Z', updatedAt: '2026-09-25T12:00:00Z', createdBy: 'editor', publishedBy: null, intendedCount: 0, deliveredCount: 0, failedCount: 0, lastError: null, campaignId: null };
    return route.fulfill({ json: draft });
  });
  await page.goto('/squabblemon/game/admin/patches');
  await page.getByTestId('input-patch-version').fill('1.4.2');
  await page.getByTestId('input-patch-title').fill('The corner holds');
  await page.getByTestId('input-patch-overview').fill('A quieter opening turn.');
  await page.getByTestId('input-patch-buffs').fill('Buddy gains 2 guard.');
  await page.getByTestId('button-save-patch').click();
  await expect(page.getByTestId('button-preview-patch')).toBeEnabled();
  await page.getByTestId('button-preview-patch').click();
  await expect(page.locator('.patch-preview__stats')).toContainText('17 players');
  await expect(page.getByTestId('patch-events-preview')).toContainText('Buddy gains 2 guard.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await expect(page.locator('.patch-preview__letter p')).toHaveCSS('white-space', 'pre-wrap');
  await page.getByTestId('button-open-publish').click();
  await expect(page.getByTestId('button-confirm-publish')).toBeDisabled();
  await page.getByTestId('input-confirm-version').fill('1.4.2');
  await page.getByTestId('button-confirm-publish').click();
  await expect(page.getByText(/Published copy is locked/)).toBeVisible();
  await expect(page.getByTestId('form-patch')).toHaveCount(0);
  expect(publishedCount).toBe(1);
});
test('a changed draft blocks publication and refreshes editor before a new preview', async ({ page }) => {
  await signIn(page);
  let stamp = '2026-09-25T12:00:00Z';
  let title = 'The corner holds';
  let status = 'draft';
  let attempts = 0;
  const draft = () => ({ id: 'draft-1', version: '1.4.2', title, date: '2026-09-25', overview: 'A quieter opening turn.', buffs: ['Buddy gains 2 guard.'], changes: [], softCurrency: 50, packTickets: 0, status, createdAt: stamp, updatedAt: stamp, createdBy: 'editor', publishedBy: null, intendedCount: 0, deliveredCount: 0, failedCount: 0, lastError: null, campaignId: null });
  await page.route('**/api/admin/patches**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/preview')) return route.fulfill({ json: { patch: draft(), letter: { id: 'mail-1', sender: 'The Safehouse', title: 'Patch dispatch', body: 'Hello block.', gift: { softCurrency: 50, packTickets: 0, styleShards: 0 } }, audienceCount: 17 } });
    if (path.endsWith('/publish')) {
      attempts++;
      expect(route.request().postDataJSON()).toEqual({ confirmVersion: attempts === 1 ? '2026-09-25T12:00:00Z' : '2026-09-25T13:00:00Z' });
      if (attempts === 1) {
        stamp = '2026-09-25T13:00:00Z'; title = 'The corner holds, revised';
        return route.fulfill({ status: 409, json: { error: 'Draft changed' } });
      }
      status = 'published';
      return route.fulfill({ json: draft() });
    }
    return route.fulfill({ json: [draft()] });
  });
  await page.goto('/squabblemon/game/admin/patches');
  await page.getByTestId('button-edit-patch-draft-1').click();
  await page.getByTestId('button-preview-patch').click();
  await page.getByTestId('button-open-publish').click();
  await page.getByTestId('input-confirm-version').fill('1.4.2');
  await page.getByTestId('button-confirm-publish').click();
  await expect(page.locator('.patch-desk__work [role=alert]')).toContainText('Draft changed');
  await expect(page.getByTestId('input-patch-title')).toHaveValue('The corner holds, revised');
  await page.getByTestId('button-preview-patch').click();
  await expect(page.getByTestId('patch-events-preview')).toContainText('The corner holds, revised');
  await page.getByTestId('button-open-publish').click();
  await page.getByTestId('input-confirm-version').fill('1.4.2');
  await page.getByTestId('button-confirm-publish').click();
  await expect(page.getByText(/Published copy is locked/)).toBeVisible();
  expect(attempts).toBe(2);
});test('patch notes headline original character art that actually loads', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/events/patches', route => route.fulfill({ json: [{ ...published, artCardId: 'red-side-2' }] }));
  await page.goto('/squabblemon/game/events?patch=1.4.2');
  const art = page.getByTestId('patch-detail').getByTestId('patch-art');
  await expect(art).toContainText('OG Red Night', { timeout: 30_000 });
  const image = art.locator('img');
  await expect(image).toHaveAttribute('alt', 'OG Red Night artwork');
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
  await expect(page.getByTestId('button-patch-1.4.2').locator('.patch-art--thumb img')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});
test('prepared notes become ordinary drafts with reviewed art and gifts, never publications', async ({ page }) => {
  await signIn(page);
  const drafts: Record<string, unknown>[] = [];
  let publishCalls = 0;
  await page.route('**/api/admin/patches**', route => {
    const request = route.request();
    if (new URL(request.url()).pathname.endsWith('/publish')) { publishCalls++; return route.fulfill({ status: 500, json: {} }); }
    if (request.method() === 'GET') return route.fulfill({ json: drafts });
    const body = request.postDataJSON();
    const draft = { ...body, id: `draft-${drafts.length + 1}`, status: 'draft', createdAt: '2026-09-29T12:00:00Z', updatedAt: '2026-09-29T12:00:00Z', createdBy: 'editor', publishedBy: null, intendedCount: 0, deliveredCount: 0, failedCount: 0, lastError: null, campaignId: null };
    drafts.push(draft);
    return route.fulfill({ status: 201, json: draft });
  });
  await page.goto('/squabblemon/game/admin/patches');
  await expect(page.getByTestId('panel-prepared-patches')).toContainText(`${PREPARED_PATCHES.length} prepared notes`, { timeout: 30_000 });
  await page.getByTestId('button-import-prepared').click();
  await expect(page.getByTestId('panel-prepared-patches')).toHaveCount(0);
  expect(drafts.map(draft => draft.version)).toEqual(PREPARED_PATCHES.map(patch => patch.version));
  for (const [index, draft] of drafts.entries()) {
    expect(draft).toMatchObject({
      softCurrency: PREPARED_PATCHES[index].softCurrency,
      packTickets: PREPARED_PATCHES[index].packTickets,
      artCardId: PREPARED_PATCHES[index].artCardId,
    });
  }
  expect(publishCalls).toBe(0);
  await page.getByTestId(`button-edit-patch-draft-${PREPARED_PATCHES.length}`).click();
  await expect(page.getByTestId('select-patch-art')).toHaveValue('the-og-rap-legend');
  await expect(page.getByTestId('input-patch-title')).toHaveValue('Them Streets Talkin...');
  await expect(page.getByTestId('input-patch-tickets')).toHaveValue('10');
  await expect(page.getByTestId('input-patch-tickets')).toHaveAttribute('max', '10');
});
