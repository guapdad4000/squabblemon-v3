import { chromium, devices } from 'playwright';

async function testViewport(width, height, name) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width, height }
  });
  const page = await context.newPage();
  
  console.log(`\n--- Testing ${name} (${width}x${height}) ---`);

  // Test Story Node
  console.log('Testing Story Node...');
  await page.goto('http://127.0.0.1:3000/e2e/ui-polish.fixture.html?mode=story-node');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.story-briefing');

  const scrollInfo = await page.evaluate(() => {
    const el = document.querySelector('.story-briefing');
    if (!el) return null;
    return {
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      overflowX: getComputedStyle(el).overflowX
    };
  });
  console.log(`Story Node scroll: height=${scrollInfo.scrollHeight}, clientHeight=${scrollInfo.clientHeight}`);
  if (scrollInfo.scrollHeight > scrollInfo.clientHeight) {
    console.log('Story Node is vertically scrollable.');
  }

  const actionsReachable = await page.evaluate(() => {
    const btn = document.querySelector('.story-briefing__btn');
    if (!btn) return false;
    btn.scrollIntoView();
    const rect = btn.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
  });
  console.log(`Story Node actions reachable: ${actionsReachable}`);

  const hasHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  console.log(`Story Node horizontal overflow: ${hasHorizontalOverflow}`);

  // Test Music Dialog
  console.log('Testing Music Dialog...');
  await page.goto('http://127.0.0.1:3000/e2e/ui-polish.fixture.html?mode=music');
  await page.waitForLoadState('networkidle');
  // Open dialog
  await page.click('.music-trigger');
  await page.waitForSelector('.music-dialog');

  const musicScrollInfo = await page.evaluate(() => {
    const el = document.querySelector('.music-dialog');
    return {
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight
    };
  });
  console.log(`Music Dialog scroll: height=${musicScrollInfo.scrollHeight}, clientHeight=${musicScrollInfo.clientHeight}`);
  
  const musicHorizontal = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  console.log(`Music Dialog horizontal overflow: ${musicHorizontal}`);

  // Test Park Result
  console.log('Testing Park Result...');
  await page.goto('http://127.0.0.1:3000/e2e/ui-polish.fixture.html?mode=ranked-loss');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.park-result');
  
  const contrastInfo = await page.evaluate(() => {
    const el = document.querySelector('.park-result');
    const bg = getComputedStyle(el).backgroundColor;
    const color = getComputedStyle(el).color;
    return { bg, color };
  });
  console.log(`Park Result colors: bg=${contrastInfo.bg}, color=${contrastInfo.color}`);

  await browser.close();
}

async function run() {
  await testViewport(320, 568, 'Mobile Small');
  await testViewport(390, 844, 'Mobile Base');
  await testViewport(1440, 900, 'Desktop');
  console.log('\nVerification complete.');
}

run().catch(console.error);
