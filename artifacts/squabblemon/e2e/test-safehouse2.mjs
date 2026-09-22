import { chromium } from 'playwright';
async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  
  await page.goto('http://127.0.0.1:3000/e2e/ui-polish.fixture.html?mode=safehouse');
  await page.waitForLoadState('networkidle');
  
  // Wait a bit
  await page.waitForTimeout(2000);
  
  // Evaluate and click the Run the block button
  await page.evaluate(() => {
    const runBlockBtn = Array.from(document.querySelectorAll('button, a')).find(b => b.textContent?.includes('RUN THE BLOCK') || b.textContent?.includes('Run the block'));
    if (runBlockBtn) runBlockBtn.click();
  });
  
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'safehouse-modal2.png' });
  await browser.close();
}
run().catch(console.error);
