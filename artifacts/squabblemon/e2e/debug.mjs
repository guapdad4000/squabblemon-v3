import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  await page.goto('http://127.0.0.1:3000/e2e/ui-polish.fixture.html?mode=story-node');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'artifacts/squabblemon/debug.png' });
  await browser.close();
}
run().catch(console.error);
