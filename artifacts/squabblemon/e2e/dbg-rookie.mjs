import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message.split('\n')[0]));
await page.goto('http://127.0.0.1:23307/e2e/rookie-road.fixture.html');
const spotlight = page.locator('[data-testid="fade-spotlight"]');
await spotlight.waitFor({ timeout: 15_000 });
for (let step = 0; step < 60; step++) {
  if (await page.locator('[data-testid="tutorial-done"]').isVisible().catch(() => false)) { console.log('DONE'); break; }
  const lesson = page.locator('[data-testid="mechanic-lesson"]');
  if (await lesson.isVisible().catch(() => false)) {
    console.log(`step ${step}: MECHANIC LESSON ->`, await lesson.getAttribute('data-mechanic'));
    await page.locator('[data-testid="button-dismiss-mechanic-lesson"]').click({ timeout: 4000 });
    continue;
  }
  const target = await spotlight.getAttribute('data-coach-target').catch(() => null);
  const title = await page.locator('.fade-tip h2').textContent().catch(() => '?');
  console.log(`step ${step}: ${target} — "${title}"`);
  if (!target) { console.log('NO TARGET, stuck. sig=', await page.locator('[data-testid="match-sig"]').textContent()); break; }
  await page.locator(target).first().click({ timeout: 4000 });
  await page.waitForTimeout(700);
}
await browser.close();
