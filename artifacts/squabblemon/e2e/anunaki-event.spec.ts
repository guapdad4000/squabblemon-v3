import { expect, test } from '@playwright/test';
import { ANUNAKI_EVENT_MILESTONES } from '@workspace/squabblemon-engine/anunakiEvent';

test('event roadmap shows locked preparation state and no claim actions', async ({ page }) => {
  await page.goto('/squabblemon/e2e/anunaki-event.fixture.html');
  await page.getByRole('button', { name: /follow the ancient text/i }).click();
  await expect(page.getByText('The Anunaki cards and event are still being prepared.')).toBeVisible();
  await expect(page.locator('.anunaki-roadmap__step')).toHaveCount(24);
  for (const kind of ['card','sticker-pack','player-mat','currency','tickets']) await expect(page.locator(`.anunaki-roadmap__step[data-reward-kind="${kind}"]`).first()).toBeAttached();
  await expect(page.locator('.anunaki-roadmap__step').last()).toContainText(ANUNAKI_EVENT_MILESTONES.at(-1)!.requirement);
  await expect(page.locator('.anunaki-roadmap__step').last()).toContainText('Optional mastery');
  for (const milestone of ANUNAKI_EVENT_MILESTONES) {
    const image = page.locator(`[data-milestone-id="${milestone.id}"] .anunaki-roadmap__reward-art`);
    await expect(image).toHaveAttribute('src', `/squabblemon/${milestone.reward.artwork}`);
  }
  await expect(page.getByRole('button', { name: 'Claim reward' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a ready claim uses the saved server response before showing collected', async ({ page }) => {
  await page.goto('/squabblemon/e2e/anunaki-event.fixture.html?ready');
  await page.getByRole('button', { name: /follow the ancient text/i }).click();
  await page.getByRole('button', { name: 'Claim reward' }).click();
  await expect(page.getByText('Reward collected.')).toBeVisible();
  await expect(page.locator('.anunaki-roadmap__step').first()).toContainText('Collected');
});

test('switching profiles invalidates an in-flight claim and unlocks the new player', async ({ page }) => {
  await page.goto('/squabblemon/e2e/anunaki-event.fixture.html?switch');
  await page.getByRole('button', { name: /follow the ancient text/i }).click();
  await page.getByRole('button', { name: 'Claim reward' }).click();
  await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  await page.getByRole('button', { name: 'Close Anunaki event' }).click();
  await page.getByRole('button', { name: 'Switch player' }).click();
  await page.getByRole('button', { name: /follow the ancient text/i }).click();
  await expect(page.getByRole('button', { name: 'Claim reward' })).toBeEnabled();
  await page.getByRole('button', { name: 'Claim reward' }).click();
  await expect(page.getByText('Reward collected.')).toBeVisible();
  await page.evaluate(() => (window as unknown as { resolveOldClaim: () => void }).resolveOldClaim());
  await page.waitForFunction(() => (window as unknown as { oldResponseRead?: boolean }).oldResponseRead === true);
  await expect(page.getByText('Reward collected.')).toBeVisible();
  await expect(page.getByText(/999 Style Shards/)).toHaveCount(0);
});

test('roadmap remains readable at a narrow viewport and restores keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/squabblemon/e2e/anunaki-event.fixture.html?ready');
  const opener = page.getByRole('button', { name: /follow the ancient text/i });
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: /the anunaki arrival/i });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close Anunaki event' })).toBeFocused();
  const fits = await page.locator('.anunaki-roadmap__copy h4').evaluateAll(headings => headings.every(heading => {
    const element = heading as HTMLElement;
    return element.scrollWidth <= element.clientWidth + 1;
  }));
  expect(fits).toBe(true);
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
});


test('duplicate receipt stays beside its stop and includes shards with the server label', async ({ page }) => {
  await page.goto('/squabblemon/e2e/anunaki-event.fixture.html?duplicate');
  await page.getByRole('button', { name: /follow the ancient text/i }).click();
  await page.getByRole('button', { name: 'Claim reward' }).click();
  const receipt=page.locator('.anunaki-roadmap__step').first().getByRole('status');
  await expect(receipt).toContainText('Saved reward.');
  await expect(receipt).toContainText('25 Style Shards');
});
