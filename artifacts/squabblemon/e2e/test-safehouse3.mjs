import { chromium } from 'playwright';
async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  
  await page.goto('http://127.0.0.1:3000/e2e/ui-polish.fixture.html?mode=safehouse');
  await page.waitForLoadState('networkidle');
  
  // Try to dispatch an event that sets the view directly since the IFrame might not load fast enough in headless
  await page.evaluate(() => {
    // We can click the 'Bag' or 'Train' button at the top header if it's there
    const btns = Array.from(document.querySelectorAll('button'));
    const bagBtn = btns.find(b => b.textContent?.includes('Bag'));
    if (bagBtn) bagBtn.click();
  });
  
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'safehouse-modal3.png' });
  await browser.close();
}
run().catch(console.error);
