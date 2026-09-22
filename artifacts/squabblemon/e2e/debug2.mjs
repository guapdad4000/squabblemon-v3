import { chromium } from 'playwright';
async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message, error.stack));
  await page.goto('http://127.0.0.1:3000/e2e/ui-polish.fixture.html?mode=safehouse');
  await page.waitForTimeout(5000);
  await browser.close();
}
run().catch(console.error);
