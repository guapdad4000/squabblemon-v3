import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto('http://127.0.0.1:23307/e2e/rookie-journey.fixture.html');
await page.locator('[data-testid="rookie-welcome"]').waitFor({ timeout: 15000 });
await page.getByRole('button', { name: 'Show me around' }).click();
await page.locator('[data-testid="fade-spotlight"]').waitFor({ timeout: 8000 });
await page.locator('.fade-tip button').click(); // -> lesson 2 (TV marker)
for (let i = 0; i < 24; i++) {
  const s = await page.evaluate(() => {
    const m = document.querySelector('[aria-label="Explore the television"]');
    const nav = m?.closest('nav');
    const spot = document.querySelector('[data-testid="fade-spotlight"]');
    const r = m?.getBoundingClientRect();
    const cs = m ? getComputedStyle(m) : null;
    return {
      t: Math.round(performance.now()),
      rect: r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)].join(',') : 'none',
      vis: cs ? `${cs.display}/${cs.visibility}/${cs.opacity}` : 'gone',
      navHidden: nav?.hidden, fallback: nav?.dataset.guideFallback,
      coachTarget: spot?.getAttribute('data-coach-target'),
      hasMaskHole: !!spot?.querySelector('.fade-target'),
    };
  });
  console.log(JSON.stringify(s));
  await page.waitForTimeout(250);
}
await browser.close();
