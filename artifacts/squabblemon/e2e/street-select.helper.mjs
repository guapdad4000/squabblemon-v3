/** Exercise the visible custom option menu instead of mutating its hidden form select. */
export async function selectStreetOption(page, trigger, value) {
  await trigger.click();
  await page.locator('[role="option"][data-value=' + JSON.stringify(String(value)) + ']').click();
}
