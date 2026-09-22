import { chromium } from 'playwright';
async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  
  await page.goto('http://127.0.0.1:3000/e2e/ui-polish.fixture.html?mode=safehouse');
  await page.waitForLoadState('networkidle');
  
  // Wait for the room buttons to appear or error out
  await page.waitForTimeout(2000);
  
  // Click on "Run the block" or similar UI action that would pop a modal or change view
  // Let's actually evaluate window and click a specific station to see it
  await page.evaluate(() => {
    // Attempt to click the "story" (television) to pop up the safehouse info panel
    const storyBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Story') || b.textContent?.includes('television'));
    if (storyBtn) storyBtn.click();
    else {
      // Just click the center of the screen hoping it triggers the interaction
      const scene = document.querySelector('.safehouse__shade');
      if (scene) scene.click();
    }
  });

  // We want to force the modal state
  await page.evaluate(() => {
    window.__mockHomeSetView = true;
    const btns = document.querySelectorAll('.venue-button, button');
    // If we have "Run the Block" button let's just trigger a state change somehow
  });
  
  // Actually, instead of relying on the WebGL scene interactions which might be tricky in headless:
  // let's click the music button which we know is a standard UI element
  await page.evaluate(() => {
    const musicBtn = Array.from(document.querySelectorAll('button')).find(b => b.querySelector('svg.lucide-disc3') || b.querySelector('svg.lucide-music'));
    if (musicBtn) musicBtn.click();
  });
  
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'artifacts/squabblemon/safehouse-modal.png' });
  await browser.close();
}
run().catch(console.error);
