import { expect, test } from '@playwright/test';
import { POLICY_EFFECTIVE_DATE } from '../src/pages/CustomerPolicy';

const appBase = process.env.POLICY_E2E_BASE_PATH ?? '/squabblemon';

test('support and refund policy routes are public and retain the configured app base', async ({ page }) => {
  await page.goto(`${appBase}/support`);

  await expect(page.getByTestId('heading-policy-title')).toHaveText('Clout purchase support');
  await expect(page.getByTestId('status-policy-draft')).toContainText(POLICY_EFFECTIVE_DATE
    ? `Effective ${POLICY_EFFECTIVE_DATE}`
    : 'Owner-approved for launch · Not yet effective');
  await expect(page.getByTestId('text-merchant-name')).toHaveText('It’s a check inc');
  await expect(page.getByTestId('link-open-email-app')).toHaveAttribute('href', /^mailto:Guapshipping@gmail\.com/);
  await expect(page.getByTestId('link-policy-refunds')).toHaveAttribute('href', `${appBase}/refund-policy`);

  await page.getByTestId('link-policy-refunds').click();
  await expect(page).toHaveURL(new RegExp(`${appBase}/refund-policy$`));
  await expect(page.getByTestId('heading-policy-title')).toHaveText('Clout refunds');
  if (POLICY_EFFECTIVE_DATE) {
    await expect(page.getByText(`Voluntary refund terms effective ${POLICY_EFFECTIVE_DATE}.`, { exact: false })).toBeVisible();
  } else {
    await expect(page.getByText(/no effective date has been set/i)).toBeVisible();
  }
  await expect(page.getByText(/Applicable tax is calculated during Stripe-hosted checkout/i)).toBeVisible();
  await expect(page.getByText('14-day voluntary request window')).toBeVisible();
  await expect(page.getByText(/silently remove earned rewards/i)).toBeVisible();
});