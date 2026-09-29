import { expect, test, type Page, type Route } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { profileBootstrap } from './fighter-id.fixture';

mkdirSync('test-results/events/screenshots', { recursive: true });
const entry = '/squabblemon/game/events';
const feedbackPath = '**/api/events/feedback**';
const post = (index: number) => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  displayName: `Player ${index}`,
  category: 'general',
  message: `A note from player ${index}`,
  createdAt: new Date(Date.UTC(2026, 8, 28, 12, 0, index)).toISOString(),
});
async function setup(page: Page) {
  await page.context().addCookies([{
    name: 'events_test_seat', value: 'a', url: `http://127.0.0.1:${process.env.EVENTS_E2E_PORT}`,
  }]);
  await page.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
  await page.routeWebSocket('**', socket => socket.close());
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/player/bootstrap') return route.fulfill({
      json: profileBootstrap({ id: 'events-mock-feedback', displayName: 'Board Reader', avatarKey: 'kyle' }),
    });
    if (path.startsWith('/api/player/mail')) return route.fulfill({ json: { messages: [] } });
    // Explicitly disallow all unrelated API calls from leaving this owned host.
    return route.fulfill({ status: 503, json: { error: `Not part of feedback test: ${path}` } });
  });
}
async function open(page: Page) {
  await page.goto(entry);
  await expect(page.getByTestId('form-feedback')).toBeVisible({ timeout: 60_000 });
}
async function draft(page: Page, message = 'Feedback browser test draft') {
  await page.getByTestId('select-feedback-category').selectOption('bug');
  await page.getByTestId('input-feedback-message').fill(message);
}
const submit = (page: Page) => page.getByTestId('button-feedback-submit');
const message = (page: Page) => page.getByTestId('input-feedback-message');
const error = (page: Page) => page.getByTestId('status-feedback-error');
function confirm(body: Record<string, unknown>, replayed = false) {
  const saved = {
    ...post(901), category: body.category, message: String(body.message).trim(),
    displayName: 'Board Reader',
  };
  return { post: saved, receiptId: saved.id, replayed };
}

test('required category/message, plain text and 2000 character boundary', async ({ page }) => {
  await setup(page);
  await page.route(feedbackPath, route => route.request().method() === 'GET'
    ? route.fulfill({ json: { posts: [], nextCursor: null } })
    : route.fulfill({ status: 500, json: { error: 'Unexpected submission' } }));
  await open(page);
  await expect(page.getByTestId('status-feed-empty')).toBeVisible();
  await submit(page).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Choose a category' })).toBeVisible();
  await page.getByTestId('select-feedback-category').selectOption('general');
  await submit(page).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Write a message' })).toBeVisible();
  await expect(message(page)).toHaveAttribute('maxlength', '2000');
  await message(page).fill('x'.repeat(2001));
  await expect(message(page)).toHaveValue('x'.repeat(2000));
  await expect(page.getByTestId('text-feedback-count')).toHaveText('2000/2000');
  await page.route(feedbackPath, route => route.request().method() === 'GET'
    ? route.fulfill({ json: { posts: [], nextCursor: null } })
    : route.fulfill({ status: 201, json: confirm(route.request().postDataJSON()) }));
  await submit(page).click();
  await expect(page.getByTestId('status-feedback')).toContainText('Saved');
  await expect(message(page)).toHaveValue('');
});

test('one in-flight submission, confirmed-only success, malformed 200 and retained retry identity', async ({ page }) => {
  await setup(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const requests: Array<{ category: string; message: string; retryId: string }> = [];
  let stage = 0;
  await page.route(feedbackPath, async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { posts: [], nextCursor: null } });
    const body = route.request().postDataJSON();
    requests.push(body);
    if (stage === 0) {
      await gate;
      stage++;
      return route.fulfill({ status: 200, json: { post: body, replayed: false } });
    }
    if (stage === 1) {
      stage++;
      return route.abort('failed');
    }
    if (stage === 2) {
      stage++;
      return route.fulfill({ status: 503, json: { code: 'UNAVAILABLE', error: 'Unavailable' } });
    }
    return route.fulfill({ status: 200, json: confirm(body, true) });
  });
  await open(page);
  await draft(page);
  await submit(page).click();
  await expect(submit(page)).toBeDisabled();
  await expect(submit(page)).toHaveAttribute('aria-busy', 'true');
  expect(requests).toHaveLength(1);
  release();
  await expect(error(page)).toContainText('could not confirm');
  await expect(message(page)).toHaveValue('Feedback browser test draft');
  await expect(page.getByTestId(`card-feedback-${post(901).id}`)).toHaveCount(0);
  await submit(page).click();
  await expect(error(page)).toContainText('could not confirm');
  await submit(page).click();
  await expect(error(page)).toContainText('could not confirm');
  expect(requests.map(request => request.retryId)).toEqual([requests[0].retryId, requests[0].retryId, requests[0].retryId]);
  await submit(page).click();
  await expect(page.getByTestId('status-feedback')).toContainText('Already saved');
  await expect(message(page)).toHaveValue('');
  await expect(page.getByTestId(`card-feedback-${post(901).id}`)).toHaveCount(1);
  expect(requests[3].retryId).toBe(requests[0].retryId);
  await draft(page, 'Changed content uses a new key');
  await submit(page).click();
  await expect(page.getByTestId('status-feedback')).toContainText('Already saved');
  expect(requests[4].retryId).not.toBe(requests[0].retryId);
});

