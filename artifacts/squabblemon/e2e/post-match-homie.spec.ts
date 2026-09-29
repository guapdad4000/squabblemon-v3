import { expect, test, type Page } from '@playwright/test';

const code = 'AABBCCDDEEFF';
const friendCode = '123456ABCDEF';
const player = { friendCode, username: 'rival', lastActiveAt: null, displayName: 'Rival', avatarKey: 'hooper' };
const self = { friendCode: '999999999999', username: 'host', lastActiveAt: null, displayName: 'Host', avatarKey: 'rookie' };
type Relationship = 'none' | 'incoming' | 'outgoing' | 'homie' | 'blocked' | 'self';

async function open(page: Page, initial: Relationship, bot = false, failSocial = false) {
  let relation = initial;
  let failLookup = false;
  let mutationMode: 'normal' | 'fail' | 'committed-error' | 'crossed' = 'normal';
  let lookups = 0;
  let sends = 0;
  let accepts = 0;
  const state = () => ({
    self, homies: relation === 'homie' ? [player] : [],
    incomingRequests: relation === 'incoming' ? [{ id: 'request-exact', player, createdAt: new Date().toISOString() }] : [],
    outgoingRequests: relation === 'outgoing' ? [{ id: 'request-exact', player, createdAt: new Date().toISOString() }] : [],
    blocked: relation === 'blocked' ? [player] : [], invitations: [], counts: { requests: 0, invitations: 0 },
  });
  await page.route('**/api/social**', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/social') return failSocial
      ? route.fulfill({ status: 503, json: { error: 'Menu status unavailable.' } })
      : route.fulfill({ json: state() });
    if (url.pathname.endsWith(`/match-opponent/${code}`)) {
      lookups++;
      return failLookup ? route.fulfill({ status: 503, json: { error: 'Connection unavailable.' } })
        : route.fulfill({ json: { opponent: { player, relationship: relation, requestId: relation === 'incoming' || relation === 'outgoing' ? 'request-exact' : null } } });
    }
    if (url.pathname.endsWith('/requests') && route.request().method() === 'POST') {
      sends++;
      if (mutationMode === 'fail') return route.fulfill({ status: 503, json: { error: 'Unconfirmed request.' } });
      if (mutationMode === 'committed-error') {
        relation = 'outgoing';
        return route.fulfill({ status: 503, json: { error: 'Acknowledgment lost.' } });
      }
      if (mutationMode === 'crossed') {
        relation = 'incoming';
        return route.fulfill({ status: 409, json: { error: 'Rival already asked you.' } });
      }
      expect(route.request().postDataJSON()).toEqual({ friendCode });
      relation = 'outgoing';
      return route.fulfill({ json: state() });
    }
    if (url.pathname.endsWith('/requests/request-exact/respond')) {
      accepts++;
      if (mutationMode === 'fail') return route.fulfill({ status: 503, json: { error: 'Unconfirmed request.' } });
      expect(route.request().postDataJSON()).toEqual({ action: 'accept' });
      relation = 'homie';
      return route.fulfill({ json: state() });
    }
    return route.fulfill({ status: 404, json: { error: 'Unexpected social endpoint.' } });
  });
  await page.goto(`/squabblemon/e2e/post-match-homie.fixture.html${bot ? '?bot' : ''}`);
  await expect(page.getByTestId('park-result-dialog')).toBeVisible();
  return {
    setRelationship(value: Relationship) { relation = value; },
    failLookup(value: boolean) { failLookup = value; },
    failMutation(value: boolean) { mutationMode = value ? 'fail' : 'normal'; },
    mutationMode(value: typeof mutationMode) { mutationMode = value; },
    lookups: () => lookups, sends: () => sends, accepts: () => accepts,
  };
}

