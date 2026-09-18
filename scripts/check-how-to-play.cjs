const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const origin = process.env.GUIDE_TEST_ORIGIN || 'http://127.0.0.1:4186/squabblemon';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const results = [];
  try {
    for (const [name, width, height] of [['desktop', 1440, 1000], ['phone', 390, 844], ['small-phone', 320, 740]]) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${origin}/how-to-play`, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: 'KNOW THE BLOCK.' }).waitFor();
      await page.screenshot({ path: `screenshots/how-to-play-${name}.png` });
      assert.equal(await page.locator('vite-error-overlay').count(), 0);
      assert.equal(await page.locator('main > section').count(), 9);

      // Follow the actual links inside the nested page scroller.
      for (const anchor of ['the-loop', 'your-crew', 'the-battle', 'street-packs', 'card-upgrades', 'your-wallet', 'first-session']) {
        await page.locator(`.guide-chapter-nav a[href="#${anchor}"]`).click();
        const bounds = await page.locator(`#${anchor}`).boundingBox();
        assert.ok(bounds && bounds.y >= 0 && bounds.y < 150, `${name}: ${anchor} is visible below sticky navigation`);
      }

      await page.getByRole('button', { name: 'Snow Bunny Control' }).click();
      assert.equal(await page.getByRole('button', { name: 'Snow Bunny Control' }).getAttribute('aria-pressed'), 'true');
      await page.getByRole('heading', { name: 'Cold Shoulder', exact: true }).waitFor();
      for (const character of ['Abuela Support', 'Plug Tempo', 'Hooper Comeback', 'OG Uncle Finisher', 'Young Bull Pressure']) {
        await page.getByRole('button', { name: character }).click();
        await page.locator('.guide-showcase-art').evaluate(image => image.decode());
      }
      const slider = page.getByRole('slider', { name: 'Preview a character level' });
      for (const [level, xp, tiers] of [[1, '0', 0], [2, '100', 1], [5, '1,000', 2], [8, '2,800', 3], [10, '4,500', 3]]) {
        await slider.fill(String(level));
        assert.ok((await page.locator('.guide-level-readout').innerText()).includes(xp));
        assert.equal(await page.locator('.guide-move-tiers > [data-eligible="true"]').count(), tiers);
      }
      await slider.fill('2');
      await slider.focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await slider.inputValue(), '3', 'Level preview supports keyboard interaction');
      await slider.fill('2');

      await page.getByText('A few details behind the reveal', { exact: false }).click();
      assert.equal(await page.locator('#street-packs details').getAttribute('open'), '');
      await page.getByText('Does a duplicate upgrade my card?', { exact: true }).click();
      assert.ok(await page.getByText('No. A duplicate becomes 25 Style Shards.', { exact: false }).isVisible());
      await page.getByText('Does a duplicate upgrade my card?', { exact: true }).click();
      await page.getByText('A few details behind the reveal', { exact: false }).click();

      // Load every lazy image, then check image and page integrity.
      await page.locator('.how-to-play img').evaluateAll(images => images.forEach(img => { img.loading = 'eager'; }));
      await page.waitForFunction(() => [...document.querySelectorAll('.how-to-play img')].every(img => img.complete && img.naturalWidth > 0));
      const overflow = await page.locator('.how-to-play').evaluate(el => ({ width: el.clientWidth, scrollWidth: el.scrollWidth }));
      assert.ok(overflow.scrollWidth <= overflow.width + 1, `${name}: horizontal page overflow ${JSON.stringify(overflow)}`);
      await page.locator('.guide-footer a').click();
      assert.ok(await page.locator('.how-to-play').evaluate(el => el.scrollTop < 5));
      const pageHeight = await page.locator('.how-to-play').evaluate(el => el.scrollHeight);
      await page.screenshot({ path: `screenshots/how-to-play-${name}.png` });
      if (name !== 'small-phone') {
        // A full-page export temporarily expands the app's own scroll container.
        await page.addStyleTag({ content: '.how-to-play { height:auto!important; overflow:visible!important; } body { overflow:visible!important; } .guide-chapter-nav { position:relative!important; }' });
        await page.screenshot({ path: `screenshots/how-to-play-${name}-full.png`, fullPage: true });
      }
      assert.deepEqual(errors, [], `${name}: uncaught browser errors`);
      results.push({ viewport: name, width, height, pageHeight, checks: 'chapter links, six character selections, XP milestones, keyboard slider, disclosures, all images, no overflow, no runtime errors' });
      await page.close();
    }

    const navPage = await browser.newPage();
    await navPage.goto(`${origin}/`);
    await navPage.getByRole('link', { name: /How to play · The field guide/ }).click();
    await navPage.getByRole('heading', { name: 'KNOW THE BLOCK.' }).waitFor();
    await navPage.getByRole('link', { name: 'Try a match', exact: true }).click();
    await navPage.waitForURL('**/play/guest');
    await navPage.waitForFunction(() => document.body.innerText.length > 200);
    results.push({ navigation: 'public entry → guide → guest practice passed' });
    await navPage.close();
    fs.writeFileSync('artifacts/deliverables/how-to-play-verification.json', JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
