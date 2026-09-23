import { expect, test, type Page } from '@playwright/test';

async function enterGame(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('squabblemon_e2e_user', 'signed-in');
    if (!sessionStorage.getItem('deck-journey-initialized')) {
      localStorage.removeItem('squabblemon.preview-decks.v1');
      sessionStorage.clear();
      sessionStorage.setItem('deck-journey-initialized', 'true');
    }
  });
  await page.route('**/api/player/bootstrap', route => route.fulfill({ json: {} }));
}

async function openFirstExample(page: Page) {
  await page.goto('/squabblemon/game/decks');
  await page.getByRole('group').filter({ has: page.getByText(/Learning examples ·/) }).locator('summary').click();
  await page.getByRole('button', { name: /Build from example:/ }).first().click();
  await expect(page.getByRole('navigation', { name: 'Deck navigation' })).toContainText('My decks');
}

test.beforeEach(async ({ page }) => {
  await enterGame(page);
});

test('list, editor, test, browser history, and saved-example redirects form one journey', async ({ page }) => {
  await openFirstExample(page);
  const exampleUrl = page.url();

  const name = page.getByRole('textbox', { name: 'Deck name' });
  await name.fill('Journey Gang');
  await page.getByRole('button', { name: /Save & test gang/ }).click();
  await expect(page).toHaveURL(/\/game\/decks\/[^/]+\/test$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/game\/decks\/[^/]+$/);
  await expect(page.getByRole('textbox', { name: 'Deck name' })).toHaveValue('Journey Gang');
  expect(page.url()).not.toBe(exampleUrl);

  await page.goForward();
  await expect(page).toHaveURL(/\/game\/decks\/[^/]+\/test$/);
  await page.goBack();
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Deck name' })).toHaveValue('Journey Gang');
});

test('unsaved edits offer save, discard, or stay for in-app and browser exits', async ({ page }) => {
  await openFirstExample(page);
  await page.getByRole('textbox', { name: 'Deck name' }).fill('Unsaved Journey');

  await page.getByRole('button', { name: /My decks/ }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Save your deck changes?');
  await dialog.getByRole('button', { name: 'Stay here' }).click();
  await expect(page.getByRole('textbox', { name: 'Deck name' })).toHaveValue('Unsaved Journey');

  await page.getByRole('link', { name: /Test Player/ }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Stay here' }).click();
  await expect(page).toHaveURL(/\/game\/decks\/[^/]+$/);

  await page.evaluate(() => history.back());
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Discard changes' }).click();
  await expect(page).toHaveURL(/\/game\/decks$/);

  await page.getByRole('group').filter({ has: page.getByText(/Learning examples ·/) }).locator('summary').click();
  await page.getByRole('button', { name: /Build from example:/ }).first().click();
  await page.getByRole('textbox', { name: 'Deck name' }).fill('Saved While Leaving');
  await page.getByRole('button', { name: /My decks/ }).click();
  await dialog.getByRole('button', { name: 'Save and leave' }).click();
  await expect(page).toHaveURL(/\/game\/decks$/);
  await expect(page.getByRole('button', { name: /Edit deck: Saved While Leaving/ })).toBeVisible();
});

test('dirty browser forward restores the editor or proceeds to the test as chosen', async ({ page }) => {
  await openFirstExample(page);
  await page.getByRole('textbox', { name: 'Deck name' }).fill('Forward Guard Gang');
  await page.getByRole('button', { name: /Save & test gang/ }).click();
  await expect(page).toHaveURL(/\/test$/);
  await page.goBack();
  await expect(page.getByRole('textbox', { name: 'Deck name' })).toHaveValue('Forward Guard Gang');

  await page.getByRole('textbox', { name: 'Deck name' }).fill('Changed Before Forward');
  await page.evaluate(() => history.forward());
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Stay here' }).click();
  await expect(page).toHaveURL(/\/game\/decks\/[^/]+$/);
  await expect(page.getByRole('textbox', { name: 'Deck name' })).toHaveValue('Changed Before Forward');

  await page.evaluate(() => history.forward());
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Discard changes' }).click();
  await expect(page).toHaveURL(/\/test$/);
});

test('direct, missing, and refreshed deck links recover without trapping the player', async ({ page }) => {
  await page.goto('/squabblemon/game/decks/does-not-exist');
  await expect(page.getByText('Deck not found.')).toBeVisible();
  await page.getByRole('button', { name: 'Back to my decks' }).click();
  await expect(page).toHaveURL(/\/game\/decks$/);

  await openFirstExample(page);
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Deck navigation' })).toBeVisible();
});