test('human result offers a secondary Add Homie beside the resolved rival, and dedupes taps', async ({ page }) => {
  const api = await open(page, 'none');
  const result = page.getByTestId('park-result-dialog');
  const action = result.getByTestId('post-match-homie-action');
  await expect(action).toHaveText('Add Homie');
  await expect(result.getByTestId('post-match-homie')).toContainText('Rival');
  await expect(action).toHaveCSS('min-height', '44px');
  await action.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(action).toHaveText('Request sent');
  expect(api.sends()).toBe(1);
  await expect(result.getByRole('button', { name: 'Back to friend fades' })).toBeVisible();
  await expect(result).not.toContainText(friendCode);
  await result.getByRole('button', { name: 'Inspect final board' }).click();
  await expect(result).toBeHidden();
  await page.getByRole('button', { name: 'View result' }).click();
  await expect(result.getByTestId('post-match-homie-action')).toHaveText('Request sent');
});

test('incoming request accepts its exact id; homies and outgoing are read-only', async ({ page }) => {
  const api = await open(page, 'incoming');
  const action = page.getByTestId('post-match-homie-action');
  await expect(action).toHaveText('Accept request');
  await action.click();
  await expect(action).toHaveText('Homies');
  expect(api.accepts()).toBe(1);
  api.setRelationship('outgoing');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(action).toHaveText('Request sent');
  await expect(action).toBeDisabled();
});

test('failed lookup shows retry; failed acknowledgment refreshes instead of claiming success', async ({ page }) => {
  const api = await open(page, 'none');
  const action = page.getByTestId('post-match-homie-action');
  await expect(action).toHaveText('Add Homie');
  api.failLookup(true);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByTestId('post-match-homie').getByRole('alert')).toBeVisible();
  api.failLookup(false);
  await page.getByTestId('post-match-homie').getByRole('button', { name: 'Retry' }).click();
  await expect(action).toBeEnabled();
  api.failMutation(true);
  await action.click();
  await expect(page.getByTestId('post-match-homie').getByRole('alert')).toBeVisible();
  await expect(action).toHaveText('Add Homie');
  api.failMutation(false);
  await page.getByTestId('post-match-homie').getByRole('button', { name: 'Retry' }).click();
  await action.click();
  await expect(action).toHaveText('Request sent');
});

test('lost send acknowledgement reconciles the committed outgoing request without a false error', async ({ page }) => {
  const api = await open(page, 'none');
  api.mutationMode('committed-error');
  const action = page.getByTestId('post-match-homie-action');
  await expect(action).toHaveText('Add Homie');
  await action.click();
  await expect(action).toHaveText('Request sent');
  await expect(action).toBeDisabled();
  await expect(page.getByTestId('post-match-homie').getByRole('alert')).toHaveCount(0);
  expect(api.sends()).toBe(1);
});

test('crossed send request reconciles to incoming, then accepts the exact request ID', async ({ page }) => {
  const api = await open(page, 'none');
  api.mutationMode('crossed');
  const action = page.getByTestId('post-match-homie-action');
  await expect(action).toHaveText('Add Homie');
  await action.click();
  await expect(action).toHaveText('Accept request');
  await expect(action).toBeEnabled();
  await expect(page.getByTestId('post-match-homie').getByRole('alert')).toHaveCount(0);
  api.mutationMode('normal');
  await action.click();
  await expect(action).toHaveText('Homies');
  expect(api.accepts()).toBe(1);
});

test('stale menu query error does not disable an online, resolved rival', async ({ page }) => {
  const api = await open(page, 'none', false, true);
  const action = page.getByTestId('post-match-homie-action');
  await expect(action).toHaveText('Add Homie');
  await expect(action).toBeEnabled();
  await action.click();
  await expect(action).toHaveText('Request sent');
  expect(api.sends()).toBe(1);
});

test('ranked bot never resolves a social opponent', async ({ page }) => {
  const api = await open(page, 'none', true);
  await expect(page.getByTestId('post-match-homie')).toHaveCount(0);
  expect(api.lookups()).toBe(0);
});

test('blocked and self relationships hide the control after authoritative refresh', async ({ page }) => {
  const api = await open(page, 'blocked');
  await expect(page.getByTestId('post-match-homie')).toHaveCount(0);
  api.setRelationship('self');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(api.lookups).toBeGreaterThan(1);
  await expect(page.getByTestId('post-match-homie')).toHaveCount(0);
});