import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
  await page.goto('http://127.0.0.1:3000/e2e/ui-polish.fixture.html?mode=story-node');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.story-briefing');

  const info = await page.evaluate(() => {
    return {
      briefing: {
        sh: document.querySelector('.story-briefing').scrollHeight,
        ch: document.querySelector('.story-briefing').clientHeight
      },
      container: {
        sh: document.querySelector('.story-briefing__container').scrollHeight,
        ch: document.querySelector('.story-briefing__container').clientHeight
      }
    };
  });
  console.log(info);
  await browser.close();
}
run().catch(console.error);