test('401 expired, 429 throttle, 409 conflict and changed draft are explicit, retained and retry-safe', async ({ page }) => {
  await setup(page);
  const requests: Array<{ retryId: string; message: string }> = [];
  const statuses = [401, 429, 409, 503, 400, 200];
  await page.route(feedbackPath, route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { posts: [], nextCursor: null } });
    const body = route.request().postDataJSON();
    requests.push(body);
    const status = statuses.shift()!;
    return route.fulfill({
      status,
      headers: status === 429 ? { 'Retry-After': '90' } : {},
      json: status === 200 ? confirm(body) : { error: `Server status ${status}`, code: 'FEEDBACK_ERROR', ...(status === 429 ? { retryAfterSeconds: 90 } : {}) },
    });
  });
  await open(page);
  await draft(page);
  await submit(page).click();
  await expect(error(page)).toContainText('session has expired');
  await expect(page.getByTestId('link-feedback-signin')).toBeVisible();
  await expect(message(page)).toHaveValue('Feedback browser test draft');
  await submit(page).click();
  await expect(error(page)).toContainText('Try again');
  await expect(error(page)).toContainText('draft is still here');
  await submit(page).click();
  await expect(error(page)).toContainText('clashed');
  expect(requests[1].retryId).toBe(requests[0].retryId);
  expect(requests[2].retryId).toBe(requests[0].retryId);
  await submit(page).click();
  await expect(error(page)).toContainText('Change the category or message');
  expect(requests).toHaveLength(3);
  await message(page).fill('Changed draft after conflict');
  await submit(page).click();
  await expect(error(page)).toContainText('could not confirm');
  expect(requests[3].retryId).not.toBe(requests[2].retryId);
  await submit(page).click();
  await expect(error(page)).toContainText('The board could not accept this');
  await expect(message(page)).toHaveValue('Changed draft after conflict');
  await submit(page).click();
  await expect(page.getByTestId('status-feedback')).toContainText('Saved');
  expect(requests[4].retryId).toBe(requests[3].retryId);
  expect(requests[4].message).toBe('Changed draft after conflict');
  expect(requests[5].retryId).toBe(requests[4].retryId);
});

test('feed loading, failed fetch retry, bounded cursor pages, no duplicates, and new post preserves older posts', async ({ page }) => {
  await setup(page);
  const all = Array.from({ length: 23 }, (_, i) => post(i + 1));
  let fail = true;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const cursors: string[] = [];
  let writes = 0;
  await page.route(feedbackPath, async (route: Route) => {
    if (route.request().method() === 'POST') {
      writes++;
      return route.fulfill({ status: 201, json: confirm(route.request().postDataJSON()) });
    }
    const url = new URL(route.request().url());
    const limit = Number(url.searchParams.get('limit'));
    expect(limit).toBeGreaterThan(0);
    expect(limit).toBeLessThanOrEqual(50);
    const cursor = url.searchParams.get('cursor') ?? '';
    cursors.push(cursor);
    if (fail) {
      await gate;
      return route.fulfill({ status: 503, json: { error: 'Unavailable', code: 'UNAVAILABLE' } });
    }
    const start = cursor === 'older' ? 20 : 0;
    return route.fulfill({ json: {
      posts: cursor ? [all[19], ...all.slice(start)] : all.slice(0, 20),
      nextCursor: cursor ? null : 'older',
    } });
  });
  await open(page);
  await expect(page.getByRole('list', { name: 'Loading feedback' })).toBeVisible();
  release();
  await expect(page.getByTestId('status-feed-error')).toBeVisible();
  fail = false;
  await page.getByTestId('button-feed-retry').click();
  await expect(page.getByTestId(`card-feedback-${all[0].id}`)).toBeVisible();
  await page.getByTestId('button-feed-more').click();
  await expect(page.getByTestId(`card-feedback-${all[22].id}`)).toBeVisible();
  expect(cursors).toContain('older');
  expect(await page.locator('.feedback-post:not(.feedback-post--skeleton)').count()).toBe(23);
  await draft(page, 'New feedback keeps the older page');
  await submit(page).click();
  await expect(page.getByTestId(`card-feedback-${post(901).id}`)).toHaveCount(1);
  await expect(page.getByTestId(`card-feedback-${all[22].id}`)).toBeVisible();
  expect(await page.locator('.feedback-post:not(.feedback-post--skeleton)').count()).toBe(24);
  expect(writes).toBe(1);
  await page.screenshot({ path: 'test-results/events/screenshots/mocked-loaded-feed.png', animations: 'disabled' });
